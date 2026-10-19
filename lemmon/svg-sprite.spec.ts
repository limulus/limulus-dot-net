import {
  build,
  type BuildResult,
  type LoadedConfig,
  type Mark,
  type Plugin,
  type ProducerContext,
} from '@limulus/lemmon-shell'
import eleventySvgSprite from 'eleventy-plugin-svg-sprite'
import { existsSync } from 'node:fs'
import { mkdir, mkdtemp, readFile, rm, symlink, utimes, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import SVGSpriter, { type Config } from 'svg-sprite'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { svgSprite, type Spriter } from './svg-sprite.ts'

const SVG = fileURLToPath(new URL('../www/assets/svg/', import.meta.url))
const PAGE_LEM = fileURLToPath(
  new URL('../www/_includes/layouts/page.lem', import.meta.url)
)

/** Runs the asset hook of `plugin`, as a build does before its pages render. */
async function prepared(plugin: Plugin): Promise<Plugin> {
  const context = { root: SVG, input: SVG, output: SVG, writes: false, env: {} }
  expect(await plugin.assets?.(context)).toEqual({})
  return plugin
}

/** What the producer of `plugin` for the mark `name` puts at one such mark. */
function produced(plugin: Plugin, name: string): string {
  const handler = plugin.marks?.find((each) => each.name === name)
  const at = { line: 0, character: 0 }
  const span = { start: 0, end: 0, range: { start: at, end: at } }
  const mark: Mark = { name, start: 0, end: 0, path: 'page.lem', span }
  const context: ProducerContext = {
    name,
    marks: [mark],
    fragments: [],
    page: new Uint8Array(),
    body: false,
    write: () => undefined,
  }
  const [content] = handler?.produce?.(context) ?? []
  return content as string
}

/** The sprite eleventy-plugin-svg-sprite's shortcode writes for `directory`. */
async function eleventySprite(directory: string): Promise<string> {
  const events: Record<string, () => Promise<void>> = {}
  const shortcodes: Record<string, () => string> = {}
  const eleventyConfig = {
    on: (event: string, listener: () => Promise<void>) => (events[event] = listener),
    addShortcode: (name: string, shortcode: () => string) => (shortcodes[name] = shortcode),
  }
  const plugin = eleventySvgSprite as (config: object, options: object[]) => void
  plugin(eleventyConfig, [{ path: directory, svgSpriteShortcode: 'spec' }])
  await events.beforeBuild()
  return shortcodes.spec()
}

/**
 * svg-sprite's spriter for `config`, which hands `kept` each sprite it compiles, as
 * svg-sprite wrote it.
 */
function keeping(kept: (sprite: string) => void): (config: Config) => Spriter {
  return (config) => {
    const spriter = new SVGSpriter(config)
    return {
      add: (file, name, svg) => spriter.add(file, name, svg),
      compileAsync: async () => {
        const compiled = await spriter.compileAsync()
        const { symbol } = compiled.result as { symbol: { sprite: { contents: Buffer } } }
        kept(symbol.sprite.contents.toString('utf8'))
        return compiled
      },
    }
  }
}

describe('svgSprite', () => {
  const sprites = { sprite: join(SVG, 'common'), photoSprite: join(SVG, 'photos') }

  it('should produce one mark for each sprite it is given', () => {
    const { marks } = svgSprite(sprites)
    expect(marks?.map(({ name }) => name)).toEqual(['sprite', 'photoSprite'])
  })

  it("should write eleventy-plugin-svg-sprite's sprite, less what WebC changes", async () => {
    const plugin = await prepared(svgSprite(sprites))
    const theirs = await eleventySprite(join(SVG, 'common'))
    expect(theirs).toContain('<style>')
    expect(produced(plugin, 'sprite')).toBe(
      theirs.replace('hidden;">', 'hidden">').replace(/<style>[^<]*<\/style>/g, '')
    )
  })

  it("should write the photos' sprite as Eleventy does from a second entry", async () => {
    const plugin = await prepared(svgSprite(sprites))
    const theirs = await eleventySprite(join(SVG, 'photos'))
    expect(produced(plugin, 'photoSprite')).toBe(theirs.replace('hidden;">', 'hidden">'))
  })

  it('should leave page.lem naming every id the style it drops names', async () => {
    let raw = ''
    await prepared(
      svgSprite(
        { sprite: join(SVG, 'common') },
        keeping((it) => (raw = it))
      )
    )
    const ids = [...raw.matchAll(/<style>([^<]*)<\/style>/g)].flatMap(([, css]) =>
      [...css.matchAll(/#[\w-]+/g)].map(([id]) => id)
    )
    expect(ids).toContain('#elogo-p3')
    const pageLem = await readFile(PAGE_LEM, 'utf8')
    expect(ids.filter((id) => !pageLem.includes(id))).toEqual([])
  })
})

describe('a build listing svgSprite', () => {
  let dir: string
  let icons: string

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'svg-sprite-'))
    icons = join(dir, 'icons')
    await mkdir(join(dir, 'site'))
    await mkdir(icons)
    await writeFile(join(dir, 'site/site.lem'), '')
    for (const page of ['index', 'about']) {
      await writeFile(
        join(dir, `site/${page}.lem`),
        `---\ntitle: ${page}\n---\n<lem.mark("sprite")>\n`
      )
    }
  })

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true })
  })

  const configWith = (plugin: Plugin): LoadedConfig => ({
    file: join(dir, 'lemmon.config.ts'),
    input: join(dir, 'site'),
    output: join(dir, 'out'),
    served: [],
    passthrough: [],
    plugins: [plugin],
    dev: { headers: {} },
  })

  const built = (config: LoadedConfig): Promise<BuildResult> =>
    build(config, { now: new Date(0), env: {} })

  /** Builds the site with `config`, and returns its index page. */
  async function index(config: LoadedConfig): Promise<string> {
    expect((await built(config)).diagnostics).toEqual([])
    return readFile(join(dir, 'out/index.html'), 'utf8')
  }

  /** The one error a build with `config` reports, which writes nothing. */
  async function refusal(config: LoadedConfig): Promise<string> {
    const { diagnostics } = await built(config)
    expect(diagnostics.map(({ path, severity }) => [path, severity])).toEqual([
      [config.file, 'error'],
    ])
    expect(existsSync(join(dir, 'out'))).toBe(false)
    return diagnostics[0].message
  }

  /** Writes the icon `name` drawing `path`, last modified at `seconds` past the epoch. */
  async function draw(name: string, path: string, seconds = 1000): Promise<void> {
    const file = join(icons, `${name}.svg`)
    await writeFile(
      file,
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><path d="${path}"/></svg>\n`
    )
    await utimes(file, seconds, seconds)
  }

  it('should place a symbol for each icon at the mark', async () => {
    await draw('square', 'M0 0h10v10H0z')
    const html = await index(configWith(svgSprite({ sprite: icons })))
    expect(html).toMatch(/^<div style="[^"]*"><svg [^>]*><symbol [^>]*id="svg-square"/)
  })

  it('should name an icon a directory down by its directory too', async () => {
    await mkdir(join(icons, 'arrows'))
    await draw('arrows/up', 'M5 0 10 10H0z')
    const html = await index(configWith(svgSprite({ sprite: icons })))
    expect(html).toContain('id="svg-arrows--up"')
  })

  it('should leave out a file or directory named for a dot', async () => {
    await draw('square', 'M0 0h10v10H0z')
    await symlink('eric@host.123', join(icons, '.#square.svg'))
    await writeFile(join(icons, '._square.svg'), 'AppleDouble')
    await mkdir(join(icons, '.cache'))
    await draw('.cache/old', 'M5 0 10 10H0z')
    const html = await index(configWith(svgSprite({ sprite: icons })))
    expect(html.match(/<symbol /g)).toHaveLength(1)
  })

  it('should drop the style of every icon that holds one, as WebC hoists each', async () => {
    for (const [name, fill] of [
      ['red', '#f00'],
      ['blue', '#00f'],
    ]) {
      await writeFile(
        join(icons, `${name}.svg`),
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10">' +
          `<style>@media (min-width:1px){path{fill:${fill}}}</style><path d="M0 0h10v10H0z"/></svg>\n`
      )
    }
    const html = await index(configWith(svgSprite({ sprite: icons })))
    expect(html.match(/<symbol /g)).toHaveLength(2)
    expect(html).not.toContain('<style')
  })

  it('should add a new icon to the sprite on the next build', async () => {
    const config = configWith(svgSprite({ sprite: icons }))
    await draw('square', 'M0 0h10v10H0z')
    expect(await index(config)).not.toContain('svg-triangle')
    await draw('triangle', 'M5 0 10 10H0z')
    expect(await index(config)).toContain('id="svg-triangle"')
  })

  it('should draw an icon anew once its file has changed', async () => {
    const config = configWith(svgSprite({ sprite: icons }))
    await draw('square', 'M0 0h10v10H0z', 1000)
    expect(await index(config)).toContain('M0 0h10v10H0z')
    await draw('square', 'M0 0h5v5H0z', 2000)
    const html = await index(config)
    expect(html).toContain('M0 0h5v5H0z')
    expect(html).not.toContain('M0 0h10v10H0z')
  })

  it('should draw an icon anew when a copy of its size and mtime replaces it', async () => {
    const config = configWith(svgSprite({ sprite: icons }))
    await draw('square', 'M0 0h10v10H0z', 1000)
    expect(await index(config)).toContain('M0 0h10v10H0z')
    await draw('square', 'M0 0h10v10H1z', 1000)
    expect(await index(config)).toContain('M0 0h10v10H1z')
  })

  it('should compile a sprite again only when one of its files has changed', async () => {
    let compiled = 0
    const config = configWith(
      svgSprite(
        { sprite: icons },
        keeping(() => compiled++)
      )
    )
    await draw('square', 'M0 0h10v10H0z')
    await index(config)
    await index(config)
    expect(compiled).toBe(1)
    await utimes(join(icons, 'square.svg'), 2000, 2000)
    await index(config)
    expect(compiled).toBe(2)
  })

  it('should stop the build when its directory is missing', async () => {
    const config = configWith(svgSprite({ sprite: join(dir, 'nowhere') }))
    expect(await refusal(config)).toMatch(
      /^the `svg-sprite` plugin's `assets` hook failed: it threw Error: ENOENT/
    )
  })

  it('should stop the build at an empty file', async () => {
    await writeFile(join(icons, 'blank.svg'), '')
    const config = configWith(svgSprite({ sprite: icons }))
    expect(await refusal(config)).toMatch(/You must provide SVG contents/)
  })

  it('should stop the build at a file svg-sprite cannot read as SVG', async () => {
    await draw('square', 'M0 0h10v10H0z')
    await writeFile(join(icons, 'notes.svg'), 'not an svg')
    await writeFile(join(icons, 'open.svg'), '<svg xmlns="http://www.w3.org/2000/svg"><g>')
    const config = configWith(svgSprite({ sprite: icons }))
    expect(await refusal(config)).toContain(
      `svg-sprite could not read ${join(icons, 'open.svg')}, ${join(icons, 'notes.svg')} ` +
        'as SVG'
    )
  })
})
