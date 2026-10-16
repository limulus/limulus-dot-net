import { describe, it, expect } from 'vitest'

import { computeHash } from './revisions.ts'

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

  it('hashes a post with a lem call as the same post with its WebC form', () => {
    const lem = 'Prose.\n\n<lem.articlePhoto(site.photos["middle-falls"], .left)>\n'
    const webc =
      "Prose.\n\n{% renderTemplate 'webc' %}\n" +
      '<article-photo id="middle-falls" placement="left"></article-photo>\n' +
      '{% endrenderTemplate %}\n'
    expect(computeHash('Title', 'Sub', lem)).toBe(computeHash('Title', 'Sub', webc))
  })

  it('is deterministic', () => {
    const hash1 = computeHash('Title', 'Sub', 'Body')
    const hash2 = computeHash('Title', 'Sub', 'Body')
    expect(hash1).toBe(hash2)
  })
})
