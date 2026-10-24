import {
  build,
  type BuildResult,
  type JsonValue,
  type LoadedConfig,
} from '@limulus/lemmon-shell'
import { strict as assert } from 'node:assert'
import { existsSync } from 'node:fs'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { linkPosts } from './link-posts.ts'

type FrontMatter = Record<string, JsonValue>

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

  it("should escape the paragraph's url and domain, not [via]'s definition", () => {
    const via = `https://a&b'"c.example/?q="x"><script>&y='z'`
    expect(ours({ linkUrl: LINK, viaUrl: via }, '')).toBe(
      `\n\n[link]: ${LINK}\n[via]: ${via}\n\n<p>Via <a href="https://a&amp;b&#39;` +
        '&quot;c.example/?q=&quot;x&quot;&gt;&lt;script&gt;&amp;y=&#39;z&#39;">' +
        'a&amp;b&#39;&quot;c.example</a>.</p>'
    )
  })

  it('should leave a linkUrl or viaUrl that is not a string to the schema', () => {
    expect(ours({ linkUrl: 3 }, 'Prose.\n')).toBe('Prose.\n')
    expect(ours({ linkUrl: LINK, viaUrl: true }, 'Prose.\n')).toBe(
      `Prose.\n\n\n[link]: ${LINK}`
    )
  })

  it('should refuse a linkUrl holding whitespace', () => {
    expect(() => ours({ linkUrl: `${LINK}\nb` }, '')).toThrow(
      `linkUrl may hold no whitespace, and "${LINK}\\nb" does`
    )
  })

  it('should refuse a viaUrl holding whitespace, though it parses as a URL', () => {
    expect(URL.canParse(`${VIA}\nc`)).toBe(true)
    expect(() => ours({ linkUrl: LINK, viaUrl: `${VIA}\nc` }, '')).toThrow(
      `viaUrl may hold no whitespace, and "${VIA}\\nc" does`
    )
  })

  it('should take a url whose whitespace is percent-encoded as it is', () => {
    const [link, via] = [`${LINK}%20b`, `${VIA}%0Ac`]
    expect(ours({ linkUrl: link, viaUrl: via }, '')).toBe(
      `\n\n[link]: ${link}\n[via]: ${via}\n\n<p>Via <a href="${via}">example.org</a>.</p>`
    )
  })

  it('should refuse a viaUrl that is not a URL', () => {
    expect(() => ours({ linkUrl: LINK, viaUrl: 'example.org' }, '')).toThrow(
      'viaUrl example.org is not a URL, so it has no domain to credit'
    )
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
    served: [],
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

  it('should stop the build at a linkUrl wrapped onto a second line', async () => {
    await post(`linkUrl: ${LINK}\n  /b`, 'See [this][link].\n')
    const { diagnostics } = await built()
    expect(
      diagnostics.map(({ path, severity, message }) => [path, severity, message])
    ).toEqual([
      [
        'post.md',
        'error',
        "the `link-posts` plugin's `transformDocument` failed on this document: it " +
          `threw Error: linkUrl may hold no whitespace, and "${LINK} /b" does`,
      ],
    ])
  })
})
