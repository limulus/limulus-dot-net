import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import {
  bundleLines,
  bundlesIn,
  comparePage,
  failed,
  miscounts,
  pageAt,
  pagesIn,
  reportLines,
  rosterOf,
  staleRows,
  unlinked,
  type PageReport,
} from './check.ts'
import { bundleName, type Bundles } from './classes.ts'

const SIDES = { ours: 'dist/lemmon', theirs: 'dist/www' }
const NO_CSS = {
  ours: new Map(),
  theirs: new Map(),
  globals: '',
  linked: new Set<string>(),
}
const page = (body: string) =>
  `<!doctype html><html><head></head><body>${body}</body></html>`

describe('pagesIn()', () => {
  let dist: string

  beforeEach(async () => {
    dist = await mkdtemp(join(tmpdir(), 'parity-'))
  })

  afterEach(async () => {
    await rm(dist, { recursive: true, force: true })
  })

  /** Writes each file named, relative to the dist. */
  const files = async (...paths: string[]) => {
    for (const path of paths) {
      await mkdir(join(dist, path, '..'), { recursive: true })
      await writeFile(join(dist, path), 'x')
    }
  }

  it('should list the url of every index.html at any depth, the root’s as /', async () => {
    await files(
      'index.html',
      'feed/the-rebound/index.html',
      'feed/index.html',
      '404/index.html',
      'links/2026/02/07/good-taste/index.html'
    )
    expect(await pagesIn(dist)).toEqual([
      '/',
      '/404/',
      '/feed/',
      '/feed/the-rebound/',
      '/links/2026/02/07/good-taste/',
    ])
  })

  it('should leave out every other .html file, and what is not HTML', async () => {
    await files(
      'feed.xml',
      'sitemap.xml',
      'tils/feed.xml',
      'feed/a-post/index.html',
      'feed/a-post/photo.index.html',
      'feed/a-post/index.htm',
      '404.html',
      'assets/immutable/bundle/a.css',
      'lib/common/index.ABCDEFGH.js'
    )
    expect(await pagesIn(dist)).toEqual(['/feed/a-post/'])
  })

  it('should list nothing where the build wrote no dist', async () => {
    expect(await pagesIn(join(dist, 'missing'))).toEqual([])
  })

  it('should fail on anything but a missing dist', async () => {
    await writeFile(join(dist, 'file'), 'not a directory')
    await expect(pagesIn(join(dist, 'file'))).rejects.toThrow(/ENOTDIR/)
  })
})

describe('rosterOf()', () => {
  it('should compare every page either build wrote, once each, sorted', () => {
    expect(rosterOf(['/b/', '/', '/c/'], ['/c/', '/a/', '/'])).toEqual([
      '/',
      '/a/',
      '/b/',
      '/c/',
    ])
  })

  /**
   * The report on every page of two dists holding a page at each path given, read as
   * parity.ts reads them: each side by its own listing.
   */
  const reports = async (paths: { ours: string[]; theirs: string[] }) => {
    const dist = await mkdtemp(join(tmpdir(), 'parity-roster-'))
    try {
      const sides = { ours: join(dist, 'ours'), theirs: join(dist, 'theirs') }
      for (const side of ['ours', 'theirs'] as const) {
        for (const path of paths[side]) {
          await mkdir(join(sides[side], path), { recursive: true })
          await writeFile(join(sides[side], path, 'index.html'), page('x'))
        }
      }
      const pages = { ours: await pagesIn(sides.ours), theirs: await pagesIn(sides.theirs) }
      const found: Record<string, 'ours' | 'theirs' | 'ok'> = {}
      for (const url of rosterOf(pages.ours, pages.theirs)) {
        const report = comparePage({
          url,
          ours: await pageAt(sides.ours, url, pages.ours),
          theirs: await pageAt(sides.theirs, url, pages.theirs),
          css: NO_CSS,
          expected: {},
        })
        expect(failed(report), url).toBe(report.missing !== undefined)
        found[url] = report.missing ?? 'ok'
      }
      return found
    } finally {
      await rm(dist, { recursive: true, force: true })
    }
  }

  it('should fail a page only one build wrote, as missing from the other', async () => {
    expect(await reports({ ours: ['both'], theirs: ['both', 'only'] })).toEqual({
      '/both/': 'ok',
      '/only/': 'ours',
    })
  })

  it('should fail a page the builds name in another letter case, missing from each', async () => {
    expect(await reports({ ours: ['Extra'], theirs: ['extra'] })).toEqual({
      '/Extra/': 'theirs',
      '/extra/': 'ours',
    })
  })

  it('should fail a page the builds name in another Unicode form, missing from each', async () => {
    const [nfc, nfd] = ['caf\u00e9', 'cafe\u0301']
    expect(await reports({ ours: [nfc], theirs: [nfd] })).toEqual({
      [`/${nfc}/`]: 'theirs',
      [`/${nfd}/`]: 'ours',
    })
  })
})

describe('pageAt()', () => {
  let dist: string

  beforeEach(async () => {
    dist = await mkdtemp(join(tmpdir(), 'parity-'))
  })

  afterEach(async () => {
    await rm(dist, { recursive: true, force: true })
  })

  it('should read a page only where the listing holds its url exactly', async () => {
    await mkdir(join(dist, 'feed/a-post'), { recursive: true })
    await writeFile(join(dist, 'feed/a-post/index.html'), page('a'))
    const pages = await pagesIn(dist)
    expect(await pageAt(dist, '/feed/a-post/', pages)).toBe(page('a'))
    expect(await pageAt(dist, '/feed/b-post/', pages)).toBeNull()
    expect(await pageAt(dist, '/feed/A-Post/', pages)).toBeNull()
    expect(await pageAt(dist, '/feed/a-post/', [])).toBeNull()
  })

  it('should pass on an error reading a page the listing holds', async () => {
    await mkdir(join(dist, 'feed/odd/index.html'), { recursive: true })
    await expect(pageAt(dist, '/feed/odd/', ['/feed/odd/'])).rejects.toThrow(/EISDIR/)
  })
})

describe('miscounts()', () => {
  it('should report a class that fired more, fewer, or never, by name', () => {
    const forgiven = new Map([
      ['b-more', 3],
      ['a-unexpected', 1],
      ['d-right', 2],
    ])
    expect(miscounts({ 'b-more': 2, 'c-never': 1, 'd-right': 2 }, forgiven)).toEqual([
      { name: 'a-unexpected', forgave: 1, expected: 0 },
      { name: 'b-more', forgave: 3, expected: 2 },
      { name: 'c-never', forgave: 0, expected: 1 },
    ])
  })
})

describe('comparePage()', () => {
  const post = { url: '/feed/x/', css: NO_CSS, expected: {} }

  it('should report the side that has no page', () => {
    expect(comparePage({ ...post, ours: null, theirs: page('x') })).toEqual({
      url: '/feed/x/',
      missing: 'ours',
      miscounts: [],
      refusals: [],
    })
    expect(comparePage({ ...post, ours: page('x'), theirs: null }).missing).toBe('theirs')
  })

  it('should compare the pages with the site’s display and the allowlist', () => {
    const report = comparePage({
      ...post,
      ours: page('<data-chip class="dataChip"> <b>a</b> </data-chip>'),
      theirs: page('<data-chip class="wvormuvo0"><b>a</b></data-chip>'),
      expected: { 'scoped-class': 1 },
    })
    expect(report.comparison?.differences).toEqual([])
    expect(report.miscounts).toEqual([])
    expect(failed(report)).toBe(false)
  })

  it('should hold the classes to the expected counts', () => {
    const report = comparePage({
      ...post,
      ours: page('<data-chip class="dataChip">a</data-chip>'),
      theirs: page('<data-chip class="wvormuvo0">a</data-chip>'),
      expected: { 'scoped-class': 2 },
    })
    expect(report.miscounts).toEqual([{ name: 'scoped-class', forgave: 1, expected: 2 }])
    expect(failed(report)).toBe(true)
  })

  describe('with a bundle link on each side', () => {
    const GLOBALS = 'a{}'
    const bytes = Buffer.from(GLOBALS)
    const OURS = `/assets/immutable/bundle/${bundleName(bytes)}.css`
    const THEIRS = `/assets/immutable/11ty/bundle/${bundleName(bytes)}.css`
    const head = (href: string) =>
      `<!doctype html><html><head><link rel="stylesheet" href="${href}"></head>` +
      '<body></body></html>'
    const bundles = (globals: string): Bundles => ({
      ours: new Map([[OURS, bytes]]),
      theirs: new Map([[THEIRS, bytes]]),
      globals,
      linked: new Set(),
    })
    const compared = (globals: string, css = bundles(globals)) =>
      comparePage({
        ...post,
        ours: head(OURS),
        theirs: head(THEIRS),
        css,
        expected: { 'css-bundle': 1 },
      })

    it('should give css-bundle both builds’ bundles and the global stylesheets', () => {
      const report = compared(GLOBALS)
      expect(report.comparison?.differences).toEqual([])
      expect(report.refusals).toEqual([])
      expect(failed(report)).toBe(false)
    })

    it('should leave each bundle the page links linked, and no other', () => {
      const css = bundles(GLOBALS)
      const spare = Buffer.from('b{}')
      const SPARE = `/assets/immutable/bundle/${bundleName(spare)}.css`
      css.ours.set(SPARE, spare)
      expect(unlinked(css)).toEqual([OURS, SPARE, THEIRS])
      expect(failed(compared(GLOBALS, css))).toBe(false)
      expect(unlinked(css)).toEqual([SPARE])
    })

    it('should report why css-bundle refused, under the difference it left', () => {
      const report = compared('b{}')
      expect(failed(report)).toBe(true)
      expect(reportLines(report, SIDES)).toEqual([
        '/feed/x/: FAIL, 3 matched, 1 unexplained',
        '  --- html > head[0] > link[0] (attributes differ: href)',
        `  -<link rel="stylesheet" href="${THEIRS}">`,
        `  +<link rel="stylesheet" href="${OURS}">`,
        '  css-bundle: ours does not end with the global stylesheets, ' +
          'at offset 2 from the end, "a{}" where expected "b{}"',
        '  miscounted: css-bundle forgave 0, expected 1',
      ])
    })
  })
})

describe('failed()', () => {
  const comparison = { differences: [], forgiven: new Map<string, number>(), matched: 1 }

  it('should fail a page missing, unexplained, or miscounted, and pass one that is none', () => {
    const ok: PageReport = { url: '/feed/x/', comparison, miscounts: [], refusals: [] }
    expect(failed(ok)).toBe(false)
    expect(
      failed({ url: '/feed/x/', missing: 'theirs', miscounts: [], refusals: [] })
    ).toBe(true)
    const differences = [{ path: 'html', ours: '<html>', theirs: '<html>' }]
    expect(failed({ ...ok, comparison: { ...comparison, differences } })).toBe(true)
    expect(failed({ ...ok, miscounts: [{ name: 'x', forgave: 0, expected: 1 }] })).toBe(
      true
    )
  })
})

describe('reportLines()', () => {
  it('should name the build a missing page is missing from', () => {
    const missing = { url: '/feed/x/', miscounts: [], refusals: [] }
    expect(reportLines({ ...missing, missing: 'ours' }, SIDES)).toEqual([
      '/feed/x/: FAIL, no page in dist/lemmon',
    ])
    expect(reportLines({ ...missing, missing: 'theirs' }, SIDES)).toEqual([
      '/feed/x/: FAIL, no page in dist/www',
    ])
  })

  it('should give a page where nothing differs one line', () => {
    const report = comparePage({
      url: '/feed/x/',
      ours: page('<p>a</p>'),
      theirs: page('<p>a</p>'),
      css: NO_CSS,
      expected: {},
    })
    expect(reportLines(report, SIDES)).toEqual(['/feed/x/: ok, 5 matched, 0 unexplained'])
  })

  it('should list what fails a page: each difference with both sides, then miscounts', () => {
    const report = comparePage({
      url: '/feed/x/',
      ours: page('<data-chip class="dataChip">a</data-chip><p class="x">b</p><p>c</p>'),
      theirs: page('<data-chip class="wvormuvo0">a</data-chip><p class="y">b</p>'),
      css: NO_CSS,
      expected: {},
    })
    expect(reportLines(report, SIDES)).toEqual([
      '/feed/x/: FAIL, 5 matched, 2 unexplained',
      '  --- html > body[0] > p[0] (attributes differ: class)',
      '  -<p class="y">',
      '  +<p class="x">',
      '  --- html > body[0] > child 2',
      '  -(nothing)',
      '  +<p>',
      '  miscounted: scoped-class forgave 1, expected 0',
      '  forgiven: scoped-class 1',
    ])
  })
})

describe('bundlesIn()', () => {
  let dists: string

  beforeEach(async () => {
    dists = await mkdtemp(join(tmpdir(), 'parity-'))
  })

  afterEach(async () => {
    await rm(dists, { recursive: true, force: true })
  })

  /** Writes each file named, relative to `dist`, holding `text`. */
  const write = async (dist: string, text: string, ...paths: string[]) => {
    for (const path of paths) {
      await mkdir(join(dist, path, '..'), { recursive: true })
      await writeFile(join(dist, path), text)
    }
  }

  it("should read both builds' bundles and the stylesheets, none linked", async () => {
    const [ours, theirs] = [join(dists, 'ours'), join(dists, 'theirs')]
    await write(ours, 'a{}', 'assets/immutable/bundle/AAAAAAAAAA.css')
    await write(theirs, 'b{}', 'assets/immutable/11ty/bundle/BBBBBBBBBB.css')
    const css = await bundlesIn(ours, theirs)
    expect([...css.ours.keys()]).toEqual(['/assets/immutable/bundle/AAAAAAAAAA.css'])
    expect([...css.theirs.keys()]).toEqual(['/assets/immutable/11ty/bundle/BBBBBBBBBB.css'])
    expect(css.ours.get('/assets/immutable/bundle/AAAAAAAAAA.css')).toEqual(
      Buffer.from('a{}')
    )
    expect(css.linked).toEqual(new Set())
    const sheet = (name: string) =>
      readFile(new URL(`../../www/_includes/css/${name}.css`, import.meta.url), 'utf8')
    const sheets = await Promise.all(['normalize', 'main', 'hljs-github'].map(sheet))
    expect(css.globals).toBe(sheets.map((text) => text.trim()).join('\n'))
  })

  it('should read only what isBundle() takes for each side', async () => {
    const [ours, theirs] = [join(dists, 'ours'), join(dists, 'theirs')]
    const others = [
      'assets/immutable/bundle/short.css',
      'assets/immutable/bundle/AAAAAAAAAA.css.map',
      'assets/immutable/bundle/x/AAAAAAAAAA.css',
    ]
    await write(ours, 'x', 'assets/immutable/11ty/bundle/AAAAAAAAAA.css', ...others)
    await write(theirs, 'x', 'assets/immutable/bundle/AAAAAAAAAA.css', ...others)
    const css = await bundlesIn(ours, theirs)
    expect(css.ours).toEqual(new Map())
    expect(css.theirs).toEqual(new Map())
  })

  it('should read nothing where a build wrote no dist', async () => {
    const css = await bundlesIn(join(dists, 'ours'), join(dists, 'theirs'))
    expect(css.ours).toEqual(new Map())
    expect(css.theirs).toEqual(new Map())
  })
})

describe('bundleLines()', () => {
  const OURS = '/assets/immutable/bundle/AAAAAAAAAA.css'
  const THEIRS = '/assets/immutable/11ty/bundle/BBBBBBBBBB.css'
  const css = (linked: string[]): Bundles => ({
    ours: new Map([[OURS, Buffer.from('a{}')]]),
    theirs: new Map([[THEIRS, Buffer.from('a{}')]]),
    globals: '',
    linked: new Set(linked),
  })

  it('should pass where a page linked every bundle', () => {
    expect(bundleLines(css([OURS, THEIRS]), SIDES)).toEqual([
      'bundles: ok, 1 in dist/lemmon and 1 in dist/www, 0 linked by no page',
    ])
  })

  it('should fail naming each bundle no page linked, on either side', () => {
    expect(bundleLines(css([]), SIDES)).toEqual([
      'bundles: FAIL, 1 in dist/lemmon and 1 in dist/www, 2 linked by no page',
      `  dist/lemmon${OURS}`,
      `  dist/www${THEIRS}`,
    ])
  })
})

describe('staleRows()', () => {
  it('should name each row for a url no page compared has', () => {
    const expected = { '/feed/a/': {}, '/feed/gone/': {}, '/feed/b/': {} }
    expect(staleRows(expected, ['/feed/a/', '/feed/b/'])).toEqual(['/feed/gone/'])
  })
})
