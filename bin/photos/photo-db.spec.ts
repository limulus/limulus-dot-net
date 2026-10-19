import { readFile } from 'node:fs/promises'
import { describe, expect, it } from 'vitest'

import { PHOTO_DB, photoDbText, withPhoto, type PhotoDb } from './photo-db.ts'

const NUMBERS = ['focalLengthMm', 'fNumberValue', 'compositeExposureSeconds']

/** `record` without the numbers `withPhoto` adds, as bin/process-photos.js makes it. */
const unnumbered = (record: object): PhotoDb[string] =>
  Object.fromEntries(
    Object.entries(record).filter(([field]) => !NUMBERS.includes(field))
  ) as PhotoDb[string]

describe('withPhoto', () => {
  const db: PhotoDb = {
    'upper-falls': { id: 'ogMP7Pbu', alias: 'upper-falls' },
    'middle-falls': { id: '9S_9E3mC', alias: 'middle-falls' },
  }

  it('should put a photo of a new alias last, its EXIF numbers after its own fields', () => {
    const split = {
      id: '6WFfZpjz',
      alias: 'split',
      focalLength: '6.764999865652793 mm',
      fNumber: 'f/1.7799999713880652',
    }
    const written = withPhoto(db, split)
    expect(Object.keys(written)).toEqual(['upper-falls', 'middle-falls', 'split'])
    expect(Object.keys(written.split)).toEqual([
      'id',
      'alias',
      'focalLength',
      'fNumber',
      'focalLengthMm',
      'fNumberValue',
    ])
    expect(written.split.fNumberValue).toBe(1.7799999713880652)
  })

  it('should replace an earlier photo of the alias in its place', () => {
    const written = withPhoto(db, { id: 'tmj9u7Ht', alias: 'upper-falls' })
    expect(Object.keys(written)).toEqual(['upper-falls', 'middle-falls'])
    expect(written['upper-falls']).toEqual({ id: 'tmj9u7Ht', alias: 'upper-falls' })
  })

  it('should leave the database it is given as it was', () => {
    withPhoto(db, { id: 'tmj9u7Ht', alias: 'upper-falls' })
    expect(db['upper-falls'].id).toBe('ogMP7Pbu')
  })
})

describe('www/_data/photos.json', () => {
  const read = async (): Promise<{ text: string; db: PhotoDb }> => {
    const text = await readFile(PHOTO_DB, 'utf8')
    return { text, db: JSON.parse(text) as PhotoDb }
  }

  it('should key every photo by its own alias', async () => {
    const { db } = await read()
    expect(Object.entries(db).filter(([alias, record]) => record.alias !== alias)).toEqual(
      []
    )
  })

  // What bin/process-photos.js writes, from the record it makes, which has no numbers.
  it('should be what writing any of its photos into it again writes', async () => {
    const { text, db } = await read()
    for (const record of Object.values(db)) {
      expect(photoDbText(withPhoto(db, unnumbered(record))), record.alias).toBe(text)
    }
  })

  it('should be what writing its newest photo into it, less that photo, writes', async () => {
    const { text, db } = await read()
    const records = Object.values(db)
    const newest = records[records.length - 1]
    const rest = Object.fromEntries(
      Object.entries(db).filter(([alias]) => alias !== newest.alias)
    )
    expect(photoDbText(withPhoto(rest, unnumbered(newest)))).toBe(text)
  })
})
