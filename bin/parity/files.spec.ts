import { mkdir, mkdtemp, rm, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { bytesFailed, bytesLines, compareBytes, everyFile, filesWhere } from './files.ts'

const SIDES = { ours: 'dist/lemmon', theirs: 'dist/www' }

/** A build's files by url, each given as text. */
const files = (entries: Record<string, string>): Map<string, Buffer> =>
  new Map(Object.entries(entries).map(([url, text]) => [url, Buffer.from(text)]))

describe('everyFile()', () => {
  let dir: string

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'parity-files-'))
  })

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true })
  })

  const write = async (path: string, text = 'x') => {
    await mkdir(join(dir, path, '..'), { recursive: true })
    await writeFile(join(dir, path), text)
  }

  it('should list every file at any depth by url, sorted, and no directory', async () => {
    await write('robots.txt')
    await write('feed/a-post/index.html')
    await write('.hidden')
    await write('assets/svg/common/bell-solid.svg')
    await mkdir(join(dir, 'empty'))
    expect(await everyFile(dir)).toEqual([
      '/.hidden',
      '/assets/svg/common/bell-solid.svg',
      '/feed/a-post/index.html',
      '/robots.txt',
    ])
  })

  it('should list a symbolic link as the file it stands for', async () => {
    await write('assets/svg/ldn.svg')
    await symlink('../ldn.svg', join(dir, 'assets/svg/link.svg'))
    expect(await everyFile(dir)).toEqual(['/assets/svg/ldn.svg', '/assets/svg/link.svg'])
  })

  it('should list nothing where there is no such directory', async () => {
    expect(await everyFile(join(dir, 'missing'))).toEqual([])
  })

  it('should fail on anything but a missing directory', async () => {
    await write('file')
    await expect(everyFile(join(dir, 'file'))).rejects.toThrow(/ENOTDIR/)
  })

  describe('filesWhere()', () => {
    it('should read every file the predicate takes, by url, as bytes', async () => {
      await write('a.txt', 'a')
      await write('b/c.txt', 'c')
      await write('b/d.css', 'd')
      const read = await filesWhere(dir, (url) => url.endsWith('.txt'))
      expect(read).toEqual(files({ '/a.txt': 'a', '/b/c.txt': 'c' }))
    })
  })
})

describe('compareBytes()', () => {
  const STUB = "export * from '/lib/common/index.YDUDOD6U.js'"

  it('should count the files both wrote alike', () => {
    const report = compareBytes(files({ '/a.svg': 'a' }), files({ '/a.svg': 'a' }))
    expect(report).toEqual({ identical: 1, setAside: [], differences: [] })
    expect(bytesFailed(report)).toBe(false)
  })

  it('should report a file only one build wrote, either way, setting nothing aside', () => {
    const report = compareBytes(
      files({ '/a.svg': 'a', '/robots.txt': 'r' }),
      files({ '/a.svg': 'a', '/lib/common/index.js': STUB, '/feed.xsl': 'x' })
    )
    expect(report).toEqual({
      identical: 1,
      setAside: [],
      differences: [
        { url: '/feed.xsl', in: 'theirs' },
        { url: '/lib/common/index.js', in: 'theirs' },
        { url: '/robots.txt', in: 'ours' },
      ],
    })
    expect(bytesFailed(report)).toBe(true)
  })

  it('should set aside only a file Eleventy alone wrote that the rule takes', () => {
    const setAside = (url: string) => url === '/stub.js'
    const report = compareBytes(
      files({ '/stub.js': 'ours too', '/a.js': 'a' }),
      files({ '/stub.js': 'theirs', '/a.js': 'a', '/other.js': 'o' }),
      setAside
    )
    expect(report.setAside).toEqual([])
    expect(report.differences.map(({ url }) => url)).toEqual(['/other.js', '/stub.js'])
    const alone = compareBytes(files({}), files({ '/stub.js': 'theirs' }), setAside)
    expect(alone).toEqual({ identical: 0, setAside: ['/stub.js'], differences: [] })
  })

  it('should say where two files part, one byte apart or one a prefix', () => {
    const report = compareBytes(
      files({ '/a.pdf': 'abcdef', '/b.pdf': 'abc' }),
      files({ '/a.pdf': 'abcxef', '/b.pdf': 'abcd' })
    )
    expect(report.differences).toEqual([
      { url: '/a.pdf', in: 'both', detail: 'from byte 3; ours 6 bytes, theirs 6' },
      { url: '/b.pdf', in: 'both', detail: 'from byte 3; ours 3 bytes, theirs 4' },
    ])
  })

  it('should fail where neither build wrote a file to compare', () => {
    expect(bytesFailed(compareBytes(files({}), files({})))).toBe(true)
  })
})

describe('bytesLines()', () => {
  it('should summarize a pass in one line under its label', () => {
    const report = compareBytes(files({ '/a.svg': 'a' }), files({ '/a.svg': 'a' }))
    expect(bytesLines('passthrough', report, SIDES)).toEqual([
      'passthrough: ok, 1 files alike byte for byte, 0 differ',
    ])
  })

  it('should list each difference under a failing summary', () => {
    const report = compareBytes(
      files({ '/a.svg': 'a', '/b.svg': 'x' }),
      files({ '/c.svg': 'c', '/b.svg': 'y' })
    )
    expect(bytesLines('passthrough', report, SIDES)).toEqual([
      'passthrough: FAIL, 0 files alike byte for byte, 3 differ',
      '  /a.svg: only in dist/lemmon',
      '  /b.svg: differs from byte 0; ours 1 bytes, theirs 1',
      '  /c.svg: only in dist/www',
    ])
  })

  it('should say what was set aside where it is named, failing where told', () => {
    const report = { identical: 2, setAside: ['/stub.js'], differences: [] }
    expect(bytesLines('scripts', report, SIDES, 'stubs set aside')).toEqual([
      'scripts: ok, 2 files alike byte for byte, 0 differ; 1 stubs set aside',
    ])
    expect(bytesLines('scripts', report, SIDES, 'stubs set aside', true)).toEqual([
      'scripts: FAIL, 2 files alike byte for byte, 0 differ; 1 stubs set aside',
    ])
  })

  it('should say so where neither build wrote a file of the kind', () => {
    expect(bytesLines('passthrough', compareBytes(files({}), files({})), SIDES)).toEqual([
      'passthrough: FAIL, neither build wrote any',
    ])
  })
})
