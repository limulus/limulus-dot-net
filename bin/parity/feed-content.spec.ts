import { describe, expect, it } from 'vitest'

import {
  asPage,
  compareContent,
  local,
  neutralized,
  pingUrls,
  relativeUrls,
  srcsetUrls,
  URL_ATTRIBUTES,
} from './feed-content.ts'

const ORIGIN = 'https://limulus.net'
const ITEM = '/feed/a-post/'
const NO_CSS = { ours: new Map(), theirs: new Map(), globals: '' }

/** The urls `spans` pick out of `value`. */
const picked = (value: string, spans: [number, number][]) =>
  spans.map(([start, end]) => value.slice(start, end))

/** Markup holding the table's attribute `name` on `tag`, with the value `url`. */
function carrying(tag: string, name: string, url: string): string {
  const attribute = `${name}="${url}"`
  switch (tag) {
    case 'source':
    case 'track':
      return `<video><${tag} ${attribute}></video>`
    case 'area':
    case 'base':
    case 'embed':
    case 'img':
    case 'input':
    case 'link':
      return `<${tag} ${attribute}>`
    default:
      return `<${tag} ${attribute}>x</${tag}>`
  }
}

/** Every pair the table names, as [tag, attribute]. */
const PAIRS = Object.entries(URL_ATTRIBUTES).flatMap(([tag, names]) =>
  names.map((name) => [tag, name] as const)
)

describe('srcsetUrls()', () => {
  it('should pick each candidate’s url, leaving its descriptors', () => {
    const value = 'https://pho.limulus.net/a.jpg 3000w, /b.jpg 1500w,c.jpg'
    expect(picked(value, srcsetUrls(value))).toEqual([
      'https://pho.limulus.net/a.jpg',
      '/b.jpg',
      'c.jpg',
    ])
  })

  it('should keep a comma inside a url, and drop commas that end one', () => {
    const value = ' a,b.jpg 2x ,, c.jpg,, d.jpg (x, y) 1x, e.jpg'
    expect(picked(value, srcsetUrls(value))).toEqual(['a,b.jpg', 'c.jpg', 'd.jpg', 'e.jpg'])
  })

  it('should pick nothing from a value with no candidate', () => {
    expect(srcsetUrls('')).toEqual([])
    expect(srcsetUrls(' , ')).toEqual([])
  })
})

describe('pingUrls()', () => {
  it('should pick each url split on commas or spaces', () => {
    const value = '/a, https://b.example/p  c'
    expect(picked(value, pingUrls(value))).toEqual(['/a', 'https://b.example/p', 'c'])
  })
})

describe('relativeUrls()', () => {
  it('should find a relative url in every attribute the table names', () => {
    for (const [tag, name] of PAIRS) {
      const page = asPage(carrying(tag, name, '../x/'))
      expect(relativeUrls(page), `${tag} ${name}`).toEqual([`<${tag} ${name}="../x/">`])
    }
  })

  it('should keep a url new URL takes on its own, once trimmed', () => {
    for (const url of [
      'https://limulus.net/x/',
      ' https://limulus.net/x/ ',
      'mailto:eric@limulus.net',
      'data:text/plain,x',
    ]) {
      expect(relativeUrls(asPage(`<a href="${url}">x</a>`)), url).toEqual([])
    }
  })

  it('should find a path, a fragment, a query and an empty url relative', () => {
    for (const url of ['/x/', '#fn1', '?q=1', '', 'x.pdf', '//limulus.net/x/']) {
      expect(relativeUrls(asPage(`<a href="${url}">x</a>`)), url).toHaveLength(1)
    }
  })

  it('should find one relative candidate among absolute ones', () => {
    const page = asPage('<img srcset="https://pho.limulus.net/a.jpg 2x, b.jpg 3x">')
    expect(relativeUrls(page)).toEqual([
      '<img srcset="https://pho.limulus.net/a.jpg 2x, b.jpg 3x">',
    ])
    expect(relativeUrls(asPage('<a href="/" ping="https://p.example/ /p">x</a>'))).toEqual([
      '<a href="/">',
      '<a ping="https://p.example/ /p">',
    ])
  })

  it('should leave out what the table does not name', () => {
    const page = asPage(
      '<x-card href="/x/">c</x-card><svg><use href="#svg-icon"></use>' +
        '<a xlink:href="/x/">s</a></svg><meta http-equiv="refresh" content="0; url=/x/">' +
        '<a title="/x/">t</a>'
    )
    expect(relativeUrls(page)).toEqual([])
  })

  it('should find a url in an SVG link, a noscript’s markup and a template’s content', () => {
    const page = asPage(
      '<svg><a href="/s/">s</a></svg><noscript><a href="/n/">n</a></noscript>' +
        '<template><a href="/t/">t</a></template>'
    )
    expect(relativeUrls(page)).toEqual([
      '<a href="/s/">',
      '<a href="/n/">',
      '<a href="/t/">',
    ])
  })

  it('should read an SVG link’s href beside its xlink:href', () => {
    const page = asPage(
      '<svg><a href="/s/" xlink:href="https://limulus.net/s/">s</a></svg>'
    )
    expect(relativeUrls(page)).toEqual(['<a href="/s/">'])
  })

  it('should find a url once where the parser reopens its element', () => {
    expect(relativeUrls(asPage('<p><a href="/x/">a<p>b</p>'))).toEqual(['<a href="/x/">'])
    expect(
      relativeUrls(asPage('<figure><a href="/x/"><div><p></div></a><b>c</b></p></figure>'))
    ).toEqual(['<a href="/x/">'])
  })
})

describe('local()', () => {
  it('should write a fragment of the entry’s own page as the fragment', () => {
    expect(local(`${ORIGIN}${ITEM}#fn1`, ORIGIN, ITEM)).toBe('#fn1')
  })

  it('should write any other url on the origin as its path, query and fragment', () => {
    expect(local(`${ORIGIN}/feed/other/#fn1`, ORIGIN, ITEM)).toBe('/feed/other/#fn1')
    expect(local(`${ORIGIN}${ITEM}`, ORIGIN, ITEM)).toBe(ITEM)
    expect(local(`${ORIGIN}${ITEM}?q=1#x`, ORIGIN, ITEM)).toBe(`${ITEM}?q=1#x`)
    expect(local(`${ORIGIN}/#top`, ORIGIN, undefined)).toBe('/#top')
  })

  it('should leave a url on another origin, or spelled otherwise, as it is', () => {
    for (const url of [
      'https://pho.limulus.net/a.jpg',
      'https://limulus.network/x/',
      'https://limulus.net',
      'http://limulus.net/x/',
      ' https://limulus.net/x/',
      `/feed/a-post/#fn1`,
    ]) {
      expect(local(url, ORIGIN, ITEM)).toBe(url)
    }
  })
})

describe('neutralized()', () => {
  it('should write back every attribute the table names, and nothing else', () => {
    for (const [tag, name] of PAIRS) {
      const page = asPage(carrying(tag, name, `${ORIGIN}/x/`))
      expect(neutralized(page, ORIGIN, ITEM), `${tag} ${name}`).toBe(
        asPage(carrying(tag, name, '/x/'))
      )
    }
  })

  it('should leave every other byte of the page as it was', () => {
    const body = (href: string) =>
      `<p class="a"  id=b>\n  x &amp; <a\n    title='t' href=${href} rel=me>y</a>&nbsp;z</p>`
    const page = asPage(body(`"${ORIGIN}${ITEM}#fn1"`))
    expect(neutralized(page, ORIGIN, ITEM)).toBe(asPage(body('"#fn1"')))
  })

  it('should leave what the table does not name, though it is on the origin', () => {
    const page = asPage(
      `<x-card href="${ORIGIN}/x/">c</x-card><svg><a xlink:href="${ORIGIN}/x/">s</a></svg>` +
        `<a title="${ORIGIN}/x/">t</a>`
    )
    expect(neutralized(page, ORIGIN, ITEM)).toBe(page)
  })

  it('should write back each candidate of a srcset or a ping, keeping the rest', () => {
    const page = asPage(
      `<img srcset="${ORIGIN}/a.jpg 2x, https://pho.limulus.net/b.jpg 3x">` +
        `<a href="/" ping="${ORIGIN}/p, https://p.example/">x</a>`
    )
    expect(neutralized(page, ORIGIN, ITEM)).toBe(
      asPage(
        '<img srcset="/a.jpg 2x, https://pho.limulus.net/b.jpg 3x">' +
          '<a href="/" ping="/p, https://p.example/">x</a>'
      )
    )
  })

  it('should escape what it writes back as an attribute needs', () => {
    const page = asPage(`<a href='${ORIGIN}/x/?a=1&amp;b="2"'>x</a>`)
    expect(neutralized(page, ORIGIN, ITEM)).toBe(
      asPage('<a href="/x/?a=1&amp;b=&quot;2&quot;">x</a>')
    )
  })

  it('should write back a url in a noscript’s markup and a template’s content', () => {
    const page = (url: string) =>
      asPage(
        `<noscript><a href="${url}">n</a></noscript><template><a href="${url}">t</a></template>`
      )
    expect(neutralized(page(`${ORIGIN}/x/`), ORIGIN, ITEM)).toBe(page('/x/'))
  })

  it('should write a url the parser reopens once', () => {
    const page = (url: string) => asPage(`<p><a href="${url}">a<p>b</p>`)
    expect(neutralized(page(`${ORIGIN}/x/`), ORIGIN, ITEM)).toBe(page('/x/'))
  })
})

describe('compareContent()', () => {
  const compare = (ours: string, theirs: string) =>
    compareContent(ours, theirs, { origin: ORIGIN, itemPath: ITEM, css: NO_CSS })
  const forgiven = (result: ReturnType<typeof compare>) => [...result.comparison.forgiven]

  it('should find nothing between two entries alike', () => {
    const content = `<p>A <a href="${ORIGIN}/feed/other/">link</a>.</p>`
    const result = compare(content, content)
    expect(result.comparison.differences).toEqual([])
    expect(result.relative).toEqual([])
    expect(result.comparison.matched).toBeGreaterThan(0)
  })

  it('should report a change in the content', () => {
    const result = compare('<p>A post.</p>', '<p>A pots.</p>')
    expect(result.comparison.differences).toEqual([
      expect.objectContaining({ ours: '"A post."', theirs: '"A pots."' }),
    ])
  })

  it('should list each relative url ours has left', () => {
    const result = compare(
      '<p><a href="#fn1">1</a></p>',
      `<p><a href="${ORIGIN}${ITEM}#fn1">1</a></p>`
    )
    expect(result.relative).toEqual(['<a href="#fn1">'])
  })

  it('should let a page class read links as the page writes them', () => {
    // Two notes, comrak's markup in ours and markdown-it-footnote's in theirs, each with
    // its same-page links made absolute as a feed has them.
    const absolute = (html: string) => html.replaceAll('href="#', `href="${ORIGIN}${ITEM}#`)
    const ours =
      '<p>A<sup class="footnote-ref"><a href="#fn-a" id="fnref-a" data-footnote-ref>1</a></sup></p>' +
      '<section class="footnotes" data-footnotes><ol><li id="fn-a"><p>Note. ' +
      '<a href="#fnref-a" class="footnote-backref" data-footnote-backref ' +
      'data-footnote-backref-idx="1" aria-label="Back to reference 1">↩</a></p></li></ol></section>'
    const theirs =
      '<p>A<sup class="footnote-ref"><a href="#fn1" id="fnref1">[1]</a></sup></p>' +
      '<section class="footnotes section-separator"><ol class="footnotes-list">' +
      '<li id="fn1" class="footnote-item"><p>Note. ' +
      '<a href="#fnref1" class="footnote-backref">↩︎</a></p></li></ol></section>'
    const result = compare(absolute(ours), absolute(theirs))
    expect(result.comparison.differences).toEqual([])
    expect(result.relative).toEqual([])
    // The ref and its number, the section, the list, the note, its backref and arrow.
    expect(forgiven(result)).toEqual([['footnote-markup', 7]])
  })

  it('should still report a custom element’s href made absolute', () => {
    const result = compare(
      `<x-card href="${ORIGIN}/x/">c</x-card>`,
      '<x-card href="/x/">c</x-card>'
    )
    expect(result.comparison.differences).toEqual([
      expect.objectContaining({ note: 'attributes differ: href' }),
    ])
  })

  it('should still report a fragment resolved against another page', () => {
    const result = compare(
      `<p><a href="${ORIGIN}/feed/other/#x">x</a></p>`,
      `<p><a href="${ORIGIN}${ITEM}#x">x</a></p>`
    )
    expect(result.comparison.differences).toEqual([
      expect.objectContaining({
        ours: '<a href="/feed/other/#x">',
        theirs: '<a href="#x">',
      }),
    ])
  })

  it('should still report a link made absolute on another origin', () => {
    const result = compare(
      '<p><a href="https://example.com/x/">x</a></p>',
      `<p><a href="${ORIGIN}/x/">x</a></p>`
    )
    expect(result.comparison.differences).toHaveLength(1)
  })

  it('should compare a noscript’s markup with its links written back', () => {
    const noscript = (url: string, text: string) =>
      `<noscript><p><a href="${url}">${text}</a></p></noscript>`
    expect(
      compare(noscript(`${ORIGIN}/x/`, 'n'), noscript(`${ORIGIN}/x/`, 'n')).comparison
        .differences
    ).toEqual([])
    expect(
      compare(noscript(`${ORIGIN}/x/`, 'n'), noscript(`${ORIGIN}/y/`, 'n')).comparison
        .differences
    ).toHaveLength(1)
  })

  it('should accept the husks posthtml leaves in a photo, as md-photo-wrap', () => {
    const photo = (husk: string) =>
      `<figure><a href="${ORIGIN}/photos/x/"><pho-picture><blur-hash>b</blur-hash>` +
      `${husk}</pho-picture></a><figcaption>c</figcaption>${husk}</figure>`
    const result = compare(photo(''), photo('<p></p>'))
    expect(result.comparison.differences).toEqual([])
    expect(forgiven(result)).toEqual([['md-photo-wrap', 2]])
  })
})
