// What parity's XML leg reads an `.xml` file as, refusing what a feed reader or a crawler
// would refuse: UTF-8, parsed by xmldom with every report it makes taken as fatal, after
// the checks of well-formedness it does not make; then a tree of what the leg compares —
// the processing instructions before the root, and elements by namespace and local name,
// with their attributes and their text, references decoded.

import { DOMParser, type Element as DomElement, type Node as DomNode } from '@xmldom/xmldom'

/** The namespaces the feeds and the sitemap are written in, and XML's own. */
export const NS = {
  atom: 'http://www.w3.org/2005/Atom',
  sitemap: 'http://www.sitemaps.org/schemas/sitemap/0.9',
  video: 'http://www.google.com/schemas/sitemap-video/1.1',
  xml: 'http://www.w3.org/XML/1998/namespace',
  xmlns: 'http://www.w3.org/2000/xmlns/',
} as const

export interface XmlElement {
  kind: 'element'
  /** Its namespace, or null for none. */
  ns: string | null
  local: string
  /** Its name as written, prefix and all, for a report. */
  name: string
  /** Every attribute but a namespace declaration, by its expanded name. */
  attrs: Map<string, { name: string; value: string }>
  /** Its elements and its text, each run of text whole across comments and CDATA. */
  children: XmlNode[]
}

export interface XmlText {
  kind: 'text'
  text: string
}

export type XmlNode = XmlElement | XmlText

/** A processing instruction before the root; the XML declaration's target is `xml`. */
export interface Instruction {
  target: string
  data: string
}

export interface XmlDocument {
  prolog: Instruction[]
  root: XmlElement
}

/** Why a file is not compared: it is not well-formed, or holds what parity does not read. */
export class XmlError extends Error {}

/** A namespace and a local name as one key, in Clark's notation: `{ns}local`. */
export const expanded = (ns: string | null, local: string): string =>
  `{${ns ?? ''}}${local}`

/** An element's expanded name. */
export const keyOf = (element: XmlElement): string => expanded(element.ns, element.local)

/** An element's element children. */
export const elementsOf = (element: XmlElement): XmlElement[] =>
  element.children.filter((child) => child.kind === 'element')

/** All of a node's text, its descendants' included. */
export const textOf = (node: XmlNode): string =>
  node.kind === 'text' ? node.text : node.children.map(textOf).join('')

/** Whether an element holds text alone, or nothing. */
export const isLeaf = (element: XmlElement): boolean => elementsOf(element).length === 0

const NODE = { element: 1, text: 3, cdata: 4, instruction: 7, comment: 8 } as const

/**
 * A character XML 1.0 does not allow, raw or by reference: anything outside its `Char`
 * production, which leaves out the C0 controls but tab, newline and return, lone
 * surrogates, and U+FFFE and U+FFFF.
 */
const NOT_CHAR = /[^\t\n\r\u0020-\uD7FF\uE000-\uFFFD\u{10000}-\u{10FFFF}]/u

/**
 * What the raw text is scanned for: a CDATA section, a comment or a processing
 * instruction, inside which `&` is only a character, or an `&` and the reference it
 * opens, if it opens one.
 */
const SCAN =
  /<!\[CDATA\[[\s\S]*?\]\]>|<!--[\s\S]*?-->|<\?[\s\S]*?\?>|&(#x[0-9A-Fa-f]+;|#[0-9]+;|[A-Za-z_:][\w.:-]*;)?/g

/**
 * The checks xmldom 0.9.5 does not make, over the raw text: every `&` outside a CDATA
 * section, a comment or a processing instruction opens a reference (xmldom keeps a bare
 * one as text), and no character, raw or by numeric reference, is outside XML's `Char`
 * (xmldom keeps a control character, and decodes a reference to one).
 */
function rawChecks(text: string): void {
  const raw = NOT_CHAR.exec(text)
  if (raw !== null) {
    const code = (raw[0].codePointAt(0) as number).toString(16).toUpperCase()
    throw new XmlError(
      `it holds U+${code.padStart(4, '0')} at offset ${raw.index}, which XML does not allow`
    )
  }
  for (const match of text.matchAll(SCAN)) {
    if (!match[0].startsWith('&')) continue
    const reference = match[1]
    if (reference === undefined) {
      throw new XmlError(`an & at offset ${match.index} opens no reference`)
    }
    if (!reference.startsWith('#')) continue
    const hex = reference.startsWith('#x')
    const code = parseInt(reference.slice(hex ? 2 : 1, -1), hex ? 16 : 10)
    if (code > 0x10ffff || NOT_CHAR.test(String.fromCodePoint(code))) {
      throw new XmlError(`&${reference} at offset ${match.index} names no XML character`)
    }
  }
}

/** A node parity does not read, as a refusal names it. */
const describe = (node: DomNode): string =>
  node.nodeType === NODE.instruction
    ? `the processing instruction <?${node.nodeName}?>`
    : `a node of type ${node.nodeType} (${node.nodeName})`

/** The element `node` as parity reads it, refusing what it does not compare. */
function readElement(node: DomElement): XmlElement {
  const attrs = new Map<string, { name: string; value: string }>()
  for (const attr of Array.from(node.attributes)) {
    if (attr.namespaceURI === NS.xmlns) continue
    const key = expanded(attr.namespaceURI, attr.localName ?? attr.name)
    attrs.set(key, { name: attr.name, value: attr.value })
  }
  const children: XmlNode[] = []
  for (const child of Array.from(node.childNodes) as DomNode[]) {
    const last = children.at(-1)
    if (child.nodeType === NODE.element) {
      children.push(readElement(child as DomElement))
    } else if (child.nodeType === NODE.text || child.nodeType === NODE.cdata) {
      const text = child.nodeValue ?? ''
      if (last?.kind === 'text') last.text += text
      else children.push({ kind: 'text', text })
    } else if (child.nodeType !== NODE.comment) {
      throw new XmlError(
        `<${node.nodeName}> holds ${describe(child)}, which parity does not compare`
      )
    }
  }
  const { namespaceURI: ns, localName, nodeName: name } = node
  return { kind: 'element', ns, local: localName ?? name, name, attrs, children }
}

const UTF_8 = new TextDecoder('utf-8', { fatal: true })

/**
 * Parses a file's bytes as parity compares them: decoded as UTF-8, checked for what
 * xmldom accepts and XML does not (rawChecks), then parsed by xmldom with every report it
 * makes, a warning too, taken as fatal, and only XML 1.0's line ends normalized —
 * xmldom's default is XML 1.1's, which reads U+0085 as a newline. Then read for what
 * parity compares, which refuses a processing instruction after the root or inside it,
 * and a DOCTYPE. A raw U+FFFD, which XML allows, is refused too, since xmldom warns at it
 * as the sign of a decoding error.
 * What xmldom accepts and nothing here checks, since neither build can write it from a
 * template's text without writing it there by hand: `]]>` in text, a prefix bound to
 * `xmlns`, and two attributes with one expanded name (it keeps one).
 *
 * @throws XmlError saying what is wrong
 */
export function parseStrict(bytes: Uint8Array): XmlDocument {
  let text: string
  try {
    text = UTF_8.decode(bytes)
  } catch {
    throw new XmlError('it is not UTF-8')
  }
  rawChecks(text)
  let reported: string | undefined
  const parser = new DOMParser({
    normalizeLineEndings: (source) => source.replace(/\r\n?/g, '\n'),
    onError: (level, message) => {
      reported ??= `${level}: ${message}`
      throw new Error(reported)
    },
  })
  let doc: ReturnType<DOMParser['parseFromString']>
  try {
    doc = parser.parseFromString(text, 'text/xml')
  } catch (error) {
    throw new XmlError(reported ?? (error as Error).message)
  }
  const prolog: Instruction[] = []
  let root: XmlElement | undefined
  for (const node of Array.from(doc.childNodes) as DomNode[]) {
    if (node.nodeType === NODE.element) {
      root = readElement(node as DomElement)
    } else if (node.nodeType === NODE.instruction && root === undefined) {
      prolog.push({ target: node.nodeName, data: node.nodeValue ?? '' })
    } else if (node.nodeType !== NODE.text && node.nodeType !== NODE.comment) {
      throw new XmlError(
        `the document holds ${describe(node)}, which parity does not compare`
      )
    }
  }
  // xmldom refuses a document without a root.
  return { prolog, root: root as XmlElement }
}

/**
 * The pseudo-attributes of an instruction's data, `name="value"` pairs, or null where
 * it is not written so or names one twice.
 */
export function pseudoAttributes(data: string): Map<string, string> | null {
  const pairs = new Map<string, string>()
  const pair = /\s*([^\s=]+)\s*=\s*(?:"([^"]*)"|'([^']*)')\s*/y
  while (pair.lastIndex < data.length) {
    const m = pair.exec(data)
    if (m === null || pairs.has(m[1])) return null
    pairs.set(m[1], m[2] ?? m[3])
  }
  return pairs
}
