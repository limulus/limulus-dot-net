// The photo database, www/_data/photos.json, which site.lem binds as `photos`: each
// photo's record keyed by its alias, the name a post's front matter gives it, with its
// EXIF numbers after its own fields (./exif-numbers.ts). bin/process-photos.js writes
// each photo it processes into it.

import { fileURLToPath } from 'node:url'

import { exifNumbers, type ExifNumbers, type ExifStrings } from './exif-numbers.ts'

export const PHOTO_DB = fileURLToPath(
  new URL('../../www/_data/photos.json', import.meta.url)
)

/** A photo's record as bin/process-photos.js makes it, its alias among its fields. */
export type PhotoRecord = ExifStrings & Record<string, unknown>

/** Each photo's record, with its EXIF numbers, by its alias. */
export type PhotoDb = Record<string, PhotoRecord & ExifNumbers>

/**
 * `db` with `record` under its alias and the numbers its EXIF strings give after its
 * own fields: in the place of an earlier record of that alias, or else last.
 */
export function withPhoto(db: PhotoDb, record: PhotoRecord): PhotoDb {
  return { ...db, [record.alias]: { ...record, ...exifNumbers(record) } }
}

/** The text of `db` as the file holds it. */
export function photoDbText(db: PhotoDb): string {
  return JSON.stringify(db, null, 2) + '\n'
}
