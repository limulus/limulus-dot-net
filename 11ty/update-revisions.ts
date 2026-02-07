import { getArticles } from './get-articles.ts'
import {
  computeHash,
  getCommitMessage,
  getCurrentCommit,
  loadRevisions,
  saveRevisions,
} from './revisions.ts'

async function main() {
  const revisions = await loadRevisions()
  const commit = getCurrentCommit()

  const articles = await getArticles()
  let revisionCount = 0

  for (const { filePath, data, content } of articles) {
    const title = data.title as string
    const subhead = data.subhead as string | undefined

    const hash = computeHash(title, subhead, content)

    const entry = revisions.entries[filePath] ?? { revisions: [] }
    const latestRevision = entry.revisions[entry.revisions.length - 1]

    if (!latestRevision || latestRevision.hash !== hash) {
      const message = getCommitMessage(commit)
      entry.revisions.push({
        v: 1,
        hash,
        date: new Date().toISOString(),
        commit,
        ...(message && { message }),
      })
      revisions.entries[filePath] = entry
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
