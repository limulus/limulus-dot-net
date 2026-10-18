import { parse, serialize, type DefaultTreeAdapterMap } from 'parse5'
import { describe, expect, it } from 'vitest'

import { neutralize } from './neutralizers.ts'

const page = (body: string): string =>
  `<!doctype html><html><head></head><body>${body}</body></html>`

/** What a body serializes to once parsed, untouched: the baseline of a page left alone. */
const untouched = (body: string): string => serialize(parse(page(body)))

/** The body of a served page. */
const bodyOf = (html: string): string => /<body>([\s\S]*)<\/body>/.exec(html)?.[1] ?? ''

describe('neutralize()', () => {
  describe('footnote-markup', () => {
    /** comrak's footnotes, with `refs` as each reference's text. */
    const comrak = (refs = ['1', '2'], section = 'footnotes'): string =>
      '<p>One<sup class="footnote-ref"><a href="#fn-a" id="fnref-a" data-footnote-ref>' +
      `${refs[0]}</a></sup> two<sup class="footnote-ref">` +
      `<a href="#fn-b" id="fnref-b" data-footnote-ref>${refs[1]}</a></sup></p>` +
      `<section class="${section}" data-footnotes><ol>` +
      ['a', 'b']
        .map(
          (label, n) =>
            `<li id="fn-${label}"><p>Ours on ${label} <a href="#fnref-${label}" ` +
            'class="footnote-backref" data-footnote-backref ' +
            `data-footnote-backref-idx="${n + 1}" ` +
            `aria-label="Back to reference ${n + 1}">` +
            '↩</a></p></li>'
        )
        .join('') +
      '</ol></section>'

    /** markdown-it-footnote's footnotes, numbered, for the first `count` notes. */
    const markdownIt = (count = 2): string =>
      '<p>One<sup class="footnote-ref"><a href="#fn1" id="fnref1">[1]</a></sup>' +
      (count > 1
        ? ' two<sup class="footnote-ref"><a href="#fn2" id="fnref2">[2]</a></sup>'
        : ' two') +
      '</p><section class="footnotes section-separator"><ol class="footnotes-list">' +
      ['a', 'b']
        .slice(0, count)
        .map(
          (label, n) =>
            `<li id="fn${n + 1}" class="footnote-item"><p>Theirs on ${label} ` +
            `<a href="#fnref${n + 1}" class="footnote-backref">↩︎</a></p></li>`
        )
        .join('') +
      '</ol></section>'

    it("should give ours' footnotes theirs' classes, markers and backrefs", () => {
      const result = neutralize(page(comrak()), page(markdownIt()))
      const ours = bodyOf(result.ours)
      expect(ours).toContain(
        '<section class="footnotes section-separator" data-footnotes="">'
      )
      expect(ours).toContain('<ol class="footnotes-list">')
      expect(ours.match(/<li id="fn-[ab]" class="footnote-item">/g)).toHaveLength(2)
      expect(ours).toContain('data-footnote-ref="">[1]</a>')
      expect(ours).toContain('data-footnote-ref="">[2]</a>')
      expect(ours.match(/>↩︎<\/a>/g)).toHaveLength(2)
      expect(ours).not.toMatch(/>↩<\/a>/)
      expect(ours).toContain('<p>Ours on a <a')
      expect(ours).toContain('<p>Ours on b <a')
      expect(ours).not.toContain('Theirs')
      expect(result.theirs).toBe(untouched(markdownIt()))
      expect([...result.edits]).toEqual([['footnote-markup', 8]])
    })

    it('should leave a marker that is not its number, and take the rest', () => {
      const result = neutralize(page(comrak(['1', '*'])), page(markdownIt()))
      const ours = bodyOf(result.ours)
      expect(ours).toContain('data-footnote-ref="">[1]</a>')
      expect(ours).toContain('data-footnote-ref="">*</a>')
      expect([...result.edits]).toEqual([['footnote-markup', 7]])
    })

    it('should leave a section whose classes differ otherwise', () => {
      const result = neutralize(
        page(comrak(['1', '2'], 'footnotes wide')),
        page(markdownIt())
      )
      expect(bodyOf(result.ours)).toContain('<section class="footnotes wide"')
      expect([...result.edits]).toEqual([['footnote-markup', 7]])
    })

    it("should leave a list or note whose class is not theirs' known one", () => {
      const theirs = markdownIt().replace(
        'class="footnotes-list"',
        'class="footnotes-list wide"'
      )
      const result = neutralize(
        page(comrak().replace('<li id="fn-a">', '<li id="fn-a" class="x">')),
        page(theirs)
      )
      const ours = bodyOf(result.ours)
      expect(ours).toContain('data-footnotes=""><ol><li id="fn-a" class="x">')
      expect(ours).toContain('<li id="fn-b" class="footnote-item">')
      expect([...result.edits]).toEqual([['footnote-markup', 6]])
    })

    it('should leave footnotes alone where the two sides number differently', () => {
      const result = neutralize(page(comrak()), page(markdownIt(1)))
      expect(result.ours).toBe(untouched(comrak()))
      expect(result.edits.size).toBe(0)
    })

    it('should leave footnotes alone where a reference names no note', () => {
      const stray =
        '<p><sup class="footnote-ref"><a href="#fn-c" id="fnref-c">3</a></sup></p>'
      const result = neutralize(page(comrak() + stray), page(markdownIt()))
      expect(result.ours).toBe(untouched(comrak() + stray))
      expect(result.edits.size).toBe(0)
    })
  })

  describe('reading-time', () => {
    const chip = (text: string, icon = 'scroll-solid', pad = '\n  '): string =>
      `<data-chip class="dataChip"><svg><use href="#svg-${icon}"></use></svg>` +
      `${pad}${text}\n</data-chip>`
    const spaced = (text: string): string => chip(text, 'scroll-solid', '\n\n      ')
    const header = (inner: string): string =>
      `<article-header><chip-list><ul><li>${inner}</li></ul></chip-list></article-header>`

    it("should give ours' header chip theirs' minutes, changing only the number", () => {
      const result = neutralize(
        page(header(chip('5 min read'))),
        page(header(spaced('6 min read')))
      )
      expect(bodyOf(result.ours)).toBe(header(chip('6 min read')))
      expect(result.theirs).toBe(untouched(header(spaced('6 min read'))))
      expect([...result.edits]).toEqual([['reading-time', 1]])
    })

    it('should leave a chip two minutes under, or one over', () => {
      for (const ours of ['4 min read', '7 min read']) {
        const result = neutralize(
          page(header(chip(ours))),
          page(header(chip('6 min read')))
        )
        expect(bodyOf(result.ours)).toBe(header(chip(ours)))
        expect(result.edits.size).toBe(0)
      }
    })

    it("should give each card's chip theirs' minutes, paired in page order", () => {
      const card = (text: string): string =>
        `<article-card><a>${chip(text)}</a></article-card>`
      const cards = (...texts: string[]): string => texts.map(card).join('')
      const result = neutralize(
        page(header(chip('5 min read')) + cards('3 min read', '5 min read', '9 min read')),
        page(header(chip('6 min read')) + cards('3 min read', '6 min read', '9 min read'))
      )
      expect(bodyOf(result.ours)).toBe(
        header(chip('6 min read')) + cards('3 min read', '6 min read', '9 min read')
      )
      expect([...result.edits]).toEqual([['reading-time', 2]])
    })

    it('should leave the chips where the pages have not as many', () => {
      const card = (text: string): string =>
        `<article-card><a>${chip(text)}</a></article-card>`
      const ours = card('5 min read') + card('5 min read')
      const result = neutralize(page(ours), page(card('6 min read')))
      expect(result.ours).toBe(untouched(ours))
      expect(result.edits.size).toBe(0)
    })

    it('should leave a chip outside a header or card, or with another icon', () => {
      for (const [ours, theirs] of [
        [chip('5 min read'), chip('6 min read')],
        [
          header(chip('5 min read', 'film-solid')),
          header(chip('6 min read', 'film-solid')),
        ],
      ]) {
        const result = neutralize(page(ours), page(theirs))
        expect(result.ours).toBe(untouched(ours))
        expect(result.edits.size).toBe(0)
      }
    })
  })

  describe('md-photo-wrap', () => {
    // An in-body photo as markdown-it wraps its tail: the parser leaves a `p` holding a
    // clone of the link, and an empty `p` after the caption, both in the `figure`.
    const wrapped =
      '<article-photo placement="right"><figure><a href="/photos/x/"><pho-picture>' +
      '<blur-hash><picture><img src="x.jpeg" alt=""></picture></blur-hash>' +
      '<p></pho-picture></a>\n<figcaption><span>X</span></figcaption></p></figure>' +
      '</article-photo>'

    it("should drop the husks the parser leaves in theirs' photo figure", () => {
      const result = neutralize(page(''), page(wrapped))
      expect(bodyOf(result.theirs)).toBe(
        '<article-photo placement="right"><figure><a href="/photos/x/"><pho-picture>' +
          '<blur-hash><picture><img src="x.jpeg" alt=""></picture></blur-hash>' +
          '</pho-picture></a><figcaption><span>X</span></figcaption></figure>' +
          '</article-photo>'
      )
      expect([...result.edits]).toEqual([['md-photo-wrap', 2]])
    })

    it('should keep a paragraph with content, and one in a figure with no photo', () => {
      const kept =
        '<figure><pho-picture></pho-picture><p>Caption</p>' +
        '<p><a href="/x/">x</a></p></figure>' +
        '<figure><img src="y.png" alt=""><p></p></figure>'
      const result = neutralize(page(''), page(kept))
      expect(result.theirs).toBe(untouched(kept))
      expect(result.edits.size).toBe(0)
    })

    it('should leave ours alone', () => {
      const result = neutralize(page(wrapped), page(''))
      expect(result.ours).toBe(untouched(wrapped))
      expect(result.edits.size).toBe(0)
    })
  })
})

describe('serving', () => {
  /** The text of the first `tag` in a page, as a browser parses what is served. */
  const textIn = (html: string, tag: string): string => {
    const find = (node: DefaultTreeAdapterMap['node']): string | undefined => {
      if ('tagName' in node && node.tagName === tag) {
        return node.childNodes.map((c) => ('value' in c ? c.value : '')).join('')
      }
      if (!('childNodes' in node)) return undefined
      for (const child of node.childNodes) {
        const found = find(child)
        if (found !== undefined) return found
      }
      return undefined
    }
    return find(parse(html)) ?? ''
  }

  it('should keep the newline the parser drops opening a pre, textarea or listing', () => {
    for (const tag of ['pre', 'textarea', 'listing']) {
      const result = neutralize(
        page(`<${tag}>\n\nx</${tag}>`),
        page(`<${tag}>\nx</${tag}>`)
      )
      expect(textIn(result.ours, tag)).toBe('\nx')
      expect(textIn(result.theirs, tag)).toBe('x')
    }
  })

  it('should leave a pre that opens on its text as it is', () => {
    const result = neutralize(page('<pre>x\n</pre>'), page('<pre>x\n</pre>'))
    expect(textIn(result.ours, 'pre')).toBe('x\n')
  })

  it('should report a page whose mode serving would change', () => {
    const legacy =
      '<!DOCTYPE HTML PUBLIC "-//W3C//DTD HTML 4.01 Transitional//EN">' +
      '<html><head></head><body>x</body></html>'
    const result = neutralize(legacy, page('x'))
    expect(result.problems).toEqual([
      'serving: ours would render in no-quirks mode, not quirks',
    ])
  })

  it('should find nothing to report in a page with the HTML doctype', () => {
    expect(neutralize(page('x'), page('x')).problems).toEqual([])
  })
})
