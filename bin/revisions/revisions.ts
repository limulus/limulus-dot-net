import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { readFile, writeFile } from 'node:fs/promises'

export const REVISIONS_PATH = 'www/_data/revisions.json'

const HASH_ALGORITHM = 'shake128'
const HASH_OUTPUT_BYTES = 6

export interface RevisionVersion {
  algorithm: string
  outputBytes: number
  fields: string[]
  separator: string
}

export interface Revision {
  v: number
  hash: string
  date: string
  commit: string
  message?: string
  /** Recorded but listed nowhere a reader sees ({@link isQuiet}); written only when true. */
  quiet?: boolean
}

export interface RevisionEntry {
  revisions: Revision[]
}

export interface RevisionsFile {
  versions: Record<string, RevisionVersion>
  entries: Record<string, RevisionEntry>
}

/** The revision hash of a post: its title, subhead, and content. */
export function computeHash(
  title: string,
  subhead: string | undefined,
  content: string
): string {
  const fields = subhead != null ? [title, subhead, content] : [title, content]
  const input = fields.join('\n')
  const hash = createHash(HASH_ALGORITHM, {
    outputLength: HASH_OUTPUT_BYTES,
  })
  hash.update(input)
  return hash.digest('hex')
}

export function getCurrentCommit(): string {
  const sha = process.env.GITHUB_SHA
  if (sha) return sha.slice(0, 7)

  try {
    return execFileSync('git', ['rev-parse', '--short', 'HEAD'], {
      encoding: 'utf-8',
    }).trim()
  } catch {
    return 'unknown'
  }
}

export function getCommitMessage(commit: string): string {
  try {
    return execFileSync('git', ['log', '--format=%s', '-1', commit], {
      encoding: 'utf-8',
    }).trim()
  } catch {
    return ''
  }
}

/** `commit`'s whole message, its trailers included. */
export function getCommitBody(commit: string): string {
  return execFileSync('git', ['log', '--format=%B', '-1', commit], { encoding: 'utf-8' })
}

/** The one value a `Revision` trailer takes. */
const QUIET = 'quiet'

/**
 * Whether the revisions a commit records are quiet: recorded, so that the next deploy finds
 * nothing new, but listed nowhere a reader sees. A `Revision: quiet` trailer in the commit's
 * `message`, as git parses trailers, makes them so. A `Revision` trailer reading anything
 * else throws, so that a mistyped one stops the deploy instead of listing what it was
 * written to keep quiet.
 */
export function isQuiet(message: string): boolean {
  const trailers = execFileSync('git', ['interpret-trailers', '--parse', '--no-divider'], {
    input: message,
    encoding: 'utf-8',
  })
  const values = trailers.split('\n').flatMap((line) => {
    const colon = line.indexOf(':')
    const key = line.slice(0, colon).trim().toLowerCase()
    return colon > 0 && key === 'revision' ? [line.slice(colon + 1).trim()] : []
  })
  const other = values.find((value) => value !== QUIET)
  if (other !== undefined) {
    throw new Error(`a Revision trailer takes only "${QUIET}", not "${other}"`)
  }
  return values.length > 0
}

export async function loadRevisions(path: string = REVISIONS_PATH): Promise<RevisionsFile> {
  try {
    const content = await readFile(path, 'utf-8')
    return JSON.parse(content) as RevisionsFile
  } catch {
    return { versions: {}, entries: {} }
  }
}

export async function saveRevisions(
  revisions: RevisionsFile,
  path: string = REVISIONS_PATH
): Promise<void> {
  const sortedEntries: Record<string, RevisionEntry> = {}
  for (const key of Object.keys(revisions.entries).sort()) {
    sortedEntries[key] = revisions.entries[key]
  }
  const output: RevisionsFile = {
    versions: revisions.versions,
    entries: sortedEntries,
  }
  await writeFile(path, JSON.stringify(output, null, 2) + '\n')
}
