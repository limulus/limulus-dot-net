import { readdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

import {
  bandsText,
  fileFor,
  Gate,
  MAP_BUNDLE,
  MASKED,
  maskedNothing,
  pixelDiff,
  rowBands,
  sameMasks,
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

describe('MASKED', () => {
  /** The custom elements a script under www/lib defines, by name. */
  const defined = async (): Promise<Set<string>> => {
    const lib = new URL('../www/lib/', import.meta.url)
    const names = new Set<string>()
    for (const file of await readdir(lib, { recursive: true })) {
      if (!file.endsWith('.ts')) continue
      const text = await readFile(new URL(file, lib), 'utf8')
      for (const [, name] of text.matchAll(/customElements\.define\('([^']+)'/g)) {
        names.add(name)
      }
    }
    return names
  }

  /** The element each selector in a list starts at. */
  const hosts = (selector: string): string[] =>
    selector.split(',').map((part) => part.trim().split(/[\s>#.[:]/)[0])

  it('should start each selector at an element a script under www/lib defines', async () => {
    const names = await defined()
    expect(names.has('pixel-clock')).toBe(true)
    expect(names.has('no-such-element')).toBe(false)
    for (const { selector } of MASKED) {
      for (const host of hosts(selector)) expect(names, selector).toContain(host)
    }
  })

  it('should read the element a selector starts at', () => {
    expect(hosts('sphere-shadow #hud, sphere-shadow-wasm #hud')).toEqual([
      'sphere-shadow',
      'sphere-shadow-wasm',
    ])
    expect(hosts('video-on-demand')).toEqual(['video-on-demand'])
  })

  it('should mask exactly these parts, each no wider than what a script draws', () => {
    // Widening one to its whole demo, or adding one, is a change to what the look check
    // compares, so it changes this list too.
    expect(MASKED.map(({ selector }) => selector)).toEqual([
      'pixel-clock canvas',
      'sphere-shadow canvas, sphere-shadow-wasm canvas',
      'sphere-shadow #hud, sphere-shadow-wasm #hud',
      'video-on-demand',
    ])
  })

  it('should say why each is masked, each selector once', () => {
    for (const { why } of MASKED) expect(why).not.toBe('')
    const selectors = MASKED.map(({ selector }) => selector)
    expect(new Set(selectors).size).toBe(selectors.length)
  })

  it('should not mask a blur-hash or a projectile-cannon, which hold still', () => {
    const all = MASKED.flatMap(({ selector }) => hosts(selector))
    expect(all).not.toContain('blur-hash')
    expect(all).not.toContain('projectile-cannon')
  })
})

describe('MAP_BUNDLE', () => {
  it("should match the map's hashed bundle, which its loader imports", () => {
    expect(MAP_BUNDLE.test('/lib/map-box/index.GGIOBTUO.js')).toBe(true)
  })

  it('should not match its source map, its stub, or another bundle', () => {
    for (const path of [
      '/lib/map-box/index.GGIOBTUO.js.map',
      '/lib/map-box/index.js',
      '/lib/common/index.YDUDOD6U.js',
      '/photos/lib/map-box/index.GGIOBTUO.js',
    ]) {
      expect(MAP_BUNDLE.test(path), path).toBe(false)
    }
  })

  it("should match the bundle map-box.lem's loader names", async () => {
    const lem = await readFile(
      new URL('../www/_includes/components/map-box.lem', import.meta.url),
      'utf8'
    )
    const [, entry] = /import\('<lem\.asset\("([^"]+)"\)>'\)/.exec(lem) ?? []
    expect(entry).toBe('/lib/map-box/index.js')
    expect(MAP_BUNDLE.test(entry.replace(/\.js$/, '.GGIOBTUO.js'))).toBe(true)
  })
})

describe('maskedNothing()', () => {
  const masks = [{ selector: 'a' }, { selector: 'b' }]
  const page = (entries: [string, number][]) => new Map(entries)

  it('should pass over a mask that masked something on some page', () => {
    const pages = [
      page([
        ['a', 0],
        ['b', 0],
      ]),
      page([
        ['a', 2],
        ['b', 1],
      ]),
    ]
    expect(maskedNothing(pages, masks)).toEqual([])
  })

  it('should name each mask that masked nothing on any page', () => {
    const pages = [
      page([
        ['a', 1],
        ['b', 0],
      ]),
      page([['a', 0]]),
    ]
    expect(maskedNothing(pages, masks)).toEqual(['b'])
    expect(maskedNothing([], masks)).toEqual(['a', 'b'])
  })

  it('should hold MASKED itself to it by default', () => {
    expect(maskedNothing([])).toEqual(MASKED.map(({ selector }) => selector))
  })
})

describe('sameMasks()', () => {
  const counts = (entries: [string, number][]) => new Map(entries)

  it('should agree where every selector masked as many elements', () => {
    expect(
      sameMasks(
        counts([
          ['a', 1],
          ['b', 0],
        ]),
        counts([
          ['b', 0],
          ['a', 1],
        ])
      )
    ).toBe(true)
  })

  it('should not agree where a count or a selector differs', () => {
    expect(sameMasks(counts([['a', 1]]), counts([['a', 2]]))).toBe(false)
    expect(sameMasks(counts([['a', 1]]), counts([['b', 1]]))).toBe(false)
    expect(
      sameMasks(
        counts([['a', 1]]),
        counts([
          ['a', 1],
          ['b', 0],
        ])
      )
    ).toBe(false)
  })
})

describe('Gate', () => {
  /** Whether `promise` has settled once pending callbacks have run. */
  const settled = (promise: Promise<void>): Promise<boolean> =>
    Promise.race([
      promise.then(() => true),
      new Promise<boolean>((resolve) => setImmediate(() => resolve(false))),
    ])

  it('should let everything through while open, as it starts', async () => {
    expect(await settled(new Gate().passed())).toBe(true)
  })

  it('should hold what comes while shut, and let it through in order once open', async () => {
    const gate = new Gate()
    gate.shut()
    const order: number[] = []
    const first = gate.passed().then(() => order.push(1))
    const second = gate.passed().then(() => order.push(2))
    expect(await settled(gate.passed())).toBe(false)
    gate.open()
    await Promise.all([first, second])
    expect(order).toEqual([1, 2])
    expect(await settled(gate.passed())).toBe(true)
  })

  it('should hold again once shut again', async () => {
    const gate = new Gate()
    gate.shut()
    gate.open()
    gate.shut()
    expect(await settled(gate.passed())).toBe(false)
  })
})
