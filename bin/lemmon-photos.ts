// Writes the photo database as the Lemmon port loads it: www/_data/photos.json keys each
// photo by its id and keeps an alias → id index beside the records, a mix that no single
// Lemmon type describes. The port's `{string: Photo}` wants the records alone, keyed by
// the alias a post's front matter names, so each alias is resolved here. A photos
// plugin will do this inside the build instead, through a data hook (∆pP5 and the hook
// it needs, ∆wOn, in the lemmon repo).
//
// Each record also gains the three numbers photo-meta.webc read out of its EXIF strings
// with `parseFloat`, computed here by the same expressions, so that the photo pages print
// what Eleventy printed: Lemmon parses no number out of a string. At the cutover
// bin/process-photos.js writes them into photos.json itself (lemmon ∆oAl).

import esMain from 'es-main'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

export const SOURCE = fileURLToPath(new URL('../www/_data/photos.json', import.meta.url))
export const TARGET = fileURLToPath(new URL('../www/_lemmon/photos.json', import.meta.url))

/** The fields of a photo record this script reads. */
interface PhotoRecord {
  alias: string
  focalLength?: string
  fNumber?: string
  sourceExposureTimesOfCompositeImage?: string
}

type PhotoDb = Record<string, string | PhotoRecord>

/** The numbers photo-meta.webc parsed out of a photo's EXIF strings. */
export interface ExifNumbers {
  /** `parseFloat(focalLength)`: `"6.764999865652793 mm"` is 6.764999865652793. */
  focalLengthMm?: number
  /** `parseFloat(fNumber.replace('f/', ''))`: `"f/1.78"` is 1.78. */
  fNumberValue?: number
  /**
   * The second time of a composite exposure, `numerator / denominator`, each
   * `parseFloat`ed: `"0; 33298/9605; …"` is 33298 / 9605.
   */
  compositeExposureSeconds?: number
}

/**
 * `value` as one of `photo`'s numbers, named `field`.
 *
 * @throws where `parseFloat` read no number, which photo-meta.webc printed as `NaN`
 *   and JSON cannot carry: `JSON.stringify` would write `null`, which loads as no value.
 */
function finite(photo: PhotoRecord, field: keyof ExifNumbers, value: number): number {
  if (!Number.isFinite(value)) {
    throw new Error(`photos.json: ${photo.alias} has no number for ${field}: ${value}`)
  }
  return value
}

/**
 * The numbers photo-meta.webc parsed out of `photo`'s EXIF strings, by its own
 * expressions; one whose string the photo lacks is left out, as is the exposure of a
 * composite whose string holds fewer than two times.
 */
export function exifNumbers(photo: PhotoRecord): ExifNumbers {
  const numbers: ExifNumbers = {}
  if (photo.focalLength !== undefined) {
    numbers.focalLengthMm = finite(photo, 'focalLengthMm', parseFloat(photo.focalLength))
  }
  if (photo.fNumber !== undefined) {
    const fNumber = parseFloat(photo.fNumber.replace('f/', ''))
    numbers.fNumberValue = finite(photo, 'fNumberValue', fNumber)
  }
  if (photo.sourceExposureTimesOfCompositeImage) {
    const times = photo.sourceExposureTimesOfCompositeImage.split(';')
    if (times.length >= 2) {
      const [numerator, denominator] = times[1].split('/')
      const exposure = parseFloat(numerator) / parseFloat(denominator)
      numbers.compositeExposureSeconds = finite(photo, 'compositeExposureSeconds', exposure)
    }
  }
  return numbers
}

/**
 * The text of the Lemmon photo file for the text of photos.json: every photo an alias
 * names, keyed by that alias, in the index's order, with its EXIF numbers after its own
 * fields. A record no alias names is left out.
 */
export function lemmonPhotos(source: string): string {
  const db = JSON.parse(source) as PhotoDb
  const byAlias: Record<string, PhotoRecord & ExifNumbers> = {}
  for (const [alias, id] of Object.entries(db)) {
    if (typeof id !== 'string') continue
    const photo = db[id]
    if (typeof photo !== 'object' || photo.alias !== alias) {
      throw new Error(
        `photos.json: the alias ${alias} names ${id}, which is no photo of it`
      )
    }
    byAlias[alias] = { ...photo, ...exifNumbers(photo) }
  }
  return JSON.stringify(byAlias, null, 2) + '\n'
}

if (esMain(import.meta)) {
  const text = lemmonPhotos(await readFile(SOURCE, 'utf8'))
  await mkdir(dirname(TARGET), { recursive: true })
  await writeFile(TARGET, text)
  console.log(`${TARGET}: ${Object.keys(JSON.parse(text) as object).length} photos`)
}
