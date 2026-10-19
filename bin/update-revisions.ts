import { listArticles } from './revisions/articles.ts'
import {
  computeHash,
  getCommitMessage,
  getCurrentCommit,
  loadRevisions,
  saveRevisions,
} from './revisions/revisions.ts'

async function main() {
  const revisions = await loadRevisions()
  const commit = getCurrentCommit()

  const articles = await listArticles()
  let revisionCount = 0

  for (const { path, title, subhead, content } of articles) {
    const hash = computeHash(title, subhead, content)

    const entry = revisions.entries[path] ?? { revisions: [] }
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
      revisions.entries[path] = entry
      revisionCount++
      console.log(`${path}: ${hash}`)
    }
  }

  // Nothing new leaves the file as it was, untouched for the watchers of `www/`.
  if (revisionCount > 0) await saveRevisions(revisions)
  console.log(`Done. ${revisionCount} revision(s) recorded.`)
}

main().catch((error: unknown) => {
  console.error(error)
  process.exit(1)
})
