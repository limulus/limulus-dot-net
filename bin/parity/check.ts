// What `npm run parity` does with each page: find it in both builds, compare the two as
// rendered HTML through the allowlist, and hold every class to its expected count, as
// lemmon's fidelity harness does for its own page.

import { compareRendered, renderedPage, type Comparison } from '@limulus/lemmon-shell'
import { readdir, readFile } from 'node:fs/promises'
import { join, sep } from 'node:path'

import { forgiveness, SITE_DISPLAY, type Bundles, type PhotoTitles } from './classes.ts'
import { readStylesheets } from '../lemmon-css.ts'

/** What a build wrote as HTML: its pages' urls, and every other `.html` file. */
export interface Written {
  /** The url of each `index.html` at any depth: its directory's, `/` for the root's. */
  pages: string[]
  /** The path of every other `.html` file, which no page is written as. */
  strays: string[]
}

/**
 * What the build in `dist` wrote as HTML, sorted: nothing where it wrote no such
 * directory. A page is an `index.html`; any other `.html` is a stray, which fails the
 * run, since parity would compare no page there. Feeds and the sitemap are `.xml`.
 */
export async function pagesIn(dist: string): Promise<Written> {
  const files = await readdir(dist, { recursive: true }).catch(
    (error: NodeJS.ErrnoException) => {
      if (error.code === 'ENOENT') return []
      throw error
    }
  )
  const html = files
    .map((file) => file.split(sep).join('/'))
    .filter((file) => file.endsWith('.html'))
  const page = (file: string): boolean =>
    file === 'index.html' || file.endsWith('/index.html')
  return {
    pages: html
      .filter(page)
      .map((file) => `/${file.slice(0, -'index.html'.length)}`)
      .sort(),
    strays: html.filter((file) => !page(file)).sort(),
  }
}

/** Each photo's title by its alias, from the input directory's `_lemmon/photos.json`. */
export async function photoTitlesIn(input: string): Promise<PhotoTitles> {
  const photos = JSON.parse(
    await readFile(join(input, '_lemmon/photos.json'), 'utf8')
  ) as Record<string, { alias: string; title: string }>
  return new Map(Object.values(photos).map(({ alias, title }) => [alias, title]))
}

/**
 * The pages to compare, sorted: every url either build wrote a page at (`ours` and
 * `theirs`), once. A page only one build wrote is compared, and fails as missing from
 * the other.
 */
export const rosterOf = (ours: string[], theirs: string[]): string[] =>
  [...new Set([...ours, ...theirs])].sort()

/** The page a build wrote for `url`, or null if it wrote none. */
export async function pageAt(dist: string, url: string): Promise<string | null> {
  return readFile(join(dist, url, 'index.html'), 'utf8').catch(
    (error: NodeJS.ErrnoException) => {
      if (error.code === 'ENOENT') return null
      throw error
    }
  )
}

/**
 * Every file a build wrote in the directory at the url path `dir`, keyed by its url,
 * read as bytes; none where it wrote no such directory.
 */
export async function filesIn(dist: string, dir: string): Promise<Map<string, Buffer>> {
  const names = await readdir(join(dist, dir)).catch((error: NodeJS.ErrnoException) => {
    if (error.code === 'ENOENT') return []
    throw error
  })
  const files = new Map<string, Buffer>()
  for (const name of names.sort()) {
    files.set(`${dir}${name}`, await readFile(join(dist, dir, name)))
  }
  return files
}

/**
 * What comparing a page needs beside the page itself, from the dists `ours` and
 * `theirs`: both builds' CSS bundles with the global stylesheets, read up front since
 * the comparison's hooks are synchronous.
 */
export async function bundlesIn(ours: string, theirs: string): Promise<Bundles> {
  return {
    ours: await filesIn(ours, '/assets/immutable/bundle/'),
    theirs: await filesIn(theirs, '/assets/immutable/11ty/bundle/'),
    globals: (await readStylesheets()).map(({ text }) => text.trim()).join('\n'),
  }
}

/** The rows of the expected table for a url no page compared has. */
export function staleRows(expected: Record<string, unknown>, urls: string[]): string[] {
  return Object.keys(expected).filter((url) => !urls.includes(url))
}

/** A class that fired other than the expected number of times on a page. */
export interface Miscount {
  name: string
  forgave: number
  expected: number
}

/** Every class whose count differs from `expected`, either way, by name. */
export function miscounts(
  expected: Record<string, number>,
  forgiven: Map<string, number>
): Miscount[] {
  return [...new Set([...Object.keys(expected), ...forgiven.keys()])]
    .sort()
    .map((name) => ({
      name,
      forgave: forgiven.get(name) ?? 0,
      expected: expected[name] ?? 0,
    }))
    .filter(({ forgave, expected }) => forgave !== expected)
}

export interface PageReport {
  url: string
  /** Which build has no page at this url, where one has none. */
  missing?: 'ours' | 'theirs'
  comparison?: Comparison
  miscounts: Miscount[]
  /** Why a class refused a difference, where it records that: css-bundle's. */
  refusals: string[]
}

export interface PageInput {
  url: string
  /** The page `lem build` wrote, or null. */
  ours: string | null
  /** The page Eleventy wrote, or null. */
  theirs: string | null
  /** The CSS bundles both builds wrote, and the global stylesheets. */
  css: Bundles
  /** The site's photos' titles, by alias. */
  titles: PhotoTitles
  /** How often each class should fire on this page. */
  expected: Record<string, number>
}

/** Compares the two builds' pages at one url, or reports the side that lacks it. */
export function comparePage({
  url,
  ours,
  theirs,
  css,
  titles,
  expected,
}: PageInput): PageReport {
  if (ours === null) return { url, missing: 'ours', miscounts: [], refusals: [] }
  if (theirs === null) return { url, missing: 'theirs', miscounts: [], refusals: [] }
  const { classes, refusals } = forgiveness(css, titles)
  const comparison = compareRendered(
    renderedPage(ours, { display: SITE_DISPLAY }),
    renderedPage(theirs, { display: SITE_DISPLAY }),
    classes
  )
  return { url, comparison, miscounts: miscounts(expected, comparison.forgiven), refusals }
}

/** Whether a page fails parity: missing on a side, unexplained, or miscounted. */
export function failed(report: PageReport): boolean {
  return (
    report.missing !== undefined ||
    (report.comparison?.differences.length ?? 0) > 0 ||
    report.miscounts.length > 0
  )
}

/**
 * The report of one page as printed: a summary line, then what fails it — each
 * unexplained difference first, since a refused subtree also moves counts, and why a
 * class refused one where it says so — then the counts.
 */
export function reportLines(
  report: PageReport,
  sides: { ours: string; theirs: string }
): string[] {
  const { url, comparison } = report
  if (comparison === undefined) {
    return [
      `${url}: FAIL, no page in ${report.missing === 'ours' ? sides.ours : sides.theirs}`,
    ]
  }
  const { matched, differences, forgiven } = comparison
  const verdict = failed(report) ? 'FAIL' : 'ok'
  const lines = [
    `${url}: ${verdict}, ${matched} matched, ${differences.length} unexplained`,
  ]
  for (const { path, ours, theirs, note } of differences) {
    lines.push(`  --- ${path}${note === undefined ? '' : ` (${note})`}`)
    lines.push(`  -${theirs ?? '(nothing)'}`)
    lines.push(`  +${ours ?? '(nothing)'}`)
  }
  for (const refusal of report.refusals) lines.push(`  ${refusal}`)
  for (const { name, forgave, expected } of report.miscounts) {
    lines.push(`  miscounted: ${name} forgave ${forgave}, expected ${expected}`)
  }
  if (forgiven.size > 0) {
    const counts = [...forgiven].sort(([a], [b]) => a.localeCompare(b))
    lines.push(`  forgiven: ${counts.map(([name, n]) => `${name} ${n}`).join(', ')}`)
  }
  return lines
}
