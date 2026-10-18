// The port's stand-in for eleventy-plugin-svg-sprite: the inline sprite Eleventy's
// `svgspriteCommon` shortcode writes at the top of every page, as a mark `lem build`
// fills, built by the same svg-sprite with the same options.
//
// What must change at the cutover from Eleventy (lemmon ∆oAl). The sprite matches
// Eleventy's after WebC has hoisted the `<style>` out of ldn.svg's symbol, so it drops
// that `<style>`, and page.lem carries a copy of its rules. Those rules name ids
// svg-sprite namespaces by the order files are added (`svgFiles`): ldn.svg's letter
// counts the files sorting after it (`e` for four), so adding or removing such an icon
// renames the ids the copy names. This file's spec and parity's css-bundle class catch
// that; `lem build` does not. svg-sprite also keeps its namespace width on its
// prototype, shared by every spriter in the process: once a sprite of more than 26
// icons compiles, every later one's ids take two letters, so such a photos sprite would
// rename the logo's ids partway through a `lem dev` session. Once Eleventy's output need
// not be matched, the `<style>` can stay in the sprite and page.lem's copy go.

import type { Plugin } from '@limulus/lemmon-shell'
import { strict as assert } from 'node:assert'
import { readdir, readFile, stat } from 'node:fs/promises'
import { basename, join, resolve, sep } from 'node:path'
import SVGSpriter, { type Config } from 'svg-sprite'

/** svg-sprite's spriter, as far as this plugin calls it. */
export interface Spriter {
  add(file: string, name: string, svg: string): unknown
  compileAsync(): Promise<{ result: unknown; data: unknown }>
}

/**
 * A plugin producing one inline SVG sprite per entry of `sprites`, which maps a mark name
 * to a directory (absolute, or from the working directory): every
 * `<lem.mark("<name>")>` becomes a hidden `<div>` holding an `<svg>` with a `<symbol>`
 * for each `.svg` file under the directory, `id="svg-<file name>"` (`svg-<dir>--<file
 * name>` a directory down), for `svgUse` to refer to. A second sprite is a second entry.
 * `spriter` makes the spriter for a sprite: svg-sprite's, unless a spec's.
 *
 * The sprites are built in the plugin's `assets` hook, which builds no asset: it runs
 * once per build, before anything compiles, and a failure there — a directory missing,
 * an empty file, a file svg-sprite could not read as SVG — stops the build with an error
 * at the config. A sprite is rebuilt only when a file's name, size, mtime or ctime has
 * changed, so a plugin `lem dev` keeps across rebuilds serves an icon added or edited
 * since the last one; the producers place what this build's hook built.
 */
export function svgSprite(
  sprites: Record<string, string>,
  spriter: (config: Config) => Spriter = (config) => new SVGSpriter(config)
): Plugin {
  const roots = Object.entries(sprites).map(([name, directory]) => ({
    name,
    root: resolve(directory),
  }))
  const cache = new Map<string, { key: string; html: string }>()
  let built: ReadonlyMap<string, string> | undefined
  return {
    name: 'svg-sprite',
    assets: async () => {
      const sprites = new Map<string, string>()
      for (const { name, root } of roots) {
        const files = await svgFiles(root)
        const key = files
          .map(
            ({ path, size, mtimeMs, ctimeMs }) => `${path}:${size}:${mtimeMs}:${ctimeMs}`
          )
          .join('|')
        let cached = cache.get(name)
        if (cached?.key !== key) {
          const paths = files.map(({ path }) => path)
          cached = { key, html: await spriteOf(root, paths, spriter(CONFIG)) }
          cache.set(name, cached)
        }
        sprites.set(name, cached.html)
      }
      built = sprites
      return {}
    },
    marks: roots.map(({ name }) => ({
      name,
      produce: ({ marks }) => {
        const html = built?.get(name)
        assert(html !== undefined, 'the shell runs the assets hook before any page renders')
        return marks.map(() => html)
      },
    })),
  }
}

interface SvgFile {
  path: string
  size: number
  mtimeMs: number
  ctimeMs: number
}

/**
 * Every `.svg` file under `root` by its path from there, none in or named for a dot (an
 * editor's lock link, an AppleDouble file), as glob leaves them out, in the order
 * eleventy-plugin-svg-sprite adds them: glob 11's, which for a flat directory is the
 * reverse of readdir's, and readdir's is sorted on every Unix (libuv's scandir), so the
 * live site, built on Ubuntu, has the same ids as a Mac. Glob lists a directory's files
 * before its subdirectories', which this order does not reproduce; both sprite
 * directories are flat. The order is not cosmetic: svg-sprite sorts the symbols by id,
 * but namespaces the ids inside each by the file's place in this order (the header
 * says what that costs).
 */
async function svgFiles(root: string): Promise<SvgFile[]> {
  const paths = (await readdir(root, { recursive: true, encoding: 'utf8' }))
    .filter((path) => path.endsWith('.svg'))
    .filter((path) => !path.split(sep).some((segment) => segment.startsWith('.')))
    .sort()
    .reverse()
  const files = await Promise.all(
    paths.map(async (path) => {
      // `stat` follows a link: common/ldn.svg links to the hashed logo beside it.
      const stats = await stat(join(root, path))
      const { size, mtimeMs, ctimeMs } = stats
      return stats.isFile() ? [{ path, size, mtimeMs, ctimeMs }] : []
    })
  )
  return files.flat()
}

/** The symbol id of the file at `relative`, as eleventy-plugin-svg-sprite names it. */
const idOf = (relative: string): string =>
  `svg-${basename(relative.split(sep).join('--').replace(/\s+/g, '_'), '.svg')}`

/**
 * What eleventy-plugin-svg-sprite hands svg-sprite (its src/options.js), less what leaves
 * the markup alone: the sprite's file name, `example: false` (the default), and
 * `mode.inline`, which names no mode svg-sprite knows. svg-sprite copies what it changes
 * of this, so one object serves every spriter.
 */
const CONFIG: Config = {
  mode: { symbol: true },
  shape: { transform: ['svgo'], id: { generator: (_svg, file) => idOf(file.relative) } },
  svg: { xmlDeclaration: false, doctypeDeclaration: false },
}

/** The part of svg-sprite's compile in symbol mode that is read here. */
interface Compiled {
  result: { symbol: { sprite: { contents: Buffer } } }
  data: { symbol: { shapes: { name: string }[] } }
}

/** eleventy-plugin-svg-sprite's wrapper, its style as WebC leaves it: no closing `;`. */
const WRAPPER = '<div style="width: 0; height: 0; position: absolute; overflow: hidden">'

/**
 * WebC hoists every `<style>` on a page into the page's CSS bundle — the one in ldn.svg
 * among them — so the sprite in Eleventy's pages holds none. page.lem carries ldn.svg's
 * rules; an icon given a `<style>` of its own needs a layout to carry its rules too.
 */
const STYLE = /<style\b[^>]*>[\s\S]*?<\/style>/g

/**
 * The sprite of the `.svg` files at `paths` under `root`, made by `spriter`, as the
 * mark's content.
 *
 * @throws when svg-sprite left a file out, which it does in silence for one it cannot
 *   read as SVG: plain text, HTML, a tag left open.
 */
async function spriteOf(
  root: string,
  paths: readonly string[],
  spriter: Spriter
): Promise<string> {
  for (const path of paths) {
    spriter.add(join(root, path), path, await readFile(join(root, path), 'utf8'))
  }
  const { result, data } = (await spriter.compileAsync()) as Compiled
  const kept = new Set(data.symbol.shapes.map(({ name }) => name))
  const lost = paths.filter((path) => !kept.has(idOf(path)))
  if (lost.length > 0) {
    throw new Error(
      `svg-sprite could not read ${lost.map((path) => join(root, path)).join(', ')} ` +
        'as SVG, so the sprite would lack it'
    )
  }
  const svg = result.symbol.sprite.contents.toString('utf8')
  return `${WRAPPER}${svg.replace(STYLE, '')}</div>`
}
