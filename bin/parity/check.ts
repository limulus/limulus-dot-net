// What `npm run parity` does with each post: find it in both builds, compare the two
// pages as rendered HTML through the allowlist, and hold every class to its expected
// count, as lemmon's fidelity harness does for its own page.

import { compareRendered, renderedPage, type Comparison } from '@limulus/lemmon-shell'
import { readdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'

import {
  feedCards,
  forgiveness,
  SITE_DISPLAY,
  type Bundles,
  type ReferenceCard,
} from './classes.ts'
import { readStylesheets } from '../lemmon-css.ts'

/** The url of each post a build wrote: every directory under `feed/` with a page. */
export async function postsIn(dist: string): Promise<string[]> {
  const feed = join(dist, 'feed')
  const entries = await readdir(feed, { withFileTypes: true }).catch(
    (error: NodeJS.ErrnoException) => {
      if (error.code === 'ENOENT') return []
      throw error
    }
  )
  const urls: string[] = []
  for (const entry of entries) {
    if (entry.isDirectory() && (await pageAt(dist, `/feed/${entry.name}/`)) !== null) {
      urls.push(`/feed/${entry.name}/`)
    }
  }
  return urls.sort()
}

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

/** Every feed post's card from the page of Eleventy's feed index, if there is one. */
export function referenceFeed(index: string | null): ReferenceCard[] | null {
  return index === null ? null : feedCards(renderedPage(index, { display: SITE_DISPLAY }))
}

/**
 * What comparing a post needs beside its two pages, from the dists `ours` and `theirs`:
 * every feed post's card on Eleventy's feed index (null without one), and both builds'
 * CSS bundles with the global stylesheets, read up front since the comparison's hooks
 * are synchronous.
 */
export async function siteInputs(
  ours: string,
  theirs: string
): Promise<{ feed: ReferenceCard[] | null; css: Bundles }> {
  return {
    feed: referenceFeed(await pageAt(theirs, '/feed/')),
    css: {
      ours: await filesIn(ours, '/assets/immutable/bundle/'),
      theirs: await filesIn(theirs, '/assets/immutable/11ty/bundle/'),
      globals: (await readStylesheets()).map(({ text }) => text.trim()).join('\n'),
    },
  }
}

/** The rows of the expected table for a url neither build wrote. */
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

export interface PostInput {
  url: string
  /** The page `lem build` wrote, or null. */
  ours: string | null
  /** The page Eleventy wrote, or null. */
  theirs: string | null
  /** The card of every feed post, from Eleventy's feed index. */
  feed: ReferenceCard[]
  /** The CSS bundles both builds wrote, and the global stylesheets. */
  css: Bundles
  /** How often each class should fire on this page. */
  expected: Record<string, number>
}

/** Compares one post's two pages, or reports the side that lacks it. */
export function comparePost({
  url,
  ours,
  theirs,
  feed,
  css,
  expected,
}: PostInput): PageReport {
  if (ours === null) return { url, missing: 'ours', miscounts: [], refusals: [] }
  if (theirs === null) return { url, missing: 'theirs', miscounts: [], refusals: [] }
  const { classes, refusals } = forgiveness({ url, feed, css })
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
