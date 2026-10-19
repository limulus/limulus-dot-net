// What `npm run parity` does with each page: find it in both builds, compare the two as
// rendered HTML through the allowlist, and hold every class to its expected count, as
// lemmon's fidelity harness does for its own page.

import { compareRendered, renderedPage, type Comparison } from '@limulus/lemmon-shell'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'

import { forgiveness, isBundle, SITE_DISPLAY, type Bundles } from './classes.ts'
import { everyFile, filesWhere } from './files.ts'
import { readStylesheets } from '../lemmon-css.ts'

/** Whether the file at `url` is a page: an `index.html` at any depth. */
export const isPage = (url: string): boolean => url.endsWith('/index.html')

/**
 * The url of every page the build in `dist` wrote, sorted — its directory's, `/` for the
 * root's — and none where it wrote no such directory. Any other `.html` file is in no
 * category, which fails the run (inventory.ts).
 */
export async function pagesIn(dist: string): Promise<string[]> {
  return (await everyFile(dist))
    .filter(isPage)
    .map((url) => url.slice(0, -'index.html'.length))
    .sort()
}

/**
 * The pages to compare, sorted: every url either build wrote a page at (`ours` and
 * `theirs`), once. A page only one build wrote is compared, and fails as missing from
 * the other.
 */
export const rosterOf = (ours: string[], theirs: string[]): string[] =>
  [...new Set([...ours, ...theirs])].sort()

/**
 * The page the build in `dist` wrote for `url`, or null where `pages`, its pagesIn(),
 * does not hold the url exactly. The listing decides, not opening the file: this
 * machine's file system finds a name in another letter case or Unicode form, and S3,
 * which serves the site, does not.
 */
export async function pageAt(
  dist: string,
  url: string,
  pages: readonly string[]
): Promise<string | null> {
  return pages.includes(url) ? readFile(join(dist, url, 'index.html'), 'utf8') : null
}

/**
 * What comparing a page needs beside the page itself, from the dists `ours` and
 * `theirs`: both builds' CSS bundles with the global stylesheets, read up front since
 * the comparison's hooks are synchronous, and nothing yet linked.
 */
export async function bundlesIn(ours: string, theirs: string): Promise<Bundles> {
  return {
    ours: await filesWhere(ours, (url) => isBundle(url, 'ours')),
    theirs: await filesWhere(theirs, (url) => isBundle(url, 'theirs')),
    globals: (await readStylesheets()).map(({ text }) => text.trim()).join('\n'),
    linked: new Set(),
  }
}

/**
 * Every bundle, either build's, that no page compared linked once the pages have
 * compared: one parity never looked inside, which fails the run.
 */
export const unlinked = (css: Bundles): string[] =>
  [...css.ours.keys(), ...css.theirs.keys()].filter((url) => !css.linked.has(url))

/** The bundles as printed once the pages have compared: a summary, each unlinked. */
export function bundleLines(
  css: Bundles,
  sides: { ours: string; theirs: string }
): string[] {
  const missed = unlinked(css)
  const lines = [
    `bundles: ${missed.length === 0 ? 'ok' : 'FAIL'}, ${css.ours.size} in ${sides.ours} ` +
      `and ${css.theirs.size} in ${sides.theirs}, ${missed.length} linked by no page`,
  ]
  for (const url of missed) {
    lines.push(`  ${css.ours.has(url) ? sides.ours : sides.theirs}${url}`)
  }
  return lines
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
  /** How often each class should fire on this page. */
  expected: Record<string, number>
}

/** Compares the two builds' pages at one url, or reports the side that lacks it. */
export function comparePage({ url, ours, theirs, css, expected }: PageInput): PageReport {
  if (ours === null) return { url, missing: 'ours', miscounts: [], refusals: [] }
  if (theirs === null) return { url, missing: 'theirs', miscounts: [], refusals: [] }
  const { classes, refusals } = forgiveness(css)
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
