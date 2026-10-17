import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import {
  comparePost,
  failed,
  filesIn,
  miscounts,
  pageAt,
  postsIn,
  referenceFeed,
  reportLines,
  staleRows,
  type PageReport,
} from './check.ts'
import { bundleName } from './classes.ts'

const SIDES = { ours: 'dist/lemmon', theirs: 'dist/www' }
const NO_CSS = { ours: new Map(), theirs: new Map(), globals: '' }
const page = (body: string) =>
  `<!doctype html><html><head></head><body>${body}</body></html>`

describe('postsIn()', () => {
  let dist: string

  beforeEach(async () => {
    dist = await mkdtemp(join(tmpdir(), 'parity-'))
  })

  afterEach(async () => {
    await rm(dist, { recursive: true, force: true })
  })

  it('should list each directory under feed/ that holds a page, by url', async () => {
    await mkdir(join(dist, 'feed/b-post'), { recursive: true })
    await writeFile(join(dist, 'feed/b-post/index.html'), page('b'))
    await mkdir(join(dist, 'feed/a-post'), { recursive: true })
    await writeFile(join(dist, 'feed/a-post/index.html'), page('a'))
    await mkdir(join(dist, 'feed/no-page'), { recursive: true })
    await writeFile(join(dist, 'feed/index.html'), page('feed'))
    expect(await postsIn(dist)).toEqual(['/feed/a-post/', '/feed/b-post/'])
  })

  it('should list nothing for a build with no feed/', async () => {
    expect(await postsIn(dist)).toEqual([])
  })

  it('should fail on anything but a missing directory', async () => {
    await writeFile(join(dist, 'feed'), 'not a directory')
    await expect(postsIn(dist)).rejects.toThrow(/ENOTDIR/)
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

describe('comparePost()', () => {
  const post = { url: '/feed/x/', feed: [], css: NO_CSS, expected: {} }

  it('should report the side that has no page', () => {
    expect(comparePost({ ...post, ours: null, theirs: page('x') })).toEqual({
      url: '/feed/x/',
      missing: 'ours',
      miscounts: [],
      refusals: [],
    })
    expect(comparePost({ ...post, ours: page('x'), theirs: null }).missing).toBe('theirs')
  })

  it('should compare the pages with the site’s display and the allowlist', () => {
    const report = comparePost({
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
    const report = comparePost({
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
      comparePost({
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
    const report = comparePost({
      url: '/feed/x/',
      ours: page('<p>a</p>'),
      theirs: page('<p>a</p>'),
      feed: [],
      css: NO_CSS,
      expected: {},
    })
    expect(reportLines(report, SIDES)).toEqual(['/feed/x/: ok, 5 matched, 0 unexplained'])
  })

  it('should list what fails a page: each difference with both sides, then miscounts', () => {
    const report = comparePost({
      url: '/feed/x/',
      ours: page('<data-chip class="dataChip">a</data-chip><p class="x">b</p><p>c</p>'),
      theirs: page('<data-chip class="wvormuvo0">a</data-chip><p class="y">b</p>'),
      feed: [],
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

describe('referenceFeed()', () => {
  it('should read the feed posts’ cards off the feed index, or say there is none', () => {
    const card = (url: string) =>
      `<li><article-card><a href="${url}"><time datetime="2026-01-01T00:00:00.000Z">t</time></a></article-card></li>`
    const index = page(
      `<article-list><ul>${card('/links/x/')}${card('/feed/a/')}</ul></article-list>`
    )
    expect(referenceFeed(index)?.map(({ href }) => href)).toEqual(['/feed/a/'])
    expect(referenceFeed(null)).toBeNull()
  })
})

describe('staleRows()', () => {
  it('should name each row for a url neither build wrote', () => {
    const expected = { '/feed/a/': {}, '/feed/gone/': {}, '/feed/b/': {} }
    expect(staleRows(expected, ['/feed/a/', '/feed/b/'])).toEqual(['/feed/gone/'])
  })
})
