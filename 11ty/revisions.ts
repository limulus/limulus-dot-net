import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { readFile, writeFile } from 'node:fs/promises'

export const HASH_ALGORITHM = 'shake128'
export const HASH_OUTPUT_BYTES = 6
export const REVISIONS_PATH = 'www/_data/revisions.json'

export interface Revision {
  hash: string
  algorithm: string
  outputBytes: number
  fields: string[]
  separator: string
  date: string
  commit: string
  message?: string
}

export interface RevisionEntry {
  revisions: Revision[]
  teaserHash?: string
  generatedTeaserHash?: string
}

export type RevisionsFile = Record<string, RevisionEntry>

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

export function hashFields(subhead: string | undefined): string[] {
  return subhead != null ? ['title', 'subhead', 'content'] : ['title', 'content']
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
    return {}
  }
}

export async function saveRevisions(
  revisions: RevisionsFile,
  path: string = REVISIONS_PATH
): Promise<void> {
  const sorted: RevisionsFile = {}
  for (const key of Object.keys(revisions).sort()) {
    sorted[key] = revisions[key]
  }
  await writeFile(path, JSON.stringify(sorted, null, 2) + '\n')
}
