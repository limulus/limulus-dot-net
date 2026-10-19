import { describe, expect, it } from 'vitest'

import {
  elementsOf,
  expanded,
  isLeaf,
  keyOf,
  NS,
  parseStrict,
  pseudoAttributes,
  textOf,
  XmlError,
  type XmlElement,
} from './xml-read.ts'

const DECLARATION = '<?xml version="1.0" encoding="utf-8"?>'
const bytes = (text: string): Uint8Array => new TextEncoder().encode(text)
const read = (text: string) => parseStrict(bytes(text))

/** The reason parseStrict gives for refusing `text`. */
function refusal(text: string | Uint8Array): string {
  try {
    parseStrict(typeof text === 'string' ? bytes(text) : text)
  } catch (error) {
    expect(error).toBeInstanceOf(XmlError)
    return (error as Error).message
  }
  throw new Error('parseStrict read it')
}

describe('parseStrict()', () => {
  it('should read the prolog’s instructions and the root', () => {
    const doc = read(
      `${DECLARATION}\n<?xml-stylesheet href="/feed.xsl" type="text/xsl"?>\n<rss version="2.0"/>`
    )
    expect(doc.prolog).toEqual([
      { target: 'xml', data: 'version="1.0" encoding="utf-8"' },
      { target: 'xml-stylesheet', data: 'href="/feed.xsl" type="text/xsl"' },
    ])
    expect(doc.root).toMatchObject({ kind: 'element', ns: null, local: 'rss', name: 'rss' })
  })

  it('should read an element’s namespace and local name, and keep its name as written', () => {
    const { root } = read(
      `<feed xmlns="${NS.atom}" xmlns:v="${NS.video}"><v:title>t</v:title></feed>`
    )
    expect(root).toMatchObject({ ns: NS.atom, local: 'feed', name: 'feed' })
    expect(elementsOf(root)[0]).toMatchObject({
      ns: NS.video,
      local: 'title',
      name: 'v:title',
    })
  })

  it('should key attributes by expanded name, leaving out namespace declarations', () => {
    const { root } = read(
      `<rss xmlns:dc="http://purl.org/dc/elements/1.1/" xml:base="https://limulus.net/" ` +
        'version="2.0"/>'
    )
    expect([...root.attrs]).toEqual([
      [expanded(NS.xml, 'base'), { name: 'xml:base', value: 'https://limulus.net/' }],
      [expanded(null, 'version'), { name: 'version', value: '2.0' }],
    ])
  })

  it('should decode references, and read CDATA as the text it holds', () => {
    const { root } = read('<a>&lt;p&gt;Eric&#39;s&#x20;<![CDATA[<b>&amp;</b>]]></a>')
    expect(root.children).toEqual([{ kind: 'text', text: "<p>Eric's <b>&amp;</b>" }])
  })

  it('should leave comments out, joining the text either side of one', () => {
    const { root } = read('<!-- before --><a>one<!-- two -->three<b/><!-- four --></a>')
    expect(root.children).toEqual([
      { kind: 'text', text: 'onethree' },
      expect.objectContaining({ local: 'b' }),
    ])
  })

  it('should normalize only XML 1.0’s line ends', () => {
    expect(textOf(read('<a>x\r\ny\rz</a>').root)).toBe('x\ny\nz')
    expect(textOf(read('<a>x\u0085y\u2028z</a>').root)).toBe('x\u0085y\u2028z')
  })

  it('should refuse what xmldom refuses', () => {
    expect(refusal(`\n${DECLARATION}<a/>`)).toMatch(/xml declaration/)
    expect(refusal('<a><b></a>')).toMatch(/mismatch/)
    expect(refusal('<a><dc:creator>x</dc:creator></a>')).toMatch(/prefix/)
    expect(refusal('<a>&nbsp;</a>')).toMatch(/entity not found/)
    expect(refusal('<a/><b/>')).toMatch(/element/)
    expect(refusal('<a b="<"/>')).toMatch(/</)
    expect(refusal('<a b="1" b="2"/>')).toMatch(/redefined/)
    expect(refusal('<?xml encoding="utf-8" version="1.0"?><a/>')).toMatch(/declaration/)
    expect(refusal('')).toMatch(/root/)
  })

  it('should refuse what xmldom only warns about', () => {
    expect(refusal('<a b=c/>')).toMatch(/^warning: /)
    expect(refusal('<a b="1"c="2"/>')).toMatch(/^warning: /)
  })

  it('should refuse an & that opens no reference, which xmldom keeps', () => {
    expect(refusal('<a>x & y</a>')).toBe('an & at offset 5 opens no reference')
    expect(refusal('<a b="x & y"/>')).toMatch(/opens no reference/)
    expect(refusal('<a>&;</a>')).toMatch(/opens no reference/)
    expect(refusal('<a>&#;</a>')).toMatch(/opens no reference/)
  })

  it('should read an & where it is only a character', () => {
    const doc = read('<?pi a & b?><a><!-- x & y --><![CDATA[x & y]]>&amp;&#38;&#x26;</a>')
    expect(textOf(doc.root)).toBe('x & y&&&')
  })

  it('should refuse a character XML does not allow, raw or by reference', () => {
    expect(refusal('<a>\u0001</a>')).toBe(
      'it holds U+0001 at offset 3, which XML does not allow'
    )
    for (const raw of ['\u0000', '\u000B', '\u001F', '\uFFFE', '\uFFFF']) {
      expect(refusal(`<a>${raw}</a>`)).toMatch(/which XML does not allow/)
    }
    expect(refusal('<a>&#0;</a>')).toBe('&#0; at offset 3 names no XML character')
    for (const ref of ['&#x1;', '&#xD800;', '&#xFFFE;', '&#x110000;', '&#99999999999;']) {
      expect(refusal(`<a b="${ref}"/>`)).toMatch(/names no XML character/)
    }
  })

  it('should read every character XML allows, raw or by reference', () => {
    const text = '\t\n\r \uD7FF\uE000\uFFFC\u{10000}\u{10FFFF}'
    expect(textOf(read(`<a>${text.replace('\r', '')}</a>`).root)).toBe(
      text.replace('\r', '')
    )
    const refs = '&#x9;&#xA;&#xD;&#x20;&#xD7FF;&#xE000;&#xFFFC;&#x10000;&#x10FFFF;'
    expect(textOf(read(`<a>${refs}</a>`).root)).toBe(text)
  })

  it('should refuse bytes that are not UTF-8, a surrogate’s among them', () => {
    const within = (...inner: number[]) =>
      new Uint8Array([0x3c, 0x61, 0x3e, ...inner, 0x3c, 0x2f, 0x61, 0x3e])
    expect(refusal(within(0xff))).toBe('it is not UTF-8')
    expect(refusal(within(0xed, 0xa0, 0x80))).toBe('it is not UTF-8')
  })

  it('should refuse a raw U+FFFD, at which xmldom warns of a decoding error', () => {
    expect(refusal('<a>\uFFFD</a>')).toMatch(/^warning: Unicode replacement character/)
    expect(textOf(read('<a>&#xFFFD;</a>').root)).toBe('\uFFFD')
  })

  it('should refuse what parity does not compare', () => {
    expect(refusal('<!DOCTYPE a><a/>')).toBe(
      'the document holds a node of type 10 (a), which parity does not compare'
    )
    expect(refusal('<a/><?pi x?>')).toBe(
      'the document holds the processing instruction <?pi?>, which parity does not compare'
    )
    expect(refusal('<a><?pi x?></a>')).toBe(
      '<a> holds the processing instruction <?pi?>, which parity does not compare'
    )
  })
})

describe('pseudoAttributes()', () => {
  it('should read pairs quoted either way, in any spacing', () => {
    expect(pseudoAttributes(` href="/feed.xsl"  type = 'text/xsl' `)).toEqual(
      new Map([
        ['href', '/feed.xsl'],
        ['type', 'text/xsl'],
      ])
    )
    expect(pseudoAttributes('')).toEqual(new Map())
  })

  it('should read nothing from data not written as pairs, or naming one twice', () => {
    expect(pseudoAttributes('free text')).toBeNull()
    expect(pseudoAttributes('a="1" b')).toBeNull()
    expect(pseudoAttributes('a=1')).toBeNull()
    expect(pseudoAttributes('a="1" a="2"')).toBeNull()
  })
})

describe('the tree’s readers', () => {
  const { root } = read('<a>x<b>y<c>z</c></b> <d/></a>')
  const [b, d] = elementsOf(root)

  it('should key an element by its expanded name', () => {
    expect(keyOf(root)).toBe('{}a')
    expect(keyOf(read(`<f xmlns="${NS.atom}"/>`).root)).toBe(`{${NS.atom}}f`)
  })

  it('should read all of a node’s text, and whether an element holds only text', () => {
    expect(textOf(root)).toBe('xyz ')
    expect([root, b, d].map(isLeaf)).toEqual([false, false, true])
    expect(isLeaf(elementsOf(b)[0] as XmlElement)).toBe(true)
  })
})
