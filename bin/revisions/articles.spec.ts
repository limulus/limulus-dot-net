import matter from 'gray-matter'
import { readFileSync } from 'node:fs'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'

import {
  ARTICLES_GLOB,
  listArticles,
  readArticle,
  titleOf,
  type Article,
} from './articles.ts'

const ROOT = fileURLToPath(new URL('../../', import.meta.url))
const SITE_LEM = readFileSync(join(ROOT, 'www/site.lem'), 'utf8')

describe('ARTICLES_GLOB', () => {
  it("should be the glob site.lem's articles binding collects", () => {
    expect(SITE_LEM).toContain(`<lem-let articles: [Post] from "${ARTICLES_GLOB}" />`)
  })
})

describe('titleOf', () => {
  it("should be site.lem's default for a Post's title", () => {
    expect(SITE_LEM).toContain(
      '<lem-type Post extends Page>\n  title: string = "Link: " + (self.linkTitle ?? "")\n'
    )
  })

  it('should take the title the front matter gives', () => {
    expect(titleOf({ title: 'Good Taste', linkTitle: 'Taste' })).toBe('Good Taste')
  })

  it('should make one from the linkTitle where the front matter gives no title', () => {
    expect(titleOf({ linkTitle: 'Why USA 1.0 failed' })).toBe('Link: Why USA 1.0 failed')
  })

  it('should make one from neither, as site.lem does', () => {
    expect(titleOf({})).toBe('Link: ')
  })
})

describe('readArticle', () => {
  it('should read its title and subhead, and its body after the front matter as written', () => {
    const text = '---\ntitle: T\nsubhead: S\n---\n\nBody <lem.x>\n'
    expect(readArticle('www/feed/a.md', text)).toEqual({
      path: 'www/feed/a.md',
      title: 'T',
      subhead: 'S',
      content: '\nBody <lem.x>\n',
    })
  })

  it('should give a link post its computed title and an empty subhead none', () => {
    const article = readArticle('www/links/a.md', '---\nlinkTitle: L\nsubhead:\n---\nB\n')
    expect(article.title).toBe('Link: L')
    expect(article.subhead).toBeUndefined()
  })
})

describe('listArticles', () => {
  describe('given a site', () => {
    let root: string

    beforeEach(async () => {
      root = await mkdtemp(join(tmpdir(), 'list-articles-'))
    })

    afterEach(async () => {
      await rm(root, { recursive: true, force: true })
    })

    async function write(paths: string[]): Promise<void> {
      for (const path of paths) {
        await mkdir(dirname(join(root, path)), { recursive: true })
        await writeFile(join(root, path), `---\ntitle: ${path}\n---\nBody of ${path}\n`)
      }
    }

    it('should list the markdown under its four sections at any depth, sorted', async () => {
      await write([
        'www/tils/git/a.md',
        'www/feed/b/index.md',
        'www/feed/top.md',
        'www/feed/.draft.md',
        'www/links/2026/01/30/c/index.md',
        'www/penumbra/journal/d.md',
      ])
      expect((await listArticles(root)).map(({ path }) => path)).toEqual([
        'www/feed/.draft.md',
        'www/feed/b/index.md',
        'www/feed/top.md',
        'www/links/2026/01/30/c/index.md',
        'www/penumbra/journal/d.md',
        'www/tils/git/a.md',
      ])
    })

    it('should pass over what the glob does not hold, and node_modules', async () => {
      await write([
        'www/about/e.md',
        'www/feed.md',
        'www/feed/b/notes.txt',
        'www/feed/b/index.lem',
        'www/feed/node_modules/f/index.md',
      ])
      expect(await listArticles(root)).toEqual([])
    })

    it('should read each one from its file', async () => {
      await write(['www/feed/b/index.md'])
      expect(await listArticles(root)).toEqual([
        {
          path: 'www/feed/b/index.md',
          title: 'www/feed/b/index.md',
          content: 'Body of www/feed/b/index.md\n',
        },
      ])
    })
  })

  describe('given this site', () => {
    let articles: Article[]

    beforeAll(async () => {
      articles = await listArticles(ROOT)
    })

    // The revision hashes of these four were recorded under Eleventy's computed title,
    // which these are; a change to titleOf that moved them would record a revision for
    // each on the next deploy.
    it.each([
      [
        'www/links/2026/03/15/dual-loop-bdd-new-red-green-tdd/index.md',
        'Link: Dual-loop BDD is the new Red-green TDD',
      ],
      [
        'www/links/2026/04/07/eight-years-wanting-building-ai/index.md',
        'Link: Eight years of wanting, three months of building with AI',
      ],
      [
        'www/links/2026/06/28/make-ai-boring-again/index.md',
        'Link: Is it ethical to use AI?',
      ],
      ['www/links/2026/07/04/why-usa-1-0-failed/index.md', 'Link: Why USA 1.0 failed'],
    ])('should title %s, which gives only a linkTitle, %j', (path, title) => {
      expect(matter(readFileSync(join(ROOT, path), 'utf8')).data.title).toBeUndefined()
      expect(articles.find((article) => article.path === path)?.title).toBe(title)
    })
  })
})
