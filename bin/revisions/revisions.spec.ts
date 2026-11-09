import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, it, expect } from 'vitest'

import { readArticle } from './articles.ts'
import {
  computeHash,
  isQuiet,
  REVISIONS_PATH,
  type Revision,
  type RevisionsFile,
} from './revisions.ts'

const ROOT = fileURLToPath(new URL('../../', import.meta.url))

describe('computeHash', () => {
  it('produces a 12-character hex string', () => {
    const hash = computeHash('Title', undefined, 'Body content')
    expect(hash).toMatch(/^[0-9a-f]{12}$/)
  })

  it('produces different hashes for different content', () => {
    const hash1 = computeHash('Title', undefined, 'Body A')
    const hash2 = computeHash('Title', undefined, 'Body B')
    expect(hash1).not.toBe(hash2)
  })

  it('includes subhead in hash when present', () => {
    const hashWithout = computeHash('Title', undefined, 'Body')
    const hashWith = computeHash('Title', 'Subhead', 'Body')
    expect(hashWithout).not.toBe(hashWith)
  })

  it('should hash the fields joined by newlines, as shake128 to six bytes', () => {
    const asWritten = createHash('shake128', { outputLength: 6 })
      .update(['Title', 'Sub', 'Prose.\n\n<lem.chipList(null, raw(""))>\n'].join('\n'))
      .digest('hex')
    expect(computeHash('Title', 'Sub', 'Prose.\n\n<lem.chipList(null, raw(""))>\n')).toBe(
      asWritten
    )
  })

  it('is deterministic', () => {
    const hash1 = computeHash('Title', 'Sub', 'Body')
    const hash2 = computeHash('Title', 'Sub', 'Body')
    expect(hash1).toBe(hash2)
  })
})

describe('isQuiet', () => {
  it('should be false for a message with no Revision trailer', () => {
    expect(isQuiet('fix: a typo in the-rebound\n\nThe second paragraph.\n')).toBe(false)
  })

  it('should be true for one whose Revision trailer reads quiet', () => {
    expect(isQuiet('fix: reflow the-rebound\n\nRevision: quiet\n')).toBe(true)
  })

  it('should read the trailer beside others, its key in any case', () => {
    const message = 'Merge branch lemmon-cutover\n\nSee-also: oAl\nrevision: quiet\n'
    expect(isQuiet(message)).toBe(true)
  })

  it('should not take the words in a paragraph above the trailers as a trailer', () => {
    const message =
      'docs: say what a quiet revision is\n\nRevision: quiet\nkeeps one off the page.\n\n' +
      'See-also: oAl\n'
    expect(isQuiet(message)).toBe(false)
  })

  it('should refuse a Revision trailer reading anything else, naming the value', () => {
    expect(() => isQuiet('fix: reflow the-rebound\n\nRevision: quite\n')).toThrow(
      'a Revision trailer takes only "quiet", not "quite"'
    )
  })
})

/** Whether this repository holds `commit`. */
function holds(commit: string): boolean {
  try {
    execFileSync('git', ['cat-file', '-e', `${commit}^{commit}`], {
      cwd: ROOT,
      stdio: 'ignore',
    })
    return true
  } catch {
    return false
  }
}

/** A check of one entry's latest revision, and whether it is skipped. */
interface RevisionCase {
  path: string
  revision: Revision
  title: string
  skip: boolean
}

/**
 * A check of each entry's latest revision, skipped where this repository lacks its commit
 * — a squash merge orphans the commit a branch's deploy recorded, and a gc removes it —
 * with a title saying so, since a failure there would block every push until
 * revisions.json was edited by hand.
 */
function latestRevisionCases(
  entries: RevisionsFile['entries'],
  has: (commit: string) => boolean
): RevisionCase[] {
  return Object.entries(entries).map(([path, { revisions }]) => {
    const revision = revisions[revisions.length - 1]
    return has(revision.commit)
      ? {
          path,
          revision,
          title: `should hash ${path}, as ${revision.commit} holds it, to ${revision.hash}`,
          skip: false,
        }
      : {
          path,
          revision,
          title: `cannot check ${path}: this repository lacks its commit ${revision.commit}`,
          skip: true,
        }
  })
}

describe('latestRevisionCases', () => {
  const head = execFileSync('git', ['rev-parse', '--short', 'HEAD'], {
    cwd: ROOT,
    encoding: 'utf8',
  }).trim()
  const revision = (commit: string): Revision => ({ v: 1, hash: '0', date: '', commit })
  const cases = latestRevisionCases(
    {
      'www/feed/held.md': { revisions: [revision('0000000'), revision(head)] },
      'www/feed/lost.md': { revisions: [revision(head), revision('0000000')] },
    },
    holds
  )

  it('should check an entry whose latest commit this repository holds', () => {
    expect(cases[0]).toMatchObject({ path: 'www/feed/held.md', skip: false })
  })

  it('should skip one whose latest commit it lacks, naming the commit', () => {
    expect(cases[1]).toMatchObject({
      path: 'www/feed/lost.md',
      title: 'cannot check www/feed/lost.md: this repository lacks its commit 0000000',
      skip: true,
    })
  })
})

// Against the article as the commit that recorded each hash holds it, not as the working
// tree does: an edit not yet deployed has no recorded hash, and would fail the push that
// deploys it. A shallow clone holds none of those commits.
const SHALLOW =
  execFileSync('git', ['rev-parse', '--is-shallow-repository'], {
    cwd: ROOT,
    encoding: 'utf8',
  }).trim() === 'true'

describe.skipIf(SHALLOW)(
  'the latest revision recorded for each article' +
    (SHALLOW ? ', skipped: a shallow clone lacks the commits that recorded them' : ''),
  () => {
    const { entries } = JSON.parse(
      readFileSync(new URL(`../../${REVISIONS_PATH}`, import.meta.url), 'utf8')
    ) as RevisionsFile

    for (const check of latestRevisionCases(entries, holds)) {
      it.skipIf(check.skip)(check.title, () => {
        const { path, revision } = check
        const text = execFileSync('git', ['show', `${revision.commit}:${path}`], {
          cwd: ROOT,
          encoding: 'utf8',
        })
        const { title, subhead, content } = readArticle(path, text)
        expect(computeHash(title, subhead, content)).toBe(revision.hash)
      })
    }
  }
)
