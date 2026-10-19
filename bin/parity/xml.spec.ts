import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { failed, type PageReport } from './check.ts'
import { NS, parseStrict } from './xml-read.ts'
import {
  compareXml,
  feedsOf,
  isDated,
  kindOf,
  xmlAt,
  xmlIn,
  xmlReportLines,
  type XmlContext,
} from './xml.ts'

const ORIGIN = 'https://limulus.net'
const DC = 'http://purl.org/dc/elements/1.1/'
const NO_CSS = { ours: new Map(), theirs: new Map(), globals: '' }
const SIDES = { ours: 'dist/lemmon', theirs: 'dist/www' }

const CONTEXT: XmlContext = {
  origin: ORIGIN,
  css: NO_CSS,
  pages: new Set([
    '/',
    '/feed/',
    '/feed/a-post/',
    '/penumbra/',
    '/photos/x/',
    '/tils/nodejs/',
  ]),
  dated: new Set(['/feed/a-post/']),
  feeds: new Set(['/feed.xml']),
}

const bytes = (text: string): Uint8Array => new TextEncoder().encode(text)

/** Compares two files' text as parity would, at a url that does not matter here. */
const compare = (
  ours: string,
  theirs: string,
  expected: Record<string, number> = {},
  context = CONTEXT
): PageReport =>
  compareXml({ url: '/x.xml', ours: bytes(ours), theirs: bytes(theirs), context, expected })

const differences = (report: PageReport) => report.comparison?.differences ?? []
const forgiven = (report: PageReport) => [...(report.comparison?.forgiven ?? [])]
const notes = (report: PageReport) => differences(report).map((d) => d.note)

/** Whether nothing was left unexplained. */
const clean = (report: PageReport): boolean => differences(report).length === 0

// --- Fixtures shaped like the files Eleventy writes --------------------------------

const DECLARATION = '<?xml version="1.0" encoding="utf-8"?>'
const STYLESHEET = '<?xml-stylesheet href="/feed.xsl" type="text/xsl"?>'

interface ItemOptions {
  guid?: string
  title?: string
  pubDate?: string
  description?: string
}

/** An RSS item, its description already escaped as the feed carries it. */
function item({
  guid = '/feed/a-post/',
  title = 'A Post',
  pubDate = 'Sat, 04 Jul 2026 09:40:00 MST',
  description = '&lt;p&gt;A post.&lt;/p&gt;',
}: ItemOptions = {}): string {
  return (
    `\n    <item>\n      <title>${title}</title>\n      <link>${ORIGIN}${guid}</link>\n` +
    `      <description>${description}</description>\n      <pubDate>${pubDate}</pubDate>\n` +
    `      <dc:creator>Eric McCarthy</dc:creator>\n      <guid>${ORIGIN}${guid}</guid>\n    </item>`
  )
}

/** An RSS feed holding `items`, its channel's head `head` after its title. */
function rss({
  items = [item()],
  head = '<description>Every article.</description>',
  prolog = `${DECLARATION}\n${STYLESHEET}\n`,
  dc = 'dc',
} = {}): string {
  const body = items.join('').replaceAll('dc:creator', `${dc}:creator`)
  return (
    `${prolog}<rss version="2.0" xmlns:${dc}="${DC}" xml:base="${ORIGIN}/">\n  <channel>\n` +
    `    <title>limulus.net</title>\n    ${head}${body}\n  </channel>\n</rss>\n`
  )
}

/** An Atom entry; its content is HTML unless `type` says otherwise. */
function entry({
  id = '/penumbra/journal/rust/',
  updated = '2024-06-04T20:20:00Z',
  content = '&lt;p&gt;Rust.&lt;/p&gt;',
  type = 'html',
} = {}): string {
  return (
    `<entry><title>Rust</title><link href="${ORIGIN}${id}" /><updated>${updated}</updated>` +
    `<id>${ORIGIN}${id}</id><content type="${type}">${content}</content></entry>`
  )
}

/** An Atom feed holding `entries`, its head `head` after its title. */
function atom({
  entries = [entry()],
  updated = '2024-06-04T20:20:00Z',
  head = '',
} = {}): string {
  return (
    `${DECLARATION}\n<feed xmlns="${NS.atom}" xml:lang="en"><title>Penumbra</title>` +
    `${head}<updated>${updated}</updated><id>${ORIGIN}/penumbra</id>` +
    `${entries.join('')}</feed>`
  )
}

/** A sitemap `url` for the page at `path`, with a `lastmod` where one is given. */
function url(path: string, lastmod?: string, more = ''): string {
  const date = lastmod === undefined ? '' : `\n\t\t<lastmod>${lastmod}</lastmod>`
  return `\n  <url>\n    <loc>${ORIGIN}${path}</loc>${date}${more}\n  </url>`
}

/** A sitemap holding `urls`. */
function sitemap(...urls: string[]): string {
  return (
    `<?xml version="1.0" encoding="UTF-8"?>\n<urlset\n  xmlns="${NS.sitemap}"\n` +
    `  xmlns:video="${NS.video}"\n>${urls.join('')}\n</urlset>`
  )
}

const VIDEO = (date = '2024-03-23T22:15:00Z', duration = '378') =>
  `<video:video><video:title>How I Am Using GitHub Copilot</video:title>` +
  `<video:publication_date>${date}</video:publication_date>` +
  `<video:duration>${duration}</video:duration></video:video>`

// --- The specs -----------------------------------------------------------------------

describe('compareXml()', () => {
  it('should report the side that wrote no file', () => {
    const context = CONTEXT
    const expected = {}
    expect(
      compareXml({ url: '/a.xml', ours: null, theirs: bytes(rss()), context, expected })
    ).toEqual({ url: '/a.xml', missing: 'ours', miscounts: [], refusals: [] })
    expect(
      compareXml({ url: '/a.xml', ours: bytes(rss()), theirs: null, context, expected })
    ).toEqual({ url: '/a.xml', missing: 'theirs', miscounts: [], refusals: [] })
  })

  it('should find nothing between a file and itself', () => {
    for (const text of [rss(), atom(), sitemap(url('/', '2024-06-04T20:20:00Z'))]) {
      const report = compare(text, text)
      expect(clean(report)).toBe(true)
      expect(forgiven(report)).toEqual([])
      expect(report.comparison?.matched).toBeGreaterThan(5)
      expect(failed(report)).toBe(false)
    }
  })

  it('should report a file a side does not read, saying why', () => {
    const report = compare(rss().replace('A post.', 'A & post.'), rss())
    expect(differences(report)).toEqual([
      {
        path: 'document',
        ours: null,
        theirs: null,
        note: expect.stringMatching(
          /^ours is not read: an & at offset \d+ opens no reference$/
        ),
      },
    ])
    expect(failed(report)).toBe(true)
    const both = compare(` ${rss()}`, ` ${rss()}`)
    expect(notes(both)).toEqual([
      expect.stringMatching(/^ours is not read: /),
      expect.stringMatching(/^theirs is not read: /),
    ])
  })

  it('should hold each class to its expected count', () => {
    const ours = rss({ items: [item({ pubDate: 'Sat, 4 Jul 2026 09:40:00 -0700' })] })
    expect(compare(ours, rss(), { 'date-spelling': 1 }).miscounts).toEqual([])
    expect(compare(ours, rss()).miscounts).toEqual([
      { name: 'date-spelling', forgave: 1, expected: 0 },
    ])
  })

  it('should report two different roots, and compare nothing under them', () => {
    const report = compare(atom(), rss({ prolog: `${DECLARATION}\n` }))
    expect(differences(report)).toEqual([
      {
        path: 'rss',
        ours: '<feed xml:lang="en">',
        theirs: '<rss version="2.0" xml:base="https://limulus.net/">',
        note: 'the roots differ',
      },
    ])
  })
})

describe('the prolog', () => {
  it('should compare the declaration by its pseudo-attributes, exactly', () => {
    const upper = rss({ prolog: `<?xml version="1.0" encoding="UTF-8"?>\n${STYLESHEET}` })
    expect(differences(compare(upper, rss()))).toEqual([
      {
        path: 'prolog[0]',
        ours: '<?xml version="1.0" encoding="UTF-8"?>',
        theirs: '<?xml version="1.0" encoding="utf-8"?>',
        note: 'the instructions differ',
      },
    ])
    const spaced = rss({
      prolog: `<?xml version='1.0'  encoding="utf-8" ?>\n${STYLESHEET}`,
    })
    expect(clean(compare(spaced, rss()))).toBe(true)
  })

  it('should report an instruction one side lacks', () => {
    const report = compare(rss({ prolog: `${DECLARATION}\n` }), rss())
    expect(differences(report)).toEqual([
      expect.objectContaining({
        path: 'prolog[1]',
        ours: null,
        theirs: `<?xml-stylesheet href="/feed.xsl" type="text/xsl"?>`,
      }),
    ])
  })

  it('should report a pseudo-attribute one side alone has', () => {
    const standalone = `<?xml version="1.0" encoding="utf-8" standalone="yes"?>`
    const report = compare(rss({ prolog: `${standalone}\n${STYLESHEET}\n` }), rss())
    expect(differences(report)).toEqual([
      expect.objectContaining({ path: 'prolog[0]', ours: standalone }),
    ])
  })

  it('should compare pseudo-attributes in any order, and other data as written', () => {
    const reordered = `<?xml-stylesheet type="text/xsl" href="/feed.xsl"?>`
    expect(clean(compare(rss({ prolog: `${DECLARATION}${reordered}` }), rss()))).toBe(true)
    const href = `<?xml-stylesheet href="/feed2.xsl" type="text/xsl"?>`
    expect(clean(compare(rss({ prolog: `${DECLARATION}${href}` }), rss()))).toBe(false)
    const free = (data: string) => rss({ prolog: `${DECLARATION}<?note ${data}?>` })
    expect(clean(compare(free('free text '), free('free text')))).toBe(true)
    expect(clean(compare(free('free text'), free('free  text')))).toBe(false)
    const target = `<?xml-stylesheet2 href="/feed.xsl" type="text/xsl"?>`
    expect(clean(compare(rss({ prolog: `${DECLARATION}${target}` }), rss()))).toBe(false)
  })
})

describe('elements and attributes', () => {
  it('should compare elements by namespace and local name, whatever their prefix', () => {
    expect(clean(compare(rss({ dc: 'd' }), rss()))).toBe(true)
  })

  it('should report an element in another namespace', () => {
    const other = rss().replace(`xmlns:dc="${DC}"`, 'xmlns:dc="urn:other"')
    expect(differences(compare(other, rss()))).toEqual([
      expect.objectContaining({
        path: 'rss > channel > item[https://limulus.net/feed/a-post/] > dc:creator',
        note: 'the children differ from here on',
      }),
    ])
  })

  it('should ignore attribute order and namespace declarations', () => {
    const moved = rss().replace(
      `<rss version="2.0" xmlns:dc="${DC}" xml:base="${ORIGIN}/">`,
      `<rss xml:base="${ORIGIN}/" xmlns:x="urn:unused" xmlns:dc="${DC}" version="2.0">`
    )
    expect(clean(compare(moved, rss()))).toBe(true)
  })

  it('should report an attribute that differs or that one side lacks, naming it', () => {
    const base = rss().replace(`xml:base="${ORIGIN}/"`, `xml:base="${ORIGIN}"`)
    expect(notes(compare(base, rss()))).toEqual(['attributes differ: xml:base'])
    const lacking = rss().replace(' version="2.0"', '')
    expect(notes(compare(lacking, rss()))).toEqual(['attributes differ: version'])
    const extra = atom().replace('<link href', '<link rel="alternate" href')
    expect(notes(compare(extra, atom()))).toEqual(['attributes differ: rel'])
  })
})

describe('text', () => {
  it('should ignore whitespace between elements, and trim a leaf’s text', () => {
    const tight = rss()
      .replaceAll(/>\s+</g, '><')
      .replace('<title>A Post', '<title> A Post\n')
    expect(clean(compare(tight, rss()))).toBe(true)
  })

  it('should report a change inside a leaf’s text', () => {
    const report = compare(rss({ items: [item({ title: 'A  Post' })] }), rss())
    expect(differences(report)).toEqual([
      {
        path: 'rss > channel > item[https://limulus.net/feed/a-post/] > title',
        ours: '"A  Post"',
        theirs: '"A Post"',
        note: 'the text differs',
      },
    ])
  })

  it('should read references and CDATA as the text they stand for, and skip comments', () => {
    const spelled = rss({ items: [item({ title: 'Eric&#39;s <!-- x -->&#x50;ost' })] })
    const cdata = rss({ items: [item({ title: "<![CDATA[Eric's Post]]>" })] })
    const plain = rss({ items: [item({ title: "Eric's Post" })] })
    expect(clean(compare(spelled, plain))).toBe(true)
    expect(clean(compare(cdata, plain))).toBe(true)
  })

  it('should compare text beside elements as it is, and stop at a child that differs', () => {
    const mixed = (text: string) =>
      sitemap().replace(
        '\n</urlset>',
        `<x:a xmlns:x="urn:x">${text}<x:b/>tail</x:a></urlset>`
      )
    expect(differences(compare(mixed(' head '), mixed(' head ')))).toEqual([
      expect.objectContaining({ note: 'a sitemap holds only urls' }),
      expect.objectContaining({ note: 'a sitemap holds only urls' }),
    ])
    const xml = (inner: string) => `<a xmlns:x="urn:x">${inner}</a>`
    expect(clean(compare(xml(' one <b/> two '), xml(' one <b/> two ')))).toBe(true)
    expect(differences(compare(xml(' one <b/> two '), xml(' one  <b/> two ')))).toEqual([
      {
        path: 'a > text',
        ours: '"one"',
        theirs: '"one"',
        note: 'the children differ from here on',
      },
    ])
    const stops = compare(xml('<b>1</b><c>2</c><d>3</d>'), xml('<b>1</b><d>9</d><c>2</c>'))
    expect(differences(stops)).toEqual([
      {
        path: 'a > d',
        ours: '<c>',
        theirs: '<d>',
        note: 'the children differ from here on',
      },
    ])
  })

  it('should report a child one side lacks', () => {
    const report = compare(rss({ head: '' }), rss())
    expect(differences(report)).toEqual([
      {
        path: 'rss > channel > description',
        ours: null,
        theirs: '<description>',
        note: 'the children differ from here on',
      },
    ])
  })

  it('should number a child among siblings of its name', () => {
    const twice = (second: string) =>
      atom().replace(
        '<updated>',
        `<link href="${ORIGIN}/a"/><link href="${second}"/><updated>`
      )
    expect(differences(compare(twice(`${ORIGIN}/c`), twice(`${ORIGIN}/b`)))).toEqual([
      expect.objectContaining({ path: 'feed > link[1]', note: 'attributes differ: href' }),
    ])
  })
})

describe('dates', () => {
  const rssDated = (pubDate: string) => rss({ items: [item({ pubDate })] })
  const path = 'rss > channel > item[https://limulus.net/feed/a-post/] > pubDate'

  it('should forgive another spelling of one instant as date-spelling', () => {
    const report = compare(rssDated('Sat, 4 Jul 2026 09:40:00 -0700'), rss())
    expect(clean(report)).toBe(true)
    expect(forgiven(report)).toEqual([['date-spelling', 1]])
  })

  it('should report two texts that differ where neither is a date', () => {
    const report = compare(rssDated('soon'), rssDated('later'))
    expect(differences(report)).toEqual([
      { path, ours: '"soon"', theirs: '"later"', note: 'ours is no RFC 822 date' },
    ])
    expect(forgiven(report)).toEqual([])
  })

  it('should not count a date written alike', () => {
    expect(forgiven(compare(rss(), rss()))).toEqual([])
  })

  it('should report another instant', () => {
    const report = compare(rssDated('Sat, 4 Jul 2026 09:40:00 -0600'), rss())
    expect(differences(report)).toEqual([
      {
        path,
        ours: '"Sat, 4 Jul 2026 09:40:00 -0600"',
        theirs: '"Sat, 04 Jul 2026 09:40:00 MST"',
        note: 'they name different instants',
      },
    ])
  })

  it('should report a date out of its element’s grammar, though V8 would read it', () => {
    const iso = compare(rssDated('2026-07-04T16:40:00Z'), rss())
    expect(notes(iso)).toEqual(['ours is no RFC 822 date'])
    expect(forgiven(iso)).toEqual([])
    const theirs = compare(rss(), rssDated('2026-07-04T16:40:00Z'))
    expect(notes(theirs)).toEqual(['theirs is no RFC 822 date'])
  })

  it('should read Atom’s dates, the feed’s and an entry’s, as RFC 3339', () => {
    const ours = atom({
      updated: '2024-06-04T13:20:00-07:00',
      entries: [entry({ updated: '2024-06-04T13:20:00-07:00' })],
    })
    expect(forgiven(compare(ours, atom()))).toEqual([['date-spelling', 2]])
    const rfc822 = atom({ updated: 'Tue, 04 Jun 2024 20:20:00 GMT' })
    expect(notes(compare(rfc822, atom()))).toEqual(['ours is no RFC 3339 date'])
  })

  it('should read the sitemap’s lastmod and a video’s publication date as RFC 3339', () => {
    const ours = sitemap(
      url('/feed/', '2026-07-04T09:40:00-07:00', VIDEO('2024-03-23T15:15:00-07:00'))
    )
    const theirs = sitemap(url('/feed/', '2026-07-04T16:40:00Z', VIDEO()))
    expect(forgiven(compare(ours, theirs))).toEqual([['date-spelling', 2]])
  })

  it('should not read a date where its element is not one of its file’s dates', () => {
    const lastmod = (date: string) => rss({ head: `<lastmod>${date}</lastmod>` })
    const report = compare(
      lastmod('2024-06-04T13:20:00-07:00'),
      lastmod('2024-06-04T20:20:00Z')
    )
    expect(notes(report)).toEqual(['the text differs'])
  })

  it('should not read a date element that holds elements', () => {
    const wrapped = rssDated('<x:d xmlns:x="urn:x">Sat, 4 Jul 2026 09:40:00 -0700</x:d>')
    const theirs = rssDated('<x:d xmlns:x="urn:x">Sat, 04 Jul 2026 09:40:00 MST</x:d>')
    expect(notes(compare(wrapped, theirs))).toEqual(['the text differs'])
  })
})

describe('feeds', () => {
  const a = item({ guid: '/feed/a/' })
  const b = item({ guid: '/feed/b/' })
  const c = item({ guid: '/feed/c/' })

  it('should compare the channel’s head in order, as children are', () => {
    const report = compare(rss({ head: '<description>Other.</description>' }), rss())
    expect(differences(report)).toEqual([
      expect.objectContaining({
        path: 'rss > channel > description',
        note: 'the text differs',
      }),
    ])
  })

  it('should report entries out of order once, still comparing each pair', () => {
    const changed = item({ guid: '/feed/a/', title: 'Changed' })
    const report = compare(rss({ items: [b, changed, c] }), rss({ items: [a, b, c] }))
    expect(differences(report)).toEqual([
      {
        path: 'rss > channel > entries[0]',
        ours: `${ORIGIN}/feed/b/`,
        theirs: `${ORIGIN}/feed/a/`,
        note: 'the entries both have are in another order from here on',
      },
      expect.objectContaining({
        path: `rss > channel > item[${ORIGIN}/feed/a/] > title`,
        note: 'the text differs',
      }),
    ])
  })

  it('should report an entry one side alone has, and no order for it', () => {
    const fewer = compare(rss({ items: [a, c] }), rss({ items: [a, b, c] }))
    expect(differences(fewer)).toEqual([
      {
        path: `rss > channel > item[${ORIGIN}/feed/b/]`,
        ours: null,
        theirs: '<item>',
        note: 'theirs alone',
      },
    ])
    const more = compare(rss({ items: [a, b, c] }), rss({ items: [a, b] }))
    expect(differences(more)).toEqual([
      {
        path: `rss > channel > item[${ORIGIN}/feed/c/]`,
        ours: '<item>',
        theirs: null,
        note: 'ours alone',
      },
    ])
  })

  it('should report an entry without one key, or with another’s', () => {
    const keyless = a.replace(/<guid>.*<\/guid>/, '')
    expect(
      differences(compare(rss({ items: [keyless, b] }), rss({ items: [a, b] })))
    ).toEqual([
      {
        path: 'rss > channel > item[0]',
        ours: '<item>',
        theirs: null,
        note: 'no single key',
      },
      expect.objectContaining({ note: 'theirs alone' }),
    ])
    const twice = compare(rss({ items: [a, b] }), rss({ items: [a, a, b] }))
    expect(notes(twice)).toEqual(['a key twice'])
  })

  it('should compare an entry’s content as rendered HTML', () => {
    const html = (description: string) => rss({ items: [item({ description })] })
    const spaced = html('&lt;p&gt;\n  A   post.\n&lt;/p&gt;\n')
    expect(clean(compare(spaced, rss()))).toBe(true)
    const report = compare(html('&lt;p&gt;A pots.&lt;/p&gt;'), rss())
    expect(differences(report)).toEqual([
      {
        path:
          `rss > channel > item[${ORIGIN}/feed/a-post/] > description > ` +
          'html > body[0] > p[0] > child 0',
        ours: '"A pots."',
        theirs: '"A post."',
      },
    ])
  })

  it('should compare a description outside an entry as text', () => {
    const head = (text: string) => rss({ head: `<description>${text}</description>` })
    expect(
      notes(compare(head('&lt;p&gt;Every article.&lt;/p&gt;'), head('Every article.')))
    ).toEqual(['the text differs'])
  })

  it('should report a relative url left in ours’ content', () => {
    const relative = rss({
      items: [item({ description: '&lt;a href="/x/"&gt;x&lt;/a&gt;' })],
    })
    const absolute = rss({
      items: [item({ description: `&lt;a href="${ORIGIN}/x/"&gt;x&lt;/a&gt;` })],
    })
    expect(differences(compare(relative, absolute))).toEqual([
      {
        path: `rss > channel > item[${ORIGIN}/feed/a-post/] > description`,
        ours: '<a href="/x/">',
        theirs: null,
        note: 'ours has a relative url left',
      },
    ])
    expect(clean(compare(absolute, absolute))).toBe(true)
  })

  it('should count the page classes that fire in an entry’s content', () => {
    const photo = (husk: string) =>
      `&lt;figure&gt;&lt;a href="${ORIGIN}/photos/x/"&gt;&lt;pho-picture&gt;b${husk}` +
      `&lt;/pho-picture&gt;&lt;/a&gt;&lt;figcaption&gt;c&lt;/figcaption&gt;${husk}&lt;/figure&gt;`
    const report = compare(
      rss({ items: [item({ description: photo('') })] }),
      rss({ items: [item({ description: photo('&lt;p&gt;&lt;/p&gt;') })] }),
      { 'md-photo-wrap': 2 }
    )
    expect(clean(report)).toBe(true)
    expect(forgiven(report)).toEqual([['md-photo-wrap', 2]])
    expect(failed(report)).toBe(false)
  })

  it('should key Atom’s entries by id, and read only HTML content as HTML', () => {
    const report = compare(
      atom({ entries: [entry({ id: '/b/' }), entry({ id: '/a/' })] }),
      atom({ entries: [entry({ id: '/a/' }), entry({ id: '/b/' })] })
    )
    expect(notes(report)).toEqual([
      'the entries both have are in another order from here on',
    ])
    const text = (content: string) => atom({ entries: [entry({ type: 'text', content })] })
    expect(notes(compare(text('a  b'), text('a b')))).toEqual(['the text differs'])
    const html = (content: string) => atom({ entries: [entry({ content })] })
    expect(clean(compare(html('a  b'), html('a b')))).toBe(true)
    const mixed = compare(atom({ entries: [entry({ type: 'text' })] }), atom())
    expect(notes(mixed)).toEqual(['attributes differ: type'])
  })

  describe('feed-alternate-slash', () => {
    const link = (href: string, more = '') => `<link href="${ORIGIN}${href}"${more} />`
    const head = (href: string, more = '') =>
      `<link href="${ORIGIN}/penumbra/feed.xml" rel="self" />${link(href, more)}`

    it('should forgive the feed’s alternate link naming its page with a slash', () => {
      for (const rel of ['', ' rel="alternate"']) {
        const report = compare(
          atom({ head: head('/penumbra/', rel) }),
          atom({ head: head('/penumbra', rel) })
        )
        expect(clean(report), rel).toBe(true)
        expect(forgiven(report)).toEqual([['feed-alternate-slash', 1]])
      }
    })

    it('should still report its id, which keeps Eleventy’s', () => {
      const ours = atom({ head: head('/penumbra/') }).replace(
        `<id>${ORIGIN}/penumbra</id>`,
        `<id>${ORIGIN}/penumbra/</id>`
      )
      const report = compare(ours, atom({ head: head('/penumbra') }))
      expect(notes(report)).toEqual(['the text differs'])
      expect(forgiven(report)).toEqual([['feed-alternate-slash', 1]])
    })

    it('should still report any other link that differs so', () => {
      const cases = {
        self: [link('/penumbra/', ' rel="self"'), link('/penumbra', ' rel="self"')],
        another: [
          link('/penumbra/', ' rel="related"'),
          link('/penumbra', ' rel="related"'),
        ],
        'not a link': [
          `<category href="${ORIGIN}/penumbra/" />`,
          `<category href="${ORIGIN}/penumbra" />`,
        ],
        'another attribute too': [
          link('/penumbra/', ' type="text/html"'),
          link('/penumbra'),
        ],
        'another attribute differing': [
          link('/penumbra/', ' type="text/html"'),
          link('/penumbra', ' type="application/xhtml+xml"'),
        ],
        'a rel on one side': [link('/penumbra/', ' rel="alternate"'), link('/penumbra')],
        'no page there': [link('/penumbra/journal/'), link('/penumbra/journal')],
        'more than a slash': [link('/penumbra/index.html'), link('/penumbra')],
        'a slash lost': [link('/penumbra'), link('/penumbra/')],
      }
      for (const [name, [ours, theirs]] of Object.entries(cases)) {
        const report = compare(atom({ head: ours }), atom({ head: theirs }))
        expect(notes(report), name).toEqual([expect.stringMatching(/^attributes differ: /)])
        expect(forgiven(report), name).toEqual([])
      }
      const offOrigin = (href: string) => `<link href="https://example.com${href}" />`
      const elsewhere = compare(
        atom({ head: offOrigin('/penumbra/') }),
        atom({ head: offOrigin('/penumbra') })
      )
      expect(notes(elsewhere)).toEqual(['attributes differ: href'])
    })

    it('should still report an entry’s link, or an RSS feed’s, gaining a slash', () => {
      const inEntry = (href: string) =>
        atom({ entries: [entry().replace(/<link href="[^"]*" \/>/, link(href))] })
      expect(notes(compare(inEntry('/penumbra/'), inEntry('/penumbra')))).toEqual([
        'attributes differ: href',
      ])
      const atomLink = (href: string) =>
        `<atom:link xmlns:atom="${NS.atom}" href="${ORIGIN}${href}" />`
      const report = compare(
        rss({ head: atomLink('/feed/') }),
        rss({ head: atomLink('/feed') })
      )
      expect(notes(report)).toEqual(['attributes differ: href'])
      expect(forgiven(report)).toEqual([])
    })
  })
})

describe('the sitemap', () => {
  const date = '2026-10-16T02:26:38Z'

  it('should compare its urls as a set, and each url’s children by name', () => {
    const ours = sitemap(url('/feed/a-post/', date), url('/')).replace(
      `<loc>${ORIGIN}/</loc>`,
      `<lastmod>${date}</lastmod><loc>${ORIGIN}/</loc>`
    )
    expect(clean(compare(ours, sitemap(url('/', date), url('/feed/a-post/', date))))).toBe(
      true
    )
  })

  it('should compare a url’s video, field by field', () => {
    const report = compare(
      sitemap(url('/feed/a-post/', date, VIDEO(undefined, '379'))),
      sitemap(url('/feed/a-post/', date, VIDEO()))
    )
    expect(differences(report)).toEqual([
      expect.objectContaining({
        path: `urlset > url[${ORIGIN}/feed/a-post/] > video:video > video:duration`,
        note: 'the text differs',
      }),
    ])
  })

  it('should report a child of a url one side alone has, or has more of', () => {
    const extra = compare(
      sitemap(url('/feed/a-post/', date, '<changefreq>daily</changefreq>')),
      sitemap(url('/feed/a-post/', date))
    )
    expect(differences(extra)).toEqual([
      {
        path: `urlset > url[${ORIGIN}/feed/a-post/] > changefreq`,
        ours: '<changefreq>',
        theirs: null,
        note: 'ours alone',
      },
    ])
    const twice = compare(
      sitemap(url('/feed/a-post/', date)),
      sitemap(url('/feed/a-post/', date, `<lastmod>${date}</lastmod>`))
    )
    expect(differences(twice)).toEqual([
      expect.objectContaining({
        path: `urlset > url[${ORIGIN}/feed/a-post/] > lastmod[1]`,
        note: 'theirs alone',
      }),
    ])
  })

  it('should report a url without one loc, or with another’s', () => {
    const keyless = sitemap(url('/eric/')).replace(/<loc>.*<\/loc>/, '')
    expect(notes(compare(sitemap(url('/eric/')), keyless))).toEqual([
      'no single key',
      'ours alone lists it',
    ])
    expect(notes(compare(sitemap(url('/'), url('/')), sitemap(url('/'))))).toEqual([
      'a key twice',
    ])
  })

  it('should report anything but a url in it, and text beside a url’s elements', () => {
    const stray = sitemap(url('/')).replace('\n</urlset>', '<sitemap/></urlset>')
    expect(differences(compare(stray, sitemap(url('/'))))).toEqual([
      {
        path: 'urlset > sitemap',
        ours: '<sitemap>',
        theirs: null,
        note: 'a sitemap holds only urls',
      },
    ])
    const loose = sitemap(url('/')).replace('</loc>', '</loc>loose')
    expect(notes(compare(loose, sitemap(url('/'))))).toEqual([
      'a url holds text beside its elements',
    ])
  })

  describe('sitemap-feed-entries', () => {
    it('should forgive a feed only theirs lists', () => {
      const report = compare(sitemap(url('/')), sitemap(url('/'), url('/feed.xml', date)))
      expect(clean(report)).toBe(true)
      expect(forgiven(report)).toEqual([['sitemap-feed-entries', 1]])
    })

    it('should still report any other url only theirs lists', () => {
      for (const path of ['/other.xml', '/feed/', '/feed.xml/']) {
        const report = compare(sitemap(url('/')), sitemap(url('/'), url(path, date)))
        expect(notes(report), path).toEqual(['theirs alone lists it'])
      }
      const offOrigin = sitemap(url('/')).replace(
        '\n</urlset>',
        '<url><loc>https://example.com/feed.xml</loc></url></urlset>'
      )
      expect(notes(compare(sitemap(url('/')), offOrigin))).toEqual([
        'theirs alone lists it',
      ])
    })

    it('should still report a feed only ours lists', () => {
      const report = compare(sitemap(url('/'), url('/feed.xml')), sitemap(url('/')))
      expect(notes(report)).toEqual(['ours alone lists it'])
    })
  })

  describe('sitemap-unlisted-page', () => {
    it('should forgive a page Eleventy wrote that only ours lists', () => {
      const report = compare(sitemap(url('/'), url('/tils/nodejs/')), sitemap(url('/')))
      expect(clean(report)).toBe(true)
      expect(forgiven(report)).toEqual([['sitemap-unlisted-page', 1]])
    })

    it('should still report a url only ours lists that is no page Eleventy wrote', () => {
      for (const path of ['/tils/nowhere/', '/tils/nodejs', '/feed.xml']) {
        const report = compare(sitemap(url('/'), url(path)), sitemap(url('/')))
        expect(notes(report), path).toEqual(['ours alone lists it'])
      }
      const offOrigin = sitemap(url('/')).replace(
        '\n</urlset>',
        '<url><loc>https://example.com/tils/nodejs/</loc></url></urlset>'
      )
      expect(notes(compare(offOrigin, sitemap(url('/'))))).toEqual(['ours alone lists it'])
    })
  })

  describe('sitemap-undated-lastmod', () => {
    it('should forgive the lastmod theirs gives an undated page Eleventy wrote', () => {
      for (const path of ['/', '/photos/x/', '/tils/nodejs/']) {
        const report = compare(sitemap(url(path)), sitemap(url(path, date)))
        expect(clean(report), path).toBe(true)
        expect(forgiven(report)).toEqual([['sitemap-undated-lastmod', 1]])
      }
    })

    it('should still report a lastmod ours leaves off a dated page', () => {
      const report = compare(
        sitemap(url('/feed/a-post/')),
        sitemap(url('/feed/a-post/', date))
      )
      expect(differences(report)).toEqual([
        {
          path: `urlset > url[${ORIGIN}/feed/a-post/] > lastmod`,
          ours: null,
          theirs: '<lastmod>',
          note: 'theirs alone',
        },
      ])
    })

    it('should still report one off a page the sitemap dates by a collection', () => {
      const report = compare(sitemap(url('/feed/')), sitemap(url('/feed/', date)))
      expect(notes(report)).toEqual(['theirs alone'])
    })

    it('should still report one off a url that is no page Eleventy wrote', () => {
      const report = compare(sitemap(url('/eric/')), sitemap(url('/eric/', date)))
      expect(notes(report)).toEqual(['theirs alone'])
    })

    it('should still report one where theirs is no RFC 3339 date, or not alone', () => {
      const malformed = compare(sitemap(url('/')), sitemap(url('/', '2026-10-16 02:26:38')))
      expect(notes(malformed)).toEqual(['theirs alone'])
      const wrapped = compare(
        sitemap(url('/')),
        sitemap(url('/', `<x:d xmlns:x="urn:x">${date}</x:d>`))
      )
      expect(notes(wrapped)).toEqual(['theirs alone'])
      const two = compare(
        sitemap(url('/')),
        sitemap(url('/', date, `<lastmod>${date}</lastmod>`))
      )
      expect(notes(two)).toEqual(['theirs alone', 'theirs alone'])
    })

    it('should still report a lastmod only ours has', () => {
      const report = compare(sitemap(url('/', date)), sitemap(url('/')))
      expect(notes(report)).toEqual(['ours alone'])
    })

    it('should not take another element theirs alone has for a lastmod', () => {
      const report = compare(
        sitemap(url('/')),
        sitemap(url('/', undefined, `<changefreq>${date}</changefreq>`))
      )
      expect(notes(report)).toEqual(['theirs alone'])
    })
  })
})

describe('xmlReportLines()', () => {
  it('should say which side wrote no such file', () => {
    expect(
      xmlReportLines(
        { url: '/feed.xml', missing: 'ours', miscounts: [], refusals: [] },
        SIDES
      )
    ).toEqual(['/feed.xml: FAIL, no such file in dist/lemmon'])
    expect(
      xmlReportLines(
        { url: '/feed.xml', missing: 'theirs', miscounts: [], refusals: [] },
        SIDES
      )
    ).toEqual(['/feed.xml: FAIL, no such file in dist/www'])
  })

  it('should report a file both wrote as a page is reported', () => {
    const report = compare(
      rss({ items: [item({ pubDate: 'Sat, 4 Jul 2026 09:40:00 -0700' })] }),
      rss(),
      {
        'date-spelling': 1,
      }
    )
    const lines = xmlReportLines({ ...report, url: '/feed.xml' }, SIDES)
    expect(lines[0]).toMatch(/^\/feed\.xml: ok, \d+ matched, 0 unexplained$/)
    expect(lines.slice(1)).toEqual(['  forgiven: date-spelling 1'])
  })
})

describe('reading the dists', () => {
  let dist: string

  beforeEach(async () => {
    dist = await mkdtemp(join(tmpdir(), 'parity-xml-'))
  })

  afterEach(async () => {
    await rm(dist, { recursive: true, force: true })
  })

  const write = async (path: string, text: string) => {
    await mkdir(join(dist, path, '..'), { recursive: true })
    await writeFile(join(dist, path), text)
  }

  it('should list the url of every .xml file at any depth, sorted', async () => {
    await write('sitemap.xml', 'x')
    await write('tils/feed.xml', 'x')
    await write('feed.xml', 'x')
    await write('feed.xsl', 'x')
    await write('xsd/tcx/v1.xsd', 'x')
    await write('feed/index.html', 'x')
    expect(await xmlIn(dist)).toEqual(['/feed.xml', '/sitemap.xml', '/tils/feed.xml'])
    expect(await xmlIn(join(dist, 'nowhere'))).toEqual([])
  })

  it('should read the bytes a build wrote at a url, or none', async () => {
    await write('tils/feed.xml', 'feed')
    expect(
      new TextDecoder().decode((await xmlAt(dist, '/tils/feed.xml')) ?? undefined)
    ).toBe('feed')
    expect(await xmlAt(dist, '/nowhere.xml')).toBeNull()
  })

  it('should pass on an error reading the dist other than its absence', async () => {
    await write('feed.xml/x', 'x')
    await expect(xmlAt(dist, '/feed.xml')).rejects.toThrow()
    await write('file', 'x')
    await expect(xmlIn(join(dist, 'file'))).rejects.toThrow()
  })
})

describe('feedsOf()', () => {
  it('should name each file whose root is an RSS or Atom feed', () => {
    const files = new Map([
      ['/feed.xml', bytes(rss())],
      ['/penumbra/feed.xml', bytes(atom())],
      ['/sitemap.xml', bytes(sitemap(url('/')))],
      ['/broken.xml', bytes('<rss>')],
      ['/other.xml', bytes('<feed/>')],
    ])
    expect(feedsOf(files)).toEqual(new Set(['/feed.xml', '/penumbra/feed.xml']))
  })
})

describe('kindOf()', () => {
  it('should tell a file’s kind by its root’s expanded name', () => {
    const kind = (text: string) => kindOf(parseStrict(bytes(text)).root)
    expect(kind(rss())).toBe('rss')
    expect(kind(atom())).toBe('atom')
    expect(kind(sitemap())).toBe('sitemap')
    expect(kind('<feed/>')).toBe('xml')
    expect(kind(`<rss xmlns="${NS.atom}"/>`)).toBe('xml')
  })
})

describe('isDated()', () => {
  it('should tell a page that carries its publication time', () => {
    const page = (head: string) =>
      `<!doctype html><html><head>${head}</head><body></body></html>`
    expect(isDated(page('<meta property="article:published_time" content="x">'))).toBe(true)
    expect(isDated(page('<meta property="article:modified_time" content="x">'))).toBe(false)
    expect(isDated(page('<meta name="article:published_time" content="x">'))).toBe(false)
    expect(isDated(page(''))).toBe(false)
  })
})
