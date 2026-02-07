import matter from 'gray-matter'
import { execFileSync } from 'node:child_process'

import { getArticles } from '../11ty/get-articles.ts'
import {
  type RevisionsFile,
  REVISIONS_PATH,
  computeHash,
  saveRevisions,
} from '../11ty/revisions.ts'

interface GitLogEntry {
  sha: string
  shortSha: string
  date: string
}

function getGitLog(filePath: string): GitLogEntry[] {
  const output = execFileSync(
    'git',
    ['log', '--format=%H %h %aI', '--follow', '--', filePath],
    { encoding: 'utf-8' }
  )

  const entries: GitLogEntry[] = []
  for (const line of output.trim().split('\n')) {
    if (!line) continue
    const [sha, shortSha, date] = line.split(' ')
    entries.push({ sha, shortSha, date })
  }

  // Reverse to oldest-first
  entries.reverse()
  return entries
}

function getFileAtCommit(sha: string, filePath: string): string | null {
  try {
    return execFileSync('git', ['show', `${sha}:${filePath}`], {
      encoding: 'utf-8',
    })
  } catch {
    return null
  }
}

async function main() {
  const articles = await getArticles()
  const revisions: RevisionsFile = {
    versions: {
      '1': {
        algorithm: 'shake128',
        outputBytes: 6,
        fields: ['title', 'subhead', 'content'],
        separator: '\n',
      },
    },
    entries: {},
  }

  let totalFiles = 0
  let totalRevisions = 0

  for (const { filePath } of articles) {
    totalFiles++
    const logEntries = getGitLog(filePath)

    if (logEntries.length === 0) {
      console.log(`[skip] ${filePath}: no git history`)
      continue
    }

    const entry: RevisionsFile['entries'][string] = { revisions: [] }
    let previousHash: string | null = null

    for (const logEntry of logEntries) {
      const content = getFileAtCommit(logEntry.sha, filePath)
      if (content === null) continue

      let parsed: matter.GrayMatterFile<string>
      try {
        parsed = matter(content)
      } catch {
        continue
      }

      const title = parsed.data.title as string | undefined
      if (!title) continue

      const subhead = parsed.data.subhead as string | undefined
      const hash = computeHash(title, subhead, parsed.content)

      if (hash === previousHash) continue

      entry.revisions.push({
        v: 1,
        hash,
        date: logEntry.date,
        commit: logEntry.shortSha,
      })
      previousHash = hash
      totalRevisions++
    }

    if (entry.revisions.length > 0) {
      revisions.entries[filePath] = entry
    }
  }

  await saveRevisions(revisions, REVISIONS_PATH)
  console.log(
    `Done. ${totalFiles} article(s) processed,` + ` ${totalRevisions} revision(s) recorded.`
  )
}

main().catch((error: unknown) => {
  console.error(error)
  process.exit(1)
})
