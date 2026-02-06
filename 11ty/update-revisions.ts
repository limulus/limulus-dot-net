import { globby } from 'globby'
import matter from 'gray-matter'
import { readFile } from 'node:fs/promises'

import {
  HASH_ALGORITHM,
  HASH_OUTPUT_BYTES,
  computeHash,
  getCommitMessage,
  getCurrentCommit,
  hashFields,
  loadRevisions,
  saveRevisions,
} from './revisions.ts'

async function main() {
  const revisions = await loadRevisions()
  const commit = getCurrentCommit()

  const files = await globby('www/**/*.md')
  let revisionCount = 0

  for (const filePath of files) {
    const fileContent = await readFile(filePath, 'utf-8')
    const parsed = matter(fileContent)

    const tags: string[] = parsed.data.tags ?? []
    if (!tags.includes('article')) continue

    const title = parsed.data.title as string
    const subhead = parsed.data.subhead as string | undefined
    const content = parsed.content

    const hash = computeHash(title, subhead, content)
    const fields = hashFields(subhead)

    const entry = revisions[filePath] ?? { revisions: [] }
    const latestRevision = entry.revisions[entry.revisions.length - 1]

    if (!latestRevision || latestRevision.hash !== hash) {
      const message = getCommitMessage(commit)
      entry.revisions.push({
        hash,
        algorithm: HASH_ALGORITHM,
        outputBytes: HASH_OUTPUT_BYTES,
        fields,
        separator: '\\n',
        date: new Date().toISOString(),
        commit,
        ...(message && { message }),
      })
      revisions[filePath] = entry
      revisionCount++
    }
  }

  await saveRevisions(revisions)
  console.log(`Done. ${revisionCount} revision(s) recorded.`)
}

main().catch((error: unknown) => {
  console.error(error)
  process.exit(1)
})
