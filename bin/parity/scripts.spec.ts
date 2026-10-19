import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import {
  compareScripts,
  entriesIn,
  ESBUILD_ASSETS,
  isScriptFile,
  isStub,
  scriptLines,
  scriptsFailed,
  scriptsIn,
} from './scripts.ts'

const SIDES = { ours: 'dist/lemmon', theirs: 'dist/www' }

/** A build's files by url, each given as text. */
const files = (entries: Record<string, string>): Map<string, Buffer> =>
  new Map(Object.entries(entries).map(([url, text]) => [url, Buffer.from(text)]))

const BUNDLE = '/lib/common/index.YDUDOD6U.js'
const STUB = "export * from '/lib/common/index.YDUDOD6U.js'"

const ENTRIES = new Set([
  '/lib/common/index',
  '/lib/blur-hash/worker',
  '/feed/a-post/index',
])

describe('lemmon.config.ts', () => {
  const config = () => readFile(new URL('../../lemmon.config.ts', import.meta.url), 'utf8')

  it('should have esbuild write what a bundle imports at ESBUILD_ASSETS', async () => {
    expect(await config()).toContain(
      `assetNames: '${ESBUILD_ASSETS.slice(1)}[name].[hash]'`
    )
  })

  it('should leave esbuild its default entry points, the ones entriesIn() finds', async () => {
    expect(await config()).not.toContain('entryPoints')
  })
})

describe('entriesIn()', () => {
  let input: string

  beforeEach(async () => {
    input = await mkdtemp(join(tmpdir(), 'parity-entries-'))
  })

  afterEach(async () => {
    await rm(input, { recursive: true, force: true })
  })

  it('should find every index.ts and worker.ts at any depth, by the url they name', async () => {
    for (const path of [
      'lib/common/index.ts',
      'lib/blur-hash/worker.ts',
      'lib/blur-hash/messages.ts',
      'lib/raf-polyfill.ts',
      'penumbra/journal/rust/lib/index.ts',
      'feed/a-post/index.md',
      'feed/a-post/index.ts',
      'lib/video-on-demand/globals.d.ts',
    ]) {
      await mkdir(join(input, path, '..'), { recursive: true })
      await writeFile(join(input, path), '')
    }
    expect([...(await entriesIn(input))].sort()).toEqual([
      '/feed/a-post/index',
      '/lib/blur-hash/worker',
      '/lib/common/index',
      '/penumbra/journal/rust/lib/index',
    ])
  })

  it('should find the site’s own entries, the penumbra posts’ among them', async () => {
    const entries = await entriesIn(fileURLToPath(new URL('../../www', import.meta.url)))
    expect(entries).toContain('/lib/common/index')
    expect(entries).toContain('/lib/sphere-shadow-wasm/worker')
    expect(entries).toContain('/penumbra/journal/tuples/lib/index')
  })
})

describe('isScriptFile()', () => {
  it('should take an entry’s bundles, styles and maps, wherever the entry is', () => {
    for (const url of [
      '/lib/common/index.YDUDOD6U.js',
      '/lib/common/index.YDUDOD6U.js.map',
      '/lib/common/index.ABCD2345.css',
      '/lib/common/index.ABCD2345.css.map',
      '/lib/blur-hash/worker.7AI64NJF.js',
      '/feed/a-post/index.ABCD2345.js',
    ]) {
      expect(isScriptFile(url, ENTRIES), url).toBe(true)
    }
  })

  it('should take the unhashed name beside an entry, where Eleventy writes its stub', () => {
    expect(isScriptFile('/lib/common/index.js', ENTRIES)).toBe(true)
  })

  it('should take every file under esbuild’s asset path', () => {
    expect(isScriptFile(`${ESBUILD_ASSETS}penumbra-simd_bg.5PRLBB64.wasm`, ENTRIES)).toBe(
      true
    )
  })

  it('should leave out what no entry names, under `lib` or not', () => {
    for (const url of [
      '/lib/other/index.YDUDOD6U.js',
      '/lib/common/messages.YDUDOD6U.js',
      '/lib/common/index.ydudod6u.js',
      '/lib/common/index.YDUDOD6U.txt',
      '/lib/common/index.html',
      '/feed/a-post/index.html',
      '/feed/the-rebound/index.ABCD2345.js',
      '/assets/immutable/11ty/bundle/AbCdEfGhIj.css',
      '/assets/fonts/mona-sans-2.eb9c59a4.woff2',
    ]) {
      expect(isScriptFile(url, ENTRIES), url).toBe(false)
    }
  })
})

describe('scriptsIn()', () => {
  let dist: string

  beforeEach(async () => {
    dist = await mkdtemp(join(tmpdir(), 'parity-scripts-'))
  })

  afterEach(async () => {
    await rm(dist, { recursive: true, force: true })
  })

  const write = async (path: string, text: string) => {
    await mkdir(join(dist, path, '..'), { recursive: true })
    await writeFile(join(dist, path), text)
  }

  it('should read every script file of the entries by url, sorted, and nothing else', async () => {
    await write('lib/common/index.YDUDOD6U.js', 'common')
    await write('lib/common/index.js', STUB)
    await write('feed/a-post/index.G3GNHGBK.js', 'post')
    await write('feed/a-post/index.html', 'page')
    await write('assets/immutable/11ty/esbuild/a.5PRLBB64.wasm', 'wasm')
    await write('lib/rum/index.VATR7HHP.js', 'not an entry here')
    await write('assets/immutable/11ty/bundle/AbCdEfGhIj.css', 'css')
    const read = await scriptsIn(dist, ENTRIES)
    expect([...read.keys()]).toEqual([
      '/assets/immutable/11ty/esbuild/a.5PRLBB64.wasm',
      '/feed/a-post/index.G3GNHGBK.js',
      '/lib/common/index.YDUDOD6U.js',
      '/lib/common/index.js',
    ])
    expect(read.get('/feed/a-post/index.G3GNHGBK.js')?.toString()).toBe('post')
  })
})

describe('isStub()', () => {
  const theirs = files({ [BUNDLE]: 'bundle', '/lib/common/index.js': STUB })

  it('should take Eleventy’s stub, re-exporting the bundle hashed beside it', () => {
    expect(isStub('/lib/common/index.js', Buffer.from(STUB), theirs)).toBe(true)
  })

  it('should not take a stub naming a bundle the build did not write', () => {
    expect(isStub('/lib/common/index.js', Buffer.from(STUB), files({}))).toBe(false)
  })

  it('should not take a stub naming another entry’s bundle', () => {
    expect(isStub('/lib/rum/index.js', Buffer.from(STUB), theirs)).toBe(false)
    const worker = "export * from '/lib/common/worker.YDUDOD6U.js'"
    expect(isStub('/lib/common/index.js', Buffer.from(worker), theirs)).toBe(false)
  })

  it('should not take a file holding anything more, or an unhashed target', () => {
    for (const text of [
      `${STUB}\n`,
      `${STUB};`,
      `${STUB}\nexport default 1`,
      "export * from '/lib/common/index.js'",
      'export * from "/lib/common/index.YDUDOD6U.js"',
    ]) {
      expect(isStub('/lib/common/index.js', Buffer.from(text), theirs), text).toBe(false)
    }
  })
})

describe('compareScripts()', () => {
  const WORKER = '/lib/blur-hash/worker.7AI64NJF.js'
  const WORKER_STUB = "export * from '/lib/blur-hash/worker.7AI64NJF.js'"
  const compare = (ours: Record<string, string>, theirs: Record<string, string>) =>
    compareScripts(files(ours), files(theirs), ENTRIES)

  it('should count the files both wrote alike, and set the stubs aside', () => {
    const report = compare(
      { [BUNDLE]: 'bundle', [`${BUNDLE}.map`]: 'map' },
      { [BUNDLE]: 'bundle', [`${BUNDLE}.map`]: 'map', '/lib/common/index.js': STUB }
    )
    expect(report).toEqual({
      identical: 2,
      setAside: ['/lib/common/index.js'],
      differences: [],
      unstubbed: [],
    })
    expect(scriptsFailed(report)).toBe(false)
  })

  it('should report a file only Eleventy wrote that is no stub', () => {
    const report = compare({}, { [BUNDLE]: 'bundle', '/lib/common/index.js': `${STUB}\n` })
    expect(report.differences).toEqual([
      { url: '/lib/common/index.YDUDOD6U.js', in: 'theirs' },
      { url: '/lib/common/index.js', in: 'theirs' },
    ])
    expect(report.setAside).toEqual([])
    expect(scriptsFailed(report)).toBe(true)
  })

  it('should report a file only ours wrote', () => {
    const report = compare({ [BUNDLE]: 'bundle' }, {})
    expect(report.differences).toEqual([{ url: BUNDLE, in: 'ours' }])
  })

  it('should compare a stub ours wrote too, as any other file, leaving it unset', () => {
    const report = compare(
      { [BUNDLE]: 'bundle', '/lib/common/index.js': 'other' },
      { [BUNDLE]: 'bundle', '/lib/common/index.js': STUB }
    )
    expect(report.setAside).toEqual([])
    expect(report.differences).toEqual([
      {
        url: '/lib/common/index.js',
        in: 'both',
        detail: 'from byte 0; ours 5 bytes, theirs 45',
      },
    ])
    expect(report.unstubbed).toEqual([BUNDLE])
  })

  it('should fail each entry bundle of Eleventy’s with no stub set aside beside it', () => {
    const bundles = { [BUNDLE]: 'bundle', [WORKER]: 'worker' }
    const report = compare(bundles, { ...bundles, '/lib/common/index.js': STUB })
    expect(report.differences).toEqual([])
    expect(report.setAside).toEqual(['/lib/common/index.js'])
    expect(report.unstubbed).toEqual([WORKER])
    expect(scriptsFailed(report)).toBe(true)
    const both = compare(bundles, {
      ...bundles,
      '/lib/common/index.js': STUB,
      '/lib/blur-hash/worker.js': WORKER_STUB,
    })
    expect(both.unstubbed).toEqual([])
    expect(scriptsFailed(both)).toBe(false)
  })

  it('should ask no stub beside a file that is no entry’s bundle', () => {
    const written = {
      [`${BUNDLE}.map`]: 'map',
      '/lib/common/index.ABCD2345.css': 'css',
      '/lib/other/index.YDUDOD6U.js': 'not an entry',
      [`${ESBUILD_ASSETS}penumbra-simd_bg.5PRLBB64.wasm`]: 'wasm',
    }
    expect(compare(written, written).unstubbed).toEqual([])
  })

  it('should say where two files part, one byte apart or one a prefix', () => {
    const report = compare(
      { '/lib/a.js': 'abcdef', '/lib/b.js': 'abc' },
      { '/lib/a.js': 'abcxef', '/lib/b.js': 'abcd' }
    )
    expect(report.differences).toEqual([
      { url: '/lib/a.js', in: 'both', detail: 'from byte 3; ours 6 bytes, theirs 6' },
      { url: '/lib/b.js', in: 'both', detail: 'from byte 3; ours 3 bytes, theirs 4' },
    ])
  })

  it('should fail where neither build wrote a script to compare', () => {
    expect(scriptsFailed(compare({}, {}))).toBe(true)
  })
})

describe('scriptLines()', () => {
  const compare = (ours: Record<string, string>, theirs: Record<string, string>) =>
    compareScripts(files(ours), files(theirs), ENTRIES)

  it('should summarize a pass in one line', () => {
    const report = compare(
      { [BUNDLE]: 'bundle' },
      { [BUNDLE]: 'bundle', '/lib/common/index.js': STUB }
    )
    expect(scriptLines(report, SIDES)).toEqual([
      "scripts: ok, 1 files alike byte for byte, 0 differ; 1 of Eleventy's unhashed " +
        'stubs set aside',
    ])
  })

  it('should list each difference under a failing summary', () => {
    const report = compare(
      { [BUNDLE]: 'bundle', '/lib/a.js': 'a', '/lib/b.js': 'x' },
      {
        [BUNDLE]: 'bundle',
        '/lib/common/index.js': STUB,
        '/lib/c.js': 'c',
        '/lib/b.js': 'y',
      }
    )
    expect(scriptLines(report, SIDES)).toEqual([
      "scripts: FAIL, 1 files alike byte for byte, 3 differ; 1 of Eleventy's unhashed " +
        'stubs set aside',
      '  /lib/a.js: only in dist/lemmon',
      '  /lib/b.js: differs from byte 0; ours 1 bytes, theirs 1',
      '  /lib/c.js: only in dist/www',
    ])
  })

  it('should fail naming each entry bundle with no stub set aside', () => {
    const report = compare({ [BUNDLE]: 'bundle' }, { [BUNDLE]: 'bundle' })
    expect(scriptLines(report, SIDES)).toEqual([
      "scripts: FAIL, 1 files alike byte for byte, 0 differ; 0 of Eleventy's unhashed " +
        'stubs set aside',
      `  ${BUNDLE}: Eleventy's entry bundle, with no stub set aside beside it`,
    ])
  })

  it('should say so where neither build wrote a script', () => {
    expect(scriptLines(compare({}, {}), SIDES)).toEqual([
      "scripts: FAIL, neither build wrote any; 0 of Eleventy's unhashed stubs set aside",
    ])
  })
})
