import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

import {
  bandsText,
  fileFor,
  pixelDiff,
  rowBands,
  settle,
  type Bitmap,
} from './parity-look.ts'

/** A bitmap `width` wide of one gray per row, as `rows` lists them. */
function bitmap(width: number, rows: number[]): Bitmap {
  const data = new Uint8Array(width * rows.length * 4)
  rows.forEach((gray, y) => {
    for (let x = 0; x < width; x += 1)
      data.set([gray, gray, gray, 255], (y * width + x) * 4)
  })
  return { data, width, height: rows.length }
}

const pixelAt = ({ data, width }: Bitmap, x: number, y: number): number[] => [
  ...data.subarray((y * width + x) * 4, (y * width + x) * 4 + 4),
]

describe('rowBands()', () => {
  it('should join consecutive rows into one band, first and last inclusive', () => {
    expect(rowBands([3, 4, 5, 9, 11, 12])).toEqual([
      [3, 5],
      [9, 9],
      [11, 12],
    ])
  })

  it('should give no band for no rows', () => {
    expect(rowBands([])).toEqual([])
  })
})

describe('bandsText()', () => {
  it('should list the first bands and count the rest', () => {
    const bands = rowBands([1, 2, 4, 6, 8, 10, 12, 14])
    expect(bandsText(bands)).toBe('rows 1–2, 4, 6, 8, 10, 12 and 1 more')
    expect(bandsText(bands.slice(0, 2))).toBe('rows 1–2, 4')
  })
})

describe('pixelDiff()', () => {
  it('should find nothing between identical screenshots, and fade theirs', () => {
    const diff = pixelDiff(bitmap(2, [0, 255]), bitmap(2, [0, 255]))
    expect(diff.pixels).toBe(0)
    expect(diff.bands).toEqual([])
    expect(pixelAt(diff.image, 0, 0)).toEqual([191, 191, 191, 255])
    expect(pixelAt(diff.image, 1, 1)).toEqual([255, 255, 255, 255])
  })

  it('should count a pixel one channel apart, and mark it red', () => {
    const ours = bitmap(3, [10, 10, 10, 10])
    ours.data[(2 * 3 + 1) * 4 + 2] = 11
    const diff = pixelDiff(ours, bitmap(3, [10, 10, 10, 10]))
    expect(diff.pixels).toBe(1)
    expect(diff.bands).toEqual([[2, 2]])
    expect(pixelAt(diff.image, 1, 2)).toEqual([255, 0, 0, 255])
  })

  it('should compare every channel, alpha too', () => {
    for (const channel of [0, 1, 2, 3]) {
      const ours = bitmap(1, [10])
      ours.data[channel] = 11
      expect(pixelDiff(ours, bitmap(1, [10])).pixels).toBe(1)
    }
  })

  it('should count what only the taller covers as differing, in magenta', () => {
    const diff = pixelDiff(bitmap(2, [5, 5]), bitmap(2, [5, 5, 5, 5]))
    expect(diff.pixels).toBe(4)
    expect(diff.bands).toEqual([[2, 3]])
    expect(diff.image.height).toBe(4)
    expect(pixelAt(diff.image, 1, 3)).toEqual([255, 0, 255, 255])
  })

  it('should count what only the wider covers as differing', () => {
    const diff = pixelDiff(bitmap(3, [5, 5]), bitmap(2, [5, 5]))
    expect(diff.pixels).toBe(2)
    expect(diff.bands).toEqual([[0, 1]])
    expect(pixelAt(diff.image, 2, 0)).toEqual([255, 0, 255, 255])
    expect(pixelAt(diff.image, 1, 0)).not.toEqual([255, 0, 255, 255])
  })
})

describe('settle()', () => {
  /** A screenshot taker that gives `shots` in turn, counting how many it gave. */
  const taker = (...shots: string[]) => {
    const taken = { count: 0 }
    const take = async (): Promise<Buffer> => Buffer.from(shots[taken.count++])
    return { take, taken }
  }

  it('should stop at the first two shots alike', async () => {
    const { take, taken } = taker('a', 'a', 'b')
    expect(await settle(take)).toEqual({ png: Buffer.from('a'), settled: true })
    expect(taken.count).toBe(2)
  })

  it('should keep shooting until two running agree', async () => {
    const { take, taken } = taker('a', 'b', 'c', 'c')
    expect(await settle(take)).toEqual({ png: Buffer.from('c'), settled: true })
    expect(taken.count).toBe(4)
  })

  it('should give up after its tries, unsettled, with the last shot', async () => {
    const { take, taken } = taker('a', 'b', 'a', 'b', 'a', 'a')
    expect(await settle(take)).toEqual({ png: Buffer.from('a'), settled: false })
    expect(taken.count).toBe(5)
  })
})

describe('fileFor()', () => {
  const root = join('/srv', 'dist')

  it("should serve a directory's index.html and a file as named", () => {
    expect(fileFor(root, '/feed/a/')).toBe(join(root, 'feed/a/index.html'))
    expect(fileFor(root, '/')).toBe(join(root, 'index.html'))
    expect(fileFor(root, '/assets/a%20b.css')).toBe(join(root, 'assets/a b.css'))
  })

  it('should refuse a path that leaves the root, or does not decode', () => {
    expect(fileFor(root, '/%2e%2e/secret')).toBeNull()
    expect(fileFor(root, '/%2e%2e%2fdist-other/x')).toBeNull()
    expect(fileFor(root, '/%E0%A4%A')).toBeNull()
  })
})
