// What `npm run parity` holds the client scripts to: every file both builds wrote for an
// entry point esbuild bundles — wherever under www/ its source stands, each bundle hashed
// beside it, its styles and their source maps — and under esbuild's asset path, the
// `.wasm` a worker imports, compared byte for byte. A bundle's name is a hash of what
// esbuild was given, and the pages compare script URLs exactly, so a bundle that differs
// in one byte is a bundle the pages would not load.
//
// Eleventy's build (11ty/esbuild.ts) also writes an unhashed stub beside every bundle,
// `/lib/x/index.js` holding `export * from '/lib/x/index.HASH.js'`, which the shell's
// esbuild() does not (the lemmon repo's D45: every reference is hashed, so nothing loads
// one). Each stub is set aside by what it must hold, never by where it stands, and
// counted in the report.

import { readdir, readFile } from 'node:fs/promises'
import { join, posix, relative, sep } from 'node:path'

/** Where esbuild writes a file a bundle imports: lemmon.config.ts's `assetNames`. */
export const ESBUILD_ASSETS = '/assets/immutable/11ty/esbuild/'

/** An entry point, as esbuild()'s default globs and 11ty/esbuild.ts's name them. */
const ENTRY = /^(?:index|worker)\.ts$/i

/**
 * The entry points esbuild bundles in the input directory `input` — every `index.ts` and
 * `worker.ts` at any depth, as both builds glob them — each as the url its outputs are
 * named from: `www/lib/x/index.ts` as `/lib/x/index`.
 */
export async function entriesIn(input: string): Promise<Set<string>> {
  const paths = (await readdir(input, { recursive: true })).map((path) =>
    path.split(sep).join('/')
  )
  return new Set(
    paths
      .filter((path) => ENTRY.test(posix.basename(path)))
      .map((path) => `/${path.slice(0, -3)}`)
  )
}

/** An output named from an entry: its stem, a hash, and `.js` or `.css`, or a map. */
const OUTPUT = /^(.+)\.[A-Z0-9]{8}\.(?:js|css)(?:\.map)?$/

/**
 * Whether the file at `url` is one a build's esbuild step writes for one of `entries`:
 * an entry's bundle, its styles or a source map, named by a hash beside its source, or
 * the unhashed `….js` Eleventy writes there; or a file under esbuild's asset path.
 */
export function isScriptFile(url: string, entries: ReadonlySet<string>): boolean {
  if (url.startsWith(ESBUILD_ASSETS)) return true
  const stem = OUTPUT.exec(url)?.[1] ?? (url.endsWith('.js') ? url.slice(0, -3) : undefined)
  return stem !== undefined && entries.has(stem)
}

/**
 * Every script file a build wrote under `dist` for `entries`, keyed by its url, read as
 * bytes.
 */
export async function scriptsIn(
  dist: string,
  entries: ReadonlySet<string>
): Promise<Map<string, Buffer>> {
  const found = await readdir(dist, { recursive: true, withFileTypes: true })
  const urls = found
    .filter((entry) => entry.isFile())
    .map((entry) => `/${relative(dist, join(entry.parentPath, entry.name))}`)
    .map((url) => url.split(sep).join('/'))
    .filter((url) => isScriptFile(url, entries))
    .sort()
  const files = new Map<string, Buffer>()
  for (const url of urls) files.set(url, await readFile(join(dist, url)))
  return files
}

const STUB = /^export \* from '([^']+)'$/
const HASH = /\.[A-Z0-9]{8}\.js$/

/**
 * Whether Eleventy's file at `url` is one of its stubs: an unhashed `….js` holding
 * exactly `export * from '<url>'` of the bundle hashed beside it, which `theirs` holds.
 */
export function isStub(url: string, bytes: Buffer, theirs: Map<string, Buffer>): boolean {
  const target = STUB.exec(bytes.toString('utf8'))?.[1]
  return (
    target !== undefined &&
    HASH.test(target) &&
    target.replace(HASH, '.js') === url &&
    theirs.has(target)
  )
}

/** A script file only one build wrote, or both wrote differently. */
export interface ScriptDifference {
  url: string
  /** The build that alone wrote it, or `both` where their bytes differ. */
  in: 'ours' | 'theirs' | 'both'
  /** Where the bytes part, and how long each is, where both wrote it. */
  detail?: string
}

/** How the two builds' script files compare. */
export interface ScriptsReport {
  /** How many files both wrote, byte for byte alike. */
  identical: number
  /** How many of Eleventy's stubs were set aside. */
  stubs: number
  differences: ScriptDifference[]
}

/** The first byte at which `a` and `b` differ, or where the shorter ends. */
function firstDifference(a: Buffer, b: Buffer): number {
  const length = Math.min(a.length, b.length)
  for (let at = 0; at < length; at += 1) if (a[at] !== b[at]) return at
  return length
}

/** Compares both builds' script files, `ours` from `lem build` and `theirs` Eleventy's. */
export function compareScripts(
  ours: Map<string, Buffer>,
  theirs: Map<string, Buffer>
): ScriptsReport {
  const report: ScriptsReport = { identical: 0, stubs: 0, differences: [] }
  const urls = [...new Set([...ours.keys(), ...theirs.keys()])].sort()
  for (const url of urls) {
    const o = ours.get(url)
    const t = theirs.get(url)
    if (o === undefined && t !== undefined && isStub(url, t, theirs)) {
      report.stubs += 1
    } else if (o === undefined) {
      report.differences.push({ url, in: 'theirs' })
    } else if (t === undefined) {
      report.differences.push({ url, in: 'ours' })
    } else if (o.equals(t)) {
      report.identical += 1
    } else {
      const detail =
        `from byte ${firstDifference(o, t)}; ` +
        `ours ${o.length} bytes, theirs ${t.length}`
      report.differences.push({ url, in: 'both', detail })
    }
  }
  return report
}

/** Whether the scripts fail parity: a difference, or nothing compared at all. */
export const scriptsFailed = (report: ScriptsReport): boolean =>
  report.differences.length > 0 || report.identical === 0

/** The report as printed: a summary line, then each difference. */
export function scriptLines(
  report: ScriptsReport,
  sides: { ours: string; theirs: string }
): string[] {
  const { identical, stubs, differences } = report
  const set = `${stubs} of Eleventy's unhashed stubs set aside`
  if (identical === 0 && differences.length === 0) {
    return [`scripts: FAIL, neither build wrote a script file; ${set}`]
  }
  const verdict = scriptsFailed(report) ? 'FAIL' : 'ok'
  const lines = [
    `scripts: ${verdict}, ${identical} files alike byte for byte, ` +
      `${differences.length} differ; ${set}`,
  ]
  for (const difference of differences) {
    const why =
      difference.in === 'both'
        ? `differs ${difference.detail}`
        : `only in ${sides[difference.in]}`
    lines.push(`  ${difference.url}: ${why}`)
  }
  return lines
}
