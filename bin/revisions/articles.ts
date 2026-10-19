import { globby } from 'globby'
import matter from 'gray-matter'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'

/**
 * The articles' glob from the input directory, `www/`: what site.lem's `articles` binding
 * collects, written here a second time so that recording revisions needs neither
 * Eleventy nor a build. articles.spec.ts holds the two copies equal.
 */
export const ARTICLES_GLOB = '{feed,links,penumbra,tils}/**/*.md'

/** The input directory the glob is from, as lemmon.config.ts names it. */
const INPUT = 'www'

/** An article as its revision hash reads it. */
export interface Article {
  /** From the repository root, as revisions.json keys it: `www/feed/…/index.md`. */
  path: string
  /** Its title, given or computed ({@link titleOf}). */
  title: string
  subhead?: string
  /** The markdown after the front matter, as written. */
  content: string
}

/**
 * A post's title by site.lem's default for `Post.title`, written a second time:
 * `"Link: " + (self.linkTitle ?? "")` where the front matter gives no `title`.
 * articles.spec.ts holds the two copies equal.
 */
export function titleOf(frontMatter: { title?: string; linkTitle?: string }): string {
  return frontMatter.title ?? 'Link: ' + (frontMatter.linkTitle ?? '')
}

/** The article at `path`, whose text is `text`. */
export function readArticle(path: string, text: string): Article {
  const { data, content } = matter(text)
  return { path, title: titleOf(data), subhead: data.subhead ?? undefined, content }
}

/**
 * Every article under `root`'s `www/`, sorted by path as the shell sorts its walk. The
 * glob matches as the shell's does where a site holds what this one does — dotfiles
 * included, `node_modules` and `.git` passed over — but it is case-sensitive, and it
 * follows a symbolically linked directory, which the shell does not.
 */
export async function listArticles(root: string = '.'): Promise<Article[]> {
  const paths = await globby(ARTICLES_GLOB, {
    cwd: join(root, INPUT),
    dot: true,
    ignore: ['**/node_modules/**', '**/.git/**'],
  })
  paths.sort((a, b) => (a < b ? -1 : 1))
  return Promise.all(
    paths.map(async (path) =>
      readArticle(`${INPUT}/${path}`, await readFile(join(root, INPUT, path), 'utf8'))
    )
  )
}
