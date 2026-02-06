import {
  getCommitMessage,
  loadRevisions,
  saveRevisions,
  REVISIONS_PATH,
} from '../11ty/revisions.ts'

async function main() {
  const revisions = await loadRevisions()
  let updated = 0

  for (const entry of Object.values(revisions)) {
    for (const revision of entry.revisions) {
      if (!revision.message) {
        const message = getCommitMessage(revision.commit)
        if (message) {
          revision.message = message
          updated++
        }
      }
    }
  }

  await saveRevisions(revisions, REVISIONS_PATH)
  console.log(`Done. ${updated} revision message(s) backfilled.`)
}

main().catch((error: unknown) => {
  console.error(error)
  process.exit(1)
})
