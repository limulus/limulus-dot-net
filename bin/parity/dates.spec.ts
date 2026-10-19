import { describe, expect, it } from 'vitest'

import { GRAMMARS, rfc3339, rfc822 } from './dates.ts'

describe('rfc822()', () => {
  it('should read Eleventy’s spelling and ours of one instant alike', () => {
    const theirs = rfc822('Sat, 04 Jul 2026 09:40:00 MST')
    expect(theirs).toBeDefined()
    expect(rfc822('Sat, 4 Jul 2026 09:40:00 -0700')).toBe(theirs)
    expect(rfc822('Sat, 04 Jul 2026 16:40:00 GMT')).toBe(theirs)
    expect(rfc822('Sat, 04 Jul 2026 16:40:00 +0000')).toBe(theirs)
    expect(rfc822('04 Jul 2026 12:40 EDT')).toBe(theirs)
  })

  it('should read every zone name it accepts at its own offset', () => {
    const utc = rfc822('Sat, 04 Jul 2026 12:00:00 UT')
    const at = (hour: number, zone: string) =>
      rfc822(`Sat, 04 Jul 2026 ${String(hour).padStart(2, '0')}:00:00 ${zone}`)
    expect([at(12, 'GMT'), at(7, 'EST'), at(8, 'EDT'), at(6, 'CST'), at(7, 'CDT')]).toEqual(
      Array(5).fill(utc)
    )
    expect([at(5, 'MST'), at(6, 'MDT'), at(4, 'PST'), at(5, 'PDT')]).toEqual(
      Array(4).fill(utc)
    )
  })

  it('should tell different instants apart', () => {
    expect(rfc822('Sat, 04 Jul 2026 09:40:00 MST')).not.toBe(
      rfc822('Sat, 04 Jul 2026 09:40:00 -0600')
    )
    expect(rfc822('Sat, 04 Jul 2026 09:40:00 MST')).not.toBe(
      rfc822('Sat, 04 Jul 2026 09:40:01 MST')
    )
  })

  it('should not read what V8 would still parse', () => {
    for (const text of [
      '2026-07-04T16:40:00Z',
      'Sat, 04 Jul 26 09:40:00 MST',
      'Sat, 04 July 2026 09:40:00 MST',
      'Saturday, 04 Jul 2026 09:40:00 MST',
      'Sat 04 Jul 2026 09:40:00 MST',
      'Sat, 04 Jul 2026 09:40:00 Z',
      'Sat, 04 Jul 2026 09:40:00',
      ' Sat, 04 Jul 2026 09:40:00 MST',
    ]) {
      expect(Number.isNaN(Date.parse(text)), text).toBe(false)
      expect(rfc822(text), text).toBeUndefined()
    }
  })

  it('should not read a date its fields cannot name', () => {
    expect(rfc822('Sun, 04 Jul 2026 09:40:00 MST')).toBeUndefined()
    expect(rfc822('31 Jun 2026 09:40:00 MST')).toBeUndefined()
    expect(rfc822('04 Jul 2026 24:40:00 MST')).toBeUndefined()
    expect(rfc822('04 Jul 2026 09:60:00 MST')).toBeUndefined()
    expect(rfc822('04 Jul 2026 09:40:60 MST')).toBeUndefined()
    expect(rfc822('04 Jul 2026 09:40:00 -0760')).toBeUndefined()
    expect(rfc822('04 Jul 2026 09:40:00 +2400')).toBeUndefined()
    expect(rfc822('04 Jul 0026 09:40:00 MST')).toBeUndefined()
  })
})

describe('rfc3339()', () => {
  it('should read UTC and a written offset of one instant alike', () => {
    const theirs = rfc3339('2024-06-04T20:20:00Z')
    expect(theirs).toBeDefined()
    expect(rfc3339('2024-06-04T13:20:00-07:00')).toBe(theirs)
    expect(rfc3339('2024-06-04T20:20:00+00:00')).toBe(theirs)
    expect(rfc3339('2024-06-05T05:50:00+09:30')).toBe(theirs)
  })

  it('should read a fraction exactly, its trailing zeros alike', () => {
    expect(rfc3339('2026-06-28T18:40:44.770Z')).toBe(rfc3339('2026-06-28T18:40:44.77Z'))
    expect(rfc3339('2026-06-28T18:40:44.000Z')).toBe(rfc3339('2026-06-28T18:40:44Z'))
    expect(rfc3339('2026-06-28T18:40:44.7701Z')).not.toBe(
      rfc3339('2026-06-28T18:40:44.770Z')
    )
  })

  it('should tell different instants apart', () => {
    expect(rfc3339('2024-06-04T20:20:00Z')).not.toBe(rfc3339('2024-06-04T20:20:00-07:00'))
  })

  it('should not read what V8 would still parse', () => {
    for (const text of [
      '2024-06-04 20:20:00Z',
      '2024-06-04T20:20Z',
      '2024-06-04',
      '2024-06-04T20:20:00',
      '2024-06-04t20:20:00z',
      '2024-06-04T20:20:00-0700',
      'Tue, 04 Jun 2024 20:20:00 GMT',
    ]) {
      expect(Number.isNaN(Date.parse(text)), text).toBe(false)
      expect(rfc3339(text), text).toBeUndefined()
    }
  })

  it('should not read a date-time its fields cannot name', () => {
    expect(rfc3339('2024-02-30T20:20:00Z')).toBeUndefined()
    expect(rfc3339('2024-13-01T20:20:00Z')).toBeUndefined()
    expect(rfc3339('2024-06-04T20:20:00+24:00')).toBeUndefined()
    expect(rfc3339('2024-06-04T20:20:00-07:60')).toBeUndefined()
  })
})

describe('GRAMMARS', () => {
  it('should name each grammar for a report beside its reader', () => {
    expect(GRAMMARS.rfc822).toEqual({ name: 'RFC 822', read: rfc822 })
    expect(GRAMMARS.rfc3339).toEqual({ name: 'RFC 3339', read: rfc3339 })
  })
})
