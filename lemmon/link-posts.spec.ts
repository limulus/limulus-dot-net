import type { UserConfig } from '@11ty/eleventy'
import {
  build,
  findFrontMatter,
  readPage,
  type BuildResult,
  type JsonValue,
  type LoadedConfig,
} from '@limulus/lemmon-shell'
import matter from 'gray-matter'
import { strict as assert } from 'node:assert'
import { existsSync } from 'node:fs'
import { mkdir, mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { linkPosts } from './link-posts.ts'
import configureEleventy from '../eleventy.config.ts'

const WWW = fileURLToPath(new URL('../www/', import.meta.url))

type FrontMatter = Record<string, JsonValue>
type Preprocessor = (data: FrontMatter, content: string) => string | undefined

/**
 * The preprocessor eleventy.config.ts adds as `name`, got by running the config against
 * a stand-in for Eleventy's that keeps each preprocessor and ignores every other call.
 */
function eleventyPreprocessor(name: string): Preprocessor {
  const added = new Map<string, Preprocessor>()
  const keep = (each: string, _extension: string, preprocessor: Preprocessor) =>
    added.set(each, preprocessor)
  const config = new Proxy(
    {},
    { get: (_target, method) => (method === 'addPreprocessor' ? keep : () => undefined) }
  )
  configureEleventy(config as UserConfig)
  const preprocessor = added.get(name)
  assert(preprocessor !== undefined, `eleventy.config.ts adds no preprocessor ${name}`)
  return preprocessor
}

const linkPostContent = eleventyPreprocessor('linkPostContent')

/** What Eleventy's `linkPostContent` makes of `body`, given the front matter `data`. */
const theirs = (data: FrontMatter, body: string): string =>
  linkPostContent(data, body) ?? body

/** What the plugin's transform makes of `body`, given the front matter `frontMatter`. */
function ours(frontMatter: FrontMatter, body: string): string {
  const made = linkPosts().transformDocument?.({ path: 'post.md', frontMatter, body })
  assert(made !== undefined, 'linkPosts has a transformDocument')
  return made
}

const LINK = 'https://www.example.com/a'
const VIA = 'https://www.example.org/b'

describe('linkPosts', () => {
  it('should leave a document without a linkUrl as it is', () => {
    expect(ours({ title: 'Prose' }, 'Prose.\n')).toBe('Prose.\n')
  })

  it('should append the definition of [link] after a blank line', () => {
    expect(ours({ linkUrl: LINK }, 'See [this][link].\n')).toBe(
      `See [this][link].\n\n\n[link]: ${LINK}`
    )
  })

  it('should strip www. only where it starts the host', () => {
    for (const [via, domain] of [
      ['https://awww.example.org/', 'awww.example.org'],
      ['https://cdn.www.example.org/', 'cdn.www.example.org'],
    ]) {
      expect(ours({ linkUrl: LINK, viaUrl: via }, '')).toContain(`">${domain}</a>.</p>`)
    }
  })

  it("should append [via]'s definition and a paragraph naming its domain", () => {
    expect(ours({ linkUrl: LINK, viaUrl: VIA }, 'See [this][link].\n')).toBe(
      `See [this][link].\n\n\n[link]: ${LINK}\n[via]: ${VIA}\n\n` +
        `<p>Via <a href="${VIA}">example.org</a>.</p>`
    )
  })

  it('should leave a linkUrl or viaUrl that is not a string to the schema', () => {
    expect(ours({ linkUrl: 3 }, 'Prose.\n')).toBe('Prose.\n')
    expect(ours({ linkUrl: LINK, viaUrl: true }, 'Prose.\n')).toBe(
      `Prose.\n\n\n[link]: ${LINK}`
    )
  })

  it('should refuse a viaUrl that is not a URL', () => {
    expect(() => ours({ linkUrl: LINK, viaUrl: 'example.org' }, '')).toThrow(
      'viaUrl example.org is not a URL, so it has no domain to credit'
    )
  })
})

describe("linkPosts against eleventy.config.ts's linkPostContent", () => {
  const cases: [string, FrontMatter][] = [
    ['no linkUrl', { title: 'Prose' }],
    ['a linkUrl', { linkUrl: LINK }],
    ['a linkUrl and a viaUrl', { linkUrl: LINK, viaUrl: VIA }],
    ['a viaUrl alone', { viaUrl: VIA }],
    ['empty urls', { linkUrl: '', viaUrl: '' }],
    ['an empty viaUrl', { linkUrl: LINK, viaUrl: '' }],
    ['a capitalized host and a port', { linkUrl: LINK, viaUrl: 'HTTPS://WWW.Ex.org:81/' }],
    ['a www. twice and mid-host', { linkUrl: LINK, viaUrl: 'https://www.www.awww.org/' }],
    ['a www. ending a label', { linkUrl: LINK, viaUrl: 'https://awww.example.org/' }],
    [
      'a www. past the first label',
      { linkUrl: LINK, viaUrl: 'https://cdn.www.example.org/' },
    ],
    ['a host past ASCII', { linkUrl: LINK, viaUrl: 'https://www.bücher.de/?q="x"' }],
  ]

  it.each(cases)('should append what Eleventy appends, given %s', (_given, frontMatter) => {
    const body = 'See [this][link].\n'
    expect(ours(frontMatter, body)).toBe(theirs(frontMatter, body))
  })

  it('should throw at a viaUrl that is not a URL, as Eleventy does', () => {
    const frontMatter = { linkUrl: LINK, viaUrl: 'example.org' }
    expect(() => theirs(frontMatter, '')).toThrow('Invalid URL')
    expect(() => ours(frontMatter, '')).toThrow('is not a URL')
  })

  it('should append what Eleventy appends to every document in www/', async () => {
    const paths = (await readdir(WWW, { recursive: true, encoding: 'utf8' }))
      .filter((path) => path.endsWith('.md'))
      .sort()
    const appended: string[] = []
    for (const path of paths) {
      const text = await readFile(join(WWW, path), 'utf8')
      const { page } = readPage(path, text, { inputDir: 'www' })
      assert(page !== undefined, `${path}'s front matter reads`)
      const body = text.slice(findFrontMatter(text)?.end ?? 0)
      const made = ours(page.loaded.value, body)
      expect(made, path).toBe(theirs(matter(text).data as FrontMatter, body))
      if (made !== body) appended.push(made.slice(body.length))
    }
    // Some, not how many: a post merged from main must not fail this.
    expect(appended.some((tail) => !tail.includes('<p>Via '))).toBe(true)
    expect(appended.some((tail) => tail.includes('<p>Via '))).toBe(true)
  })
})

describe('a build listing linkPosts', () => {
  let dir: string

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'link-posts-'))
    await mkdir(join(dir, 'site'))
    await writeFile(join(dir, 'site/site.lem'), '')
  })

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true })
  })

  const config = (): LoadedConfig => ({
    file: join(dir, 'lemmon.config.ts'),
    input: join(dir, 'site'),
    output: join(dir, 'out'),
    passthrough: [],
    plugins: [linkPosts()],
    dev: { headers: {} },
  })

  const built = (): Promise<BuildResult> => build(config(), { now: new Date(0), env: {} })

  /** Writes a post with `frontMatter` (YAML lines) and `body`. */
  const post = (frontMatter: string, body: string): Promise<void> =>
    writeFile(join(dir, 'site/post.md'), `---\n${frontMatter}\n---\n\n${body}`)

  it("should resolve a link post's references and credit the via site", async () => {
    await post(
      `linkUrl: ${LINK}\nviaUrl: ${VIA}`,
      'See [this][link], by way of [that][via].\n'
    )
    expect((await built()).diagnostics).toEqual([])
    const html = await readFile(join(dir, 'out/post/index.html'), 'utf8')
    expect(html).toContain(
      `<a href="${LINK}">this</a>, by way of <a href="${VIA}">that</a>`
    )
    expect(html).toContain(`<p>Via <a href="${VIA}">example.org</a>.</p>`)
  })

  it('should stop the build at a viaUrl that is not a URL, at the post', async () => {
    await post(`linkUrl: ${LINK}\nviaUrl: example.org`, 'See [this][link].\n')
    const { diagnostics } = await built()
    expect(
      diagnostics.map(({ path, severity, message }) => [path, severity, message])
    ).toEqual([
      [
        'post.md',
        'error',
        "the `link-posts` plugin's `transformDocument` failed on this document: it " +
          'threw Error: viaUrl example.org is not a URL, so it has no domain to credit',
      ],
    ])
    expect(existsSync(join(dir, 'out'))).toBe(false)
  })
})
