// The numbers the photo pages print from a photo's EXIF strings. Lemmon parses no number
// out of a string, so the database carries them beside the strings: photo-meta.webc read
// them with `parseFloat`, and these are its expressions, so the pages print what Eleventy
// printed.

/** The fields of a photo record the numbers are read from. */
export interface ExifStrings {
  alias: string
  focalLength?: string
  fNumber?: string
  sourceExposureTimesOfCompositeImage?: string
}

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
function finite(photo: ExifStrings, field: keyof ExifNumbers, value: number): number {
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
export function exifNumbers(photo: ExifStrings): ExifNumbers {
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
