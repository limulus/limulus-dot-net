// What a build wrote, as files: every one under its dist, read by url, and two builds'
// files compared byte for byte — the script files' rule and the passthrough files'.

import { readdir, readFile } from 'node:fs/promises'
import { join, relative, sep } from 'node:path'

/**
 * The url of every file under `dir` at any depth, sorted: whatever is no directory, a
 * symbolic link among them, so that nothing a build wrote goes unlisted. None where
 * there is no such directory.
 */
export async function everyFile(dir: string): Promise<string[]> {
  const found = await readdir(dir, { recursive: true, withFileTypes: true }).catch(
    (error: NodeJS.ErrnoException) => {
      if (error.code === 'ENOENT') return []
      throw error
    }
  )
  return found
    .filter((entry) => !entry.isDirectory())
    .map((entry) => `/${relative(dir, join(entry.parentPath, entry.name))}`)
    .map((url) => url.split(sep).join('/'))
    .sort()
}

/** Every file under `dist` that `take` takes, keyed by its url, read as bytes. */
export async function filesWhere(
  dist: string,
  take: (url: string) => boolean
): Promise<Map<string, Buffer>> {
  const files = new Map<string, Buffer>()
  for (const url of (await everyFile(dist)).filter(take)) {
    files.set(url, await readFile(join(dist, url)))
  }
  return files
}

/** A file only one build wrote, or both wrote differently. */
export interface FileDifference {
  url: string
  /** The build that alone wrote it, or `both` where their bytes differ. */
  in: 'ours' | 'theirs' | 'both'
  /** Where the bytes part, and how long each is, where both wrote it. */
  detail?: string
}

/** How two builds' files compare byte for byte. */
export interface BytesReport {
  /** How many files both wrote, byte for byte alike. */
  identical: number
  /** The url of each file only Eleventy wrote that the rule compareBytes had set aside. */
  setAside: string[]
  differences: FileDifference[]
}

/**
 * Which file only Eleventy wrote to set aside rather than report: given its url, its
 * bytes, and every file of the kind Eleventy wrote.
 */
export type SetAside = (url: string, bytes: Buffer, theirs: Map<string, Buffer>) => boolean

/** The first byte at which `a` and `b` differ, or where the shorter ends. */
function firstDifference(a: Buffer, b: Buffer): number {
  const length = Math.min(a.length, b.length)
  for (let at = 0; at < length; at += 1) if (a[at] !== b[at]) return at
  return length
}

/**
 * Compares both builds' files, `ours` from `lem build` and `theirs` Eleventy's, by url:
 * a file only one wrote is a difference, unless only Eleventy wrote it and `setAside`
 * takes it, and a file both wrote is alike only byte for byte.
 */
export function compareBytes(
  ours: Map<string, Buffer>,
  theirs: Map<string, Buffer>,
  setAside: SetAside = () => false
): BytesReport {
  const report: BytesReport = { identical: 0, setAside: [], differences: [] }
  const urls = [...new Set([...ours.keys(), ...theirs.keys()])].sort()
  for (const url of urls) {
    const o = ours.get(url)
    const t = theirs.get(url)
    if (o === undefined && t !== undefined && setAside(url, t, theirs)) {
      report.setAside.push(url)
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

/** Whether a byte comparison fails parity: a difference, or nothing compared at all. */
export const bytesFailed = (report: BytesReport): boolean =>
  report.differences.length > 0 || report.identical === 0

/**
 * The report as printed under `label`: a summary line, saying what was set aside as
 * `setAsideAs` names it where it is given and failing where `failed` says, then each
 * difference.
 */
export function bytesLines(
  label: string,
  report: BytesReport,
  sides: { ours: string; theirs: string },
  setAsideAs?: string,
  failed = bytesFailed(report)
): string[] {
  const { identical, setAside, differences } = report
  const set = setAsideAs === undefined ? '' : `; ${setAside.length} ${setAsideAs}`
  if (identical === 0 && differences.length === 0) {
    return [`${label}: FAIL, neither build wrote any${set}`]
  }
  const verdict = failed ? 'FAIL' : 'ok'
  const lines = [
    `${label}: ${verdict}, ${identical} files alike byte for byte, ` +
      `${differences.length} differ${set}`,
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
