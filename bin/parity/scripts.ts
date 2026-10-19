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
// counted in the report; an entry bundle Eleventy wrote without one beside it fails.

import { readdir } from 'node:fs/promises'
import { posix, sep } from 'node:path'

import {
  bytesFailed,
  bytesLines,
  compareBytes,
  filesWhere,
  type BytesReport,
} from './files.ts'

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
export const scriptsIn = (
  dist: string,
  entries: ReadonlySet<string>
): Promise<Map<string, Buffer>> => filesWhere(dist, (url) => isScriptFile(url, entries))

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

/** How the two builds' script files compare. */
export interface ScriptsReport extends BytesReport {
  /**
   * Each bundle Eleventy wrote for an entry whose stub was not set aside: 11ty/esbuild.ts
   * writes one beside every entry bundle it writes, so a stub missing, or one ours wrote
   * too, leaves its bundle here.
   */
  unstubbed: string[]
}

/**
 * Compares both builds' script files for `entries`, `ours` from `lem build` and `theirs`
 * Eleventy's, byte for byte, setting Eleventy's stubs aside, one per entry bundle it
 * wrote.
 */
export function compareScripts(
  ours: Map<string, Buffer>,
  theirs: Map<string, Buffer>,
  entries: ReadonlySet<string>
): ScriptsReport {
  const report = compareBytes(ours, theirs, isStub)
  const unstubbed = [...theirs.keys()].filter(
    (url) =>
      HASH.test(url) &&
      entries.has(url.replace(HASH, '')) &&
      !report.setAside.includes(url.replace(HASH, '.js'))
  )
  return { ...report, unstubbed }
}

/** Whether the scripts fail parity: as any byte comparison does, or a stub unset. */
export const scriptsFailed = (report: ScriptsReport): boolean =>
  bytesFailed(report) || report.unstubbed.length > 0

/** The report as printed: a summary line, then each difference and bundle unstubbed. */
export function scriptLines(
  report: ScriptsReport,
  sides: { ours: string; theirs: string }
): string[] {
  const set = "of Eleventy's unhashed stubs set aside"
  const lines = bytesLines('scripts', report, sides, set, scriptsFailed(report))
  for (const url of report.unstubbed) {
    lines.push(`  ${url}: Eleventy's entry bundle, with no stub set aside beside it`)
  }
  return lines
}
