import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import {
  bundlesIn,
  comparePage,
  failed,
  filesIn,
  miscounts,
  pageAt,
  pagesIn,
  reportLines,
  rosterOf,
  staleRows,
  type PageReport,
} from './check.ts'
import { bundleName } from './classes.ts'

const SIDES = { ours: 'dist/lemmon', theirs: 'dist/www' }
const NO_CSS = { ours: new Map(), theirs: new Map(), globals: '' }
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
    expect(await pagesIn(dist)).toEqual({
      pages: [
        '/',
        '/404/',
        '/feed/',
        '/feed/the-rebound/',
        '/links/2026/02/07/good-taste/',
      ],
      strays: [],
    })
  })

  it('should name every other .html file a stray, and leave out what is not HTML', async () => {
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
    expect(await pagesIn(dist)).toEqual({
      pages: ['/feed/a-post/'],
      strays: ['404.html', 'feed/a-post/photo.index.html'],
    })
  })

  it('should list nothing where the build wrote no dist', async () => {
    expect(await pagesIn(join(dist, 'missing'))).toEqual({ pages: [], strays: [] })
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

  it('should fail a page only one build wrote, as missing from the other', async () => {
    const dist = await mkdtemp(join(tmpdir(), 'parity-roster-'))
    try {
      for (const side of ['ours', 'theirs']) {
        await mkdir(join(dist, side, 'both'), { recursive: true })
        await writeFile(join(dist, side, 'both', 'index.html'), page('x'))
      }
      await mkdir(join(dist, 'theirs', 'only'), { recursive: true })
      await writeFile(join(dist, 'theirs', 'only', 'index.html'), page('x'))
      const sides = { ours: join(dist, 'ours'), theirs: join(dist, 'theirs') }
      const urls = rosterOf(
        (await pagesIn(sides.ours)).pages,
        (await pagesIn(sides.theirs)).pages
      )
      expect(urls).toEqual(['/both/', '/only/'])
      const report = comparePage({
        url: '/only/',
        ours: await pageAt(sides.ours, '/only/'),
        theirs: await pageAt(sides.theirs, '/only/'),
        css: NO_CSS,
        expected: {},
      })
      expect(report.missing).toBe('ours')
      expect(failed(report)).toBe(true)
    } finally {
      await rm(dist, { recursive: true, force: true })
    }
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

  it('should read a page by url, or say there is none', async () => {
    await mkdir(join(dist, 'feed/a-post'), { recursive: true })
    await writeFile(join(dist, 'feed/a-post/index.html'), page('a'))
    expect(await pageAt(dist, '/feed/a-post/')).toBe(page('a'))
    expect(await pageAt(dist, '/feed/b-post/')).toBeNull()
    await mkdir(join(dist, 'feed/odd/index.html'), { recursive: true })
    await expect(pageAt(dist, '/feed/odd/')).rejects.toThrow(/EISDIR/)
  })
})

describe('filesIn()', () => {
  let dist: string

  beforeEach(async () => {
    dist = await mkdtemp(join(tmpdir(), 'parity-'))
  })

  afterEach(async () => {
    await rm(dist, { recursive: true, force: true })
  })

  it('should read each file in a directory as bytes, by its url', async () => {
    await mkdir(join(dist, 'assets/bundle'), { recursive: true })
    await writeFile(join(dist, 'assets/bundle/b.css'), 'b{}')
    await writeFile(join(dist, 'assets/bundle/a.css'), 'a{}')
    const files = await filesIn(dist, '/assets/bundle/')
    expect([...files.keys()]).toEqual(['/assets/bundle/a.css', '/assets/bundle/b.css'])
    expect(files.get('/assets/bundle/a.css')).toEqual(Buffer.from('a{}'))
  })

  it('should read nothing where the build wrote no such directory', async () => {
    expect(await filesIn(dist, '/assets/bundle/')).toEqual(new Map())
  })

  it('should fail on anything but a missing directory', async () => {
    await mkdir(join(dist, 'assets'), { recursive: true })
    await writeFile(join(dist, 'assets/bundle'), 'not a directory')
    await expect(filesIn(dist, '/assets/bundle/')).rejects.toThrow(/ENOTDIR/)
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
    const compared = (globals: string) =>
      comparePage({
        ...post,
        ours: head(OURS),
        theirs: head(THEIRS),
        css: {
          ours: new Map([[OURS, bytes]]),
          theirs: new Map([[THEIRS, bytes]]),
          globals,
        },
        expected: { 'css-bundle': 1 },
      })

    it('should give css-bundle both builds’ bundles and the global stylesheets', () => {
      const report = compared(GLOBALS)
      expect(report.comparison?.differences).toEqual([])
      expect(report.refusals).toEqual([])
      expect(failed(report)).toBe(false)
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

  it("should read both builds' bundles and the stylesheets", async () => {
    const [ours, theirs] = [join(dists, 'ours'), join(dists, 'theirs')]
    await mkdir(join(ours, 'assets/immutable/bundle'), { recursive: true })
    await writeFile(join(ours, 'assets/immutable/bundle/a.css'), 'a{}')
    await mkdir(join(theirs, 'assets/immutable/11ty/bundle'), { recursive: true })
    await writeFile(join(theirs, 'assets/immutable/11ty/bundle/b.css'), 'b{}')
    const css = await bundlesIn(ours, theirs)
    expect([...css.ours.keys()]).toEqual(['/assets/immutable/bundle/a.css'])
    expect([...css.theirs.keys()]).toEqual(['/assets/immutable/11ty/bundle/b.css'])
    const sheet = (name: string) =>
      readFile(new URL(`../../www/_includes/css/${name}.css`, import.meta.url), 'utf8')
    const sheets = await Promise.all(['normalize', 'main', 'hljs-github'].map(sheet))
    expect(css.globals).toBe(sheets.map((text) => text.trim()).join('\n'))
  })
})

describe('staleRows()', () => {
  it('should name each row for a url no page compared has', () => {
    const expected = { '/feed/a/': {}, '/feed/gone/': {}, '/feed/b/': {} }
    expect(staleRows(expected, ['/feed/a/', '/feed/b/'])).toEqual(['/feed/gone/'])
  })
})
