import { readFile } from 'node:fs/promises'
import { describe, expect, it } from 'vitest'

import { exifNumbers, lemmonPhotos, SOURCE, TARGET } from './lemmon-photos.ts'

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

  it("should add each photo's EXIF numbers after its own fields", () => {
    const text = lemmonPhotos(
      JSON.stringify({
        split: '6WFfZpjz',
        '6WFfZpjz': {
          id: '6WFfZpjz',
          alias: 'split',
          focalLength: '6.764999865652793 mm',
          fNumber: 'f/1.7799999713880652',
        },
      })
    )
    expect(Object.keys((JSON.parse(text) as Record<string, object>).split)).toEqual([
      'id',
      'alias',
      'focalLength',
      'fNumber',
      'focalLengthMm',
      'fNumberValue',
    ])
  })
})

describe('exifNumbers', () => {
  const alias = 'split'

  it("should read the focal length as photo-meta.webc's parseFloat read it", () => {
    expect(exifNumbers({ alias, focalLength: '6.764999865652793 mm' })).toEqual({
      focalLengthMm: 6.764999865652793,
    })
    expect(exifNumbers({ alias, focalLength: '35 mm' })).toEqual({ focalLengthMm: 35 })
  })

  it('should read the f-number after its `f/`', () => {
    expect(exifNumbers({ alias, fNumber: 'f/1.7799999713880652' })).toEqual({
      fNumberValue: 1.7799999713880652,
    })
    expect(exifNumbers({ alias, fNumber: 'f/9' })).toEqual({ fNumberValue: 9 })
  })

  it("should divide a composite's second exposure time, spaces and all", () => {
    const sourceExposureTimesOfCompositeImage =
      '0; 33298/9605; 0; 14151/65311; 0; 14151/65311; 0; 0'
    expect(exifNumbers({ alias, sourceExposureTimesOfCompositeImage })).toEqual({
      compositeExposureSeconds: 33298 / 9605,
    })
  })

  it('should leave out a number whose string the photo lacks', () => {
    expect(exifNumbers({ alias })).toEqual({})
    expect(exifNumbers({ alias, sourceExposureTimesOfCompositeImage: '' })).toEqual({})
  })

  it('should leave out the exposure of a composite with one time', () => {
    expect(exifNumbers({ alias, sourceExposureTimesOfCompositeImage: '1/5' })).toEqual({})
  })

  it('should refuse a string parseFloat reads no number from', () => {
    expect(() => exifNumbers({ alias, focalLength: 'unknown' })).toThrow(
      'photos.json: split has no number for focalLengthMm: NaN'
    )
    expect(() => exifNumbers({ alias, fNumber: 'f/' })).toThrow(
      'split has no number for fNumberValue: NaN'
    )
    expect(() =>
      exifNumbers({ alias, sourceExposureTimesOfCompositeImage: '0; 1/0' })
    ).toThrow('split has no number for compositeExposureSeconds: Infinity')
    expect(() =>
      exifNumbers({ alias, sourceExposureTimesOfCompositeImage: '0; 15' })
    ).toThrow('split has no number for compositeExposureSeconds: NaN')
  })
})

describe('www/_lemmon/photos.json', () => {
  it('should be what `npm run lemmon:photos` derives from www/_data/photos.json', async () => {
    const expected = lemmonPhotos(await readFile(SOURCE, 'utf8'))
    expect(await readFile(TARGET, 'utf8')).toBe(expected)
  })
})
