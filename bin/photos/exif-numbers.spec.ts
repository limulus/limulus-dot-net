import { describe, expect, it } from 'vitest'

import { exifNumbers } from './exif-numbers.ts'

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
