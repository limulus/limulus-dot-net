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
}

export interface RevisionEntry {
  revisions: Revision[]
  teaserHash?: string
  generatedTeaserHash?: string
}

export interface RevisionsFile {
  versions: Record<string, RevisionVersion>
  entries: Record<string, RevisionEntry>
}

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

export function computeTeaserHash(teaser: string): string {
  const hash = createHash(HASH_ALGORITHM, {
    outputLength: HASH_OUTPUT_BYTES,
  })
  hash.update(teaser)
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
