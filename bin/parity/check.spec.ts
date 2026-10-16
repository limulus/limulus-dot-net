import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import {
  comparePost,
  failed,
  miscounts,
  pageAt,
  postsIn,
  referenceFeed,
  reportLines,
  staleRows,
  type PageReport,
} from './check.ts'

const SIDES = { ours: 'dist/lemmon', theirs: 'dist/www' }
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
  const post = { url: '/feed/x/', feed: [], expected: {} }

  it('should report the side that has no page', () => {
    expect(comparePost({ ...post, ours: null, theirs: page('x') })).toEqual({
      url: '/feed/x/',
      missing: 'ours',
      miscounts: [],
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
})

describe('failed()', () => {
  const comparison = { differences: [], forgiven: new Map<string, number>(), matched: 1 }

  it('should fail a page missing, unexplained, or miscounted, and pass one that is none', () => {
    const ok: PageReport = { url: '/feed/x/', comparison, miscounts: [] }
    expect(failed(ok)).toBe(false)
    expect(failed({ url: '/feed/x/', missing: 'theirs', miscounts: [] })).toBe(true)
    const differences = [{ path: 'html', ours: '<html>', theirs: '<html>' }]
    expect(failed({ ...ok, comparison: { ...comparison, differences } })).toBe(true)
    expect(failed({ ...ok, miscounts: [{ name: 'x', forgave: 0, expected: 1 }] })).toBe(
      true
    )
  })
})

describe('reportLines()', () => {
  it('should name the build a missing page is missing from', () => {
    expect(reportLines({ url: '/feed/x/', missing: 'ours', miscounts: [] }, SIDES)).toEqual(
      ['/feed/x/: FAIL, no page in dist/lemmon']
    )
    expect(
      reportLines({ url: '/feed/x/', missing: 'theirs', miscounts: [] }, SIDES)
    ).toEqual(['/feed/x/: FAIL, no page in dist/www'])
  })

  it('should give a page where nothing differs one line', () => {
    const report = comparePost({
      url: '/feed/x/',
      ours: page('<p>a</p>'),
      theirs: page('<p>a</p>'),
      feed: [],
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
