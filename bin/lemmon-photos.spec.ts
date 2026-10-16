import { readFile } from 'node:fs/promises'
import { describe, expect, it } from 'vitest'

import { lemmonPhotos, SOURCE, TARGET } from './lemmon-photos.ts'

const derived = (db: object): Record<string, { id: string }> =>
  JSON.parse(lemmonPhotos(JSON.stringify(db))) as Record<string, { id: string }>

describe('lemmonPhotos', () => {
  it('should key each photo by the alias that names it', () => {
    const photos = derived({
      'upper-falls': 'ogMP7Pbu',
      ogMP7Pbu: { id: 'ogMP7Pbu', alias: 'upper-falls' },
      'middle-falls': '9S_9E3mC',
      '9S_9E3mC': { id: '9S_9E3mC', alias: 'middle-falls' },
    })
    expect(Object.keys(photos)).toEqual(['upper-falls', 'middle-falls'])
    expect(photos['upper-falls'].id).toBe('ogMP7Pbu')
    expect(photos['middle-falls'].id).toBe('9S_9E3mC')
  })

  it('should leave out a record no alias names', () => {
    const photos = derived({
      'one-long-cut': 'tmj9u7Ht',
      tmj9u7Ht: { id: 'tmj9u7Ht', alias: 'one-long-cut' },
      '1_e2YuOe': { id: '1_e2YuOe', alias: 'one-long-cut' },
    })
    expect(photos).toEqual({ 'one-long-cut': { id: 'tmj9u7Ht', alias: 'one-long-cut' } })
  })

  it('should refuse an alias that names no photo', () => {
    expect(() => derived({ 'upper-falls': 'ogMP7Pbu' })).toThrow(
      'the alias upper-falls names ogMP7Pbu'
    )
  })

  it('should refuse an alias whose photo carries another alias', () => {
    expect(() =>
      derived({ 'upper-falls': 'ogMP7Pbu', ogMP7Pbu: { id: 'ogMP7Pbu', alias: 'falls' } })
    ).toThrow('the alias upper-falls names ogMP7Pbu')
  })
})

describe('www/_lemmon/photos.json', () => {
  it('should be what `npm run lemmon:photos` derives from www/_data/photos.json', async () => {
    const expected = lemmonPhotos(await readFile(SOURCE, 'utf8'))
    expect(await readFile(TARGET, 'utf8')).toBe(expected)
  })
})
