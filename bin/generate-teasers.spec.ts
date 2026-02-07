import matter from 'gray-matter'
import { describe, it, expect } from 'vitest'

import {
  decideTeaserAction,
  insertTeaserIntoFrontmatter,
  wrapText,
} from './generate-teasers.ts'
import { computeHash, hashFields } from '../11ty/revisions.ts'

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

  it('is deterministic', () => {
    const hash1 = computeHash('Title', 'Sub', 'Body')
    const hash2 = computeHash('Title', 'Sub', 'Body')
    expect(hash1).toBe(hash2)
  })
})

describe('hashFields', () => {
  it('returns title and content when no subhead', () => {
    expect(hashFields(undefined)).toEqual(['title', 'content'])
  })

  it('includes subhead when present', () => {
    expect(hashFields('A subhead')).toEqual(['title', 'subhead', 'content'])
  })
})

describe('wrapText', () => {
  it('returns short text unchanged', () => {
    expect(wrapText('Hello world', 90)).toBe('Hello world')
  })

  it('wraps long text at word boundary', () => {
    const text =
      'Maybe you\u2019ve heard of the \u201Csocial contract.\u201D It\u2019s a concept' +
      ' in philosophy popularized during the Enlightenment that' +
      ' attempted to explain why people form governments.'
    const result = wrapText(text, 90)
    for (const line of result.split('\n')) {
      expect(line.length).toBeLessThanOrEqual(90)
    }
  })

  it('preserves all words after wrapping', () => {
    const text =
      'Maybe you\u2019ve heard of the \u201Csocial contract.\u201D It\u2019s a concept' +
      ' in philosophy popularized during the Enlightenment that' +
      ' attempted to explain why people form governments.'
    const result = wrapText(text, 90)
    expect(result.split('\n').join(' ')).toBe(text)
  })
})

describe('decideTeaserAction', () => {
  it('skips when article has subhead', () => {
    const result = decideTeaserAction(true, false, false, false, false)
    expect(result.action).toBe('skip')
    expect(result.reason).toBe('has subhead')
  })

  it('skips when teaser exists but not in revisions (manual)', () => {
    const result = decideTeaserAction(false, true, false, false, false)
    expect(result.action).toBe('skip')
    expect(result.reason).toBe('manually written teaser')
  })

  it('skips when teaser was manually edited', () => {
    const result = decideTeaserAction(false, true, true, false, true)
    expect(result.action).toBe('skip')
    expect(result.reason).toBe('manually edited teaser')
  })

  it('skips when teaser in revisions and hash matches', () => {
    const result = decideTeaserAction(false, true, true, true, false)
    expect(result.action).toBe('skip')
    expect(result.reason).toBe('unchanged')
  })

  it('regenerates when teaser in revisions but hash changed', () => {
    const result = decideTeaserAction(false, true, true, false, false)
    expect(result.action).toBe('regenerate')
    expect(result.reason).toBe('content changed')
  })

  it('generates when no teaser and no subhead', () => {
    const result = decideTeaserAction(false, false, false, false, false)
    expect(result.action).toBe('generate')
    expect(result.reason).toBe('no teaser')
  })

  it('generates when no teaser even if in revisions', () => {
    const result = decideTeaserAction(false, false, true, false, false)
    expect(result.action).toBe('generate')
    expect(result.reason).toBe('no teaser')
  })
})

describe('insertTeaserIntoFrontmatter', () => {
  it('inserts teaser into frontmatter without existing teaser', () => {
    const input = [
      '---',
      'title: Test Post',
      'date: 2026-01-30',
      '---',
      '',
      'Body content here.',
    ].join('\n')

    const result = insertTeaserIntoFrontmatter(input, 'A test teaser.')

    expect(result).toContain('teaser: >-\n  A test teaser.')
    expect(result).toContain('title: Test Post')
    expect(result).toContain('Body content here.')
  })

  it('replaces existing block scalar teaser', () => {
    const input = [
      '---',
      'title: Test Post',
      'teaser: >-',
      '  Old teaser text.',
      'date: 2026-01-30',
      '---',
      '',
      'Body content here.',
    ].join('\n')

    const result = insertTeaserIntoFrontmatter(input, 'New teaser text.')

    expect(result).toContain('teaser: >-\n  New teaser text.')
    expect(result).not.toContain('Old teaser text.')
    expect(result).toContain('title: Test Post')

    const parsed = matter(result)
    expect(parsed.data.teaser).toBe('New teaser text.')
  })

  it('replaces existing single-line teaser', () => {
    const input = [
      '---',
      'title: Test Post',
      'teaser: Old teaser text.',
      'date: 2026-01-30',
      '---',
      '',
      'Body content here.',
    ].join('\n')

    const result = insertTeaserIntoFrontmatter(input, 'New teaser text.')

    expect(result).toContain('teaser: >-\n  New teaser text.')
    expect(result).not.toContain('Old teaser text.')

    const parsed = matter(result)
    expect(parsed.data.teaser).toBe('New teaser text.')
  })

  it('preserves content after frontmatter', () => {
    const input = [
      '---',
      'title: Test Post',
      '---',
      '',
      'Paragraph one.',
      '',
      'Paragraph two.',
    ].join('\n')

    const result = insertTeaserIntoFrontmatter(input, 'My teaser.')

    expect(result).toContain('Paragraph one.')
    expect(result).toContain('Paragraph two.')
  })

  it('wraps long teaser into multi-line block scalar', () => {
    const input = [
      '---',
      'title: Test Post',
      'date: 2026-01-30',
      '---',
      '',
      'Body content here.',
    ].join('\n')

    const longTeaser =
      'Maybe you\u2019ve heard of the \u201Csocial contract.\u201D It\u2019s a concept' +
      ' in philosophy popularized during the Enlightenment that' +
      ' attempted to explain why people form governments.'

    const result = insertTeaserIntoFrontmatter(input, longTeaser)

    // Each line (including "teaser: >-" prefix) should fit in 92 chars
    const teaserMatch = result.match(/teaser: >-\n([ \t]+[^\n]+\n?)+/)
    expect(teaserMatch).not.toBeNull()
    const teaserLines = teaserMatch![0].split('\n').slice(1)
    for (const line of teaserLines) {
      if (line.trim() === '') continue
      expect(line.length).toBeLessThanOrEqual(92)
    }

    // Verify the teaser round-trips correctly via gray-matter
    const parsed = matter(result)
    expect(parsed.data.teaser).toBe(longTeaser)
  })

  it('produces valid YAML when teaser is last field before delimiter', () => {
    const input = [
      '---',
      'title: Test Post',
      'date: 2026-01-30',
      'teaser: >-',
      '  Old teaser text.',
      '---',
      '',
      'Body.',
    ].join('\n')

    const result = insertTeaserIntoFrontmatter(input, 'New teaser text.')

    const parsed = matter(result)
    expect(parsed.data.teaser).toBe('New teaser text.')
    expect(parsed.data.title).toBe('Test Post')
  })

  it('handles multiline block scalar teaser replacement', () => {
    const input = [
      '---',
      'title: Test Post',
      'teaser: >-',
      '  Old teaser that spans',
      '  multiple lines here.',
      'date: 2026-01-30',
      '---',
      '',
      'Body.',
    ].join('\n')

    const result = insertTeaserIntoFrontmatter(input, 'New teaser text.')

    expect(result).toContain('teaser: >-\n  New teaser text.')
    expect(result).not.toContain('Old teaser that spans')
    expect(result).not.toContain('multiple lines here.')
    expect(result).toContain('date: 2026-01-30')

    const parsed = matter(result)
    expect(parsed.data.teaser).toBe('New teaser text.')
  })
})
