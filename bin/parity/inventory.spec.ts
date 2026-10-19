import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { bundlesIn, pagesIn } from './check.ts'
import { everyFile } from './files.ts'
import {
  categoriesOf,
  inventoryFailed,
  inventoryLines,
  inventoryOf,
  isPassthrough,
  passthroughIn,
  type Placing,
} from './inventory.ts'
import { scriptsIn } from './scripts.ts'
import { xmlIn } from './xml.ts'

const SIDES = { ours: 'dist/lemmon', theirs: 'dist/www' }

const ENTRIES = new Set(['/lib/common/index', '/lib/blur-hash/worker'])
const INPUT = new Set([
  '/robots.txt',
  '/assets/svg/common/ldn.svg',
  '/feed/a-post/index.md',
  '/feed/a-post/doc.pdf',
  '/lib/common/index.ts',
])
const OURS: Placing = { side: 'ours', entries: ENTRIES, input: INPUT }
const THEIRS: Placing = { ...OURS, side: 'theirs' }

/** One file of every category, as each build names it, and a file in none. */
const KINDS = {
  page: ['/index.html', '/feed/a-post/index.html'],
  xml: ['/feed.xml', '/tils/feed.xml'],
  bundle: {
    ours: '/assets/immutable/bundle/AAAAAAAAAA.css',
    theirs: '/assets/immutable/11ty/bundle/AAAAAAAAAA.css',
  },
  script: [
    '/lib/common/index.YDUDOD6U.js',
    '/lib/common/index.YDUDOD6U.js.map',
    '/lib/blur-hash/worker.KDF5YWST.js',
    '/lib/common/index.js',
    '/assets/immutable/11ty/esbuild/penumbra-simd_bg.5PRLBB64.wasm',
  ],
  passthrough: ['/robots.txt', '/assets/svg/common/ldn.svg', '/feed/a-post/doc.pdf'],
}

describe('categoriesOf()', () => {
  it('should take a page, an XML file, a script file and a passthrough file alike', () => {
    for (const category of ['page', 'xml', 'script', 'passthrough'] as const) {
      for (const url of KINDS[category]) {
        expect(categoriesOf(url, OURS), url).toEqual([category])
        expect(categoriesOf(url, THEIRS), url).toEqual([category])
      }
    }
  })

  it('should take each side’s bundle, and not the other side’s', () => {
    expect(categoriesOf(KINDS.bundle.ours, OURS)).toEqual(['bundle'])
    expect(categoriesOf(KINDS.bundle.theirs, THEIRS)).toEqual(['bundle'])
    expect(categoriesOf(KINDS.bundle.theirs, OURS)).toEqual([])
    expect(categoriesOf(KINDS.bundle.ours, THEIRS)).toEqual([])
  })

  it('should place no file no rule takes', () => {
    for (const url of [
      '/404.html',
      '/feed/a-post/photo.index.html',
      '/feed/a-post/index.md',
      '/lib/common/index.ts',
      '/lib/other/index.YDUDOD6U.js',
      '/lib/common/messages.js',
      '/assets/immutable/bundle/short.css',
      '/robots.txt.bak',
      '/.DS_Store',
    ]) {
      expect(categoriesOf(url, { ...OURS, input: new Set() }), url).toEqual([])
    }
  })

  it('should give every category a file two rules take', () => {
    const input = new Set(['/sitemap.xml', '/a/index.html', '/lib/common/index.js'])
    const at = { ...OURS, input }
    expect(categoriesOf('/sitemap.xml', at)).toEqual(['xml', 'passthrough'])
    expect(categoriesOf('/a/index.html', at)).toEqual(['page', 'passthrough'])
    expect(categoriesOf('/lib/common/index.js', at)).toEqual(['script', 'passthrough'])
  })
})

describe('isPassthrough()', () => {
  it('should take a file at the path of a file in the input, and no other', () => {
    expect(isPassthrough('/robots.txt', INPUT)).toBe(true)
    expect(isPassthrough('/feed/a-post/doc.pdf', INPUT)).toBe(true)
    expect(isPassthrough('/feed/doc.pdf', INPUT)).toBe(false)
    expect(isPassthrough('/Robots.txt', INPUT)).toBe(false)
    expect(isPassthrough('/feed/a-post/', INPUT)).toBe(false)
  })
})

describe('inventoryOf()', () => {
  it('should place every file in its one category, and count them all', () => {
    const urls = [
      ...KINDS.passthrough,
      ...KINDS.script,
      KINDS.bundle.ours,
      ...KINDS.xml,
      ...KINDS.page,
    ]
    const inventory = inventoryOf(urls, OURS)
    expect(inventory).toEqual({
      files: 13,
      placed: {
        page: ['/feed/a-post/index.html', '/index.html'],
        xml: ['/feed.xml', '/tils/feed.xml'],
        bundle: [KINDS.bundle.ours],
        script: [...KINDS.script].sort(),
        passthrough: [...KINDS.passthrough].sort(),
      },
      unplaced: [],
      ambiguous: [],
    })
    expect(inventoryFailed(inventory)).toBe(false)
  })

  it('should fail a file in no category, and one in several, placing neither', () => {
    const at = { ...OURS, input: new Set([...INPUT, '/sitemap.xml']) }
    const inventory = inventoryOf(['/robots.txt', '/404.html', '/sitemap.xml'], at)
    expect(inventory.placed.passthrough).toEqual(['/robots.txt'])
    expect(inventory.placed.xml).toEqual([])
    expect(inventory.unplaced).toEqual(['/404.html'])
    expect(inventory.ambiguous).toEqual([
      { url: '/sitemap.xml', categories: ['xml', 'passthrough'] },
    ])
    expect(inventoryFailed(inventory)).toBe(true)
    expect(inventoryFailed(inventoryOf(['/404.html'], OURS))).toBe(true)
  })

  it('should fail a file in several categories, where it is the only misfit', () => {
    const at = { ...OURS, input: new Set(['/sitemap.xml']) }
    const inventory = inventoryOf(['/sitemap.xml'], at)
    expect(inventory.unplaced).toEqual([])
    expect(inventoryFailed(inventory)).toBe(true)
    const ok = inventoryOf([], THEIRS)
    expect(inventoryLines({ ours: inventory, theirs: ok }, SIDES)[0]).toBe(
      'files: FAIL, 1 in no category or in several'
    )
  })
})

describe('the walkers', () => {
  let dists: string

  beforeEach(async () => {
    dists = await mkdtemp(join(tmpdir(), 'parity-inventory-'))
  })

  afterEach(async () => {
    await rm(dists, { recursive: true, force: true })
  })

  it('should each read exactly the files the inventory places in its category', async () => {
    for (const [side, at] of [
      ['ours', OURS],
      ['theirs', THEIRS],
    ] as const) {
      const dist = join(dists, side)
      for (const url of [
        ...KINDS.page,
        ...KINDS.xml,
        KINDS.bundle.ours,
        KINDS.bundle.theirs,
        ...KINDS.script,
        ...KINDS.passthrough,
        '/404.html',
        '/feed/a-post/notes.md',
      ]) {
        await mkdir(join(dist, url, '..'), { recursive: true })
        await writeFile(join(dist, url), url)
      }
      const { placed, unplaced } = inventoryOf(await everyFile(dist), at)
      expect(unplaced.length, side).toBe(3)
      const bundles = await bundlesIn(dist, dist)
      const pages = await pagesIn(dist)
      expect(pages.map((url) => `${url}index.html`).sort()).toEqual(placed.page)
      expect(await xmlIn(dist)).toEqual(placed.xml)
      expect([...bundles[side].keys()]).toEqual(placed.bundle)
      expect([...(await scriptsIn(dist, ENTRIES)).keys()]).toEqual(placed.script)
      expect([...(await passthroughIn(dist, INPUT)).keys()]).toEqual(placed.passthrough)
    }
  })
})

describe('inventoryLines()', () => {
  const ours = inventoryOf(['/index.html', '/robots.txt', KINDS.bundle.ours], OURS)

  it('should count each side’s files by category under a passing verdict', () => {
    const theirs = inventoryOf(['/index.html', '/lib/common/index.js'], THEIRS)
    expect(inventoryLines({ ours, theirs }, SIDES)).toEqual([
      'files: ok, each in one category',
      '  dist/lemmon, 3 files: 1 page, 0 xml, 1 bundle, 0 script, 1 passthrough',
      '  dist/www, 2 files: 1 page, 0 xml, 0 bundle, 1 script, 0 passthrough',
    ])
  })

  it('should name each file in no category, or in several, by its build', () => {
    const input = new Set(['/sitemap.xml'])
    const theirs = inventoryOf(['/sitemap.xml', '/404.html'], { ...THEIRS, input })
    const odd = inventoryOf(['/index.htm'], OURS)
    expect(inventoryLines({ ours: odd, theirs }, SIDES)).toEqual([
      'files: FAIL, 3 in no category or in several',
      '  dist/lemmon, 1 files: 0 page, 0 xml, 0 bundle, 0 script, 0 passthrough',
      '  dist/www, 2 files: 0 page, 0 xml, 0 bundle, 0 script, 0 passthrough',
      '  dist/lemmon/index.htm: in no category',
      '  dist/www/404.html: in no category',
      '  dist/www/sitemap.xml: in 2 categories, xml and passthrough',
    ])
  })
})
