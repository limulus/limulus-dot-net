// What `npm run parity:look` serves in place of each post: both pages with every visible
// difference a parity class forgives undone, so their screenshots can be held to exact
// equality. Each neutralizer is named for the class in classes.ts whose difference it
// undoes, and finds what to undo with that class's own predicates, read over a parse5
// tree; it edits the tree, which is served as parse5 prints it.

import type { RenderedElement, RenderedNode, RenderedText } from '@limulus/lemmon-shell'
import { defaultTreeAdapter, parse, serialize, type DefaultTreeAdapterMap } from 'parse5'

import {
  COMRAK_IDS,
  descendants,
  elementsIn,
  footnotesOf,
  isReadingChip,
  isRecommendedList,
  listOf,
  MARKDOWN_IT_IDS,
  minutesRead,
  minuteUnder,
  photoHusk,
  sameNames,
  textOf,
  tokens,
} from './classes.ts'

type Tree = DefaultTreeAdapterMap
type Document = Tree['document']
type Element = Tree['element']
type Node = Tree['node']
type TextNode = Tree['textNode']

const isElement = (node: Node | null | undefined): node is Element =>
  node != null && 'tagName' in node

const isText = (node: Node | undefined): node is TextNode => node?.nodeName === '#text'

// --- A parse5 tree read as the classes read a page ----------------------------------

/**
 * A parse5 document as the classes' predicates read a page — elements and text, with
 * whitespace-only text left out as it renders nothing where they look — and the way
 * back from each node read to the parse5 node to edit.
 */
class View {
  readonly root: RenderedElement
  readonly #nodes = new WeakMap<RenderedNode, Element | TextNode>()

  constructor(doc: Document) {
    const html = doc.childNodes.find(isElement)
    if (html === undefined) throw new Error('a parsed document always has its html')
    this.root = this.#read(html)
  }

  #read(element: Element): RenderedElement {
    const read: RenderedElement = {
      kind: 'element',
      tag: element.tagName,
      attrs: new Map(element.attrs.map(({ name, value }) => [name, value])),
      children: [],
    }
    for (const child of element.childNodes) {
      if (isElement(child)) {
        read.children.push(this.#read(child))
      } else if (isText(child) && child.value.trim() !== '') {
        const text: RenderedText = { kind: 'text', text: child.value }
        this.#nodes.set(text, child)
        read.children.push(text)
      }
    }
    this.#nodes.set(read, element)
    return read
  }

  /** The parse5 element `read` was read from. */
  element(read: RenderedElement): Element {
    return this.#nodes.get(read) as Element
  }

  /** The parse5 text node `read` was read from. */
  text(read: RenderedText): TextNode {
    return this.#nodes.get(read) as TextNode
  }
}

function setAttr(element: Element, name: string, value: string): void {
  const attr = element.attrs.find((a) => a.name === name)
  if (attr === undefined) element.attrs.push({ name, value })
  else attr.value = value
}

function setText(element: Element, text: string): void {
  element.childNodes = []
  defaultTreeAdapter.insertText(element, text)
}

// --- The neutralizers ---------------------------------------------------------------

/** What a neutralizer did to a pair of pages. */
interface Outcome {
  edits: number
  /** What stops the pair from comparing as the neutralizer means it to. */
  problems: string[]
  /** How many recommended cards both pages list, where both list some: recommended-set. */
  shared?: number
}

/** The cards a pair of lists share, and those each lists alone. */
export interface Alignment {
  shared: string[]
  oursOnly: string[]
  theirsOnly: string[]
  /** Why the lists, once each drops what the other lacks, would not compare. */
  problem?: string
}

/**
 * Lines up two pages' recommended cards by the url each links: what both list, and what
 * each lists alone. Dropping the cards one side lists alone leaves two lists to compare
 * only where they share a card, and both list the shared ones in one order.
 */
export function alignCards(ours: string[], theirs: string[]): Alignment {
  const shared = ours.filter((href) => theirs.includes(href))
  const theirsShared = theirs.filter((href) => ours.includes(href))
  const alignment: Alignment = {
    shared,
    oursOnly: ours.filter((href) => !theirs.includes(href)),
    theirsOnly: theirs.filter((href) => !ours.includes(href)),
  }
  if (shared.length === 0) {
    alignment.problem = 'the two lists share no card, so no card of either is compared'
  } else if (shared.join(' ') !== theirsShared.join(' ')) {
    alignment.problem =
      `the cards both pages list come in another order: ours ${shared.join(', ')}; ` +
      `theirs ${theirsShared.join(', ')}`
  }
  return alignment
}

/** A page's "You Might Enjoy…" list's cards, as recommended-set reads them. */
function recommendedOf(view: View) {
  for (const section of descendants(view.root)) {
    for (const list of elementsIn(section)) {
      if (isRecommendedList(list, section)) return listOf(list)?.cards ?? null
    }
  }
  return null
}

/**
 * recommended-set: "You Might Enjoy…" lists the newest feed posts in ours and the newest
 * articles of every kind in theirs. Each page drops the cards the other does not list,
 * which leaves the cards both list, each side's own, in the order they must share.
 */
function recommendedSet(ours: View, theirs: View): Outcome {
  const o = recommendedOf(ours)
  const t = recommendedOf(theirs)
  if (o === null || t === null) return { edits: 0, problems: [] }
  const alignment = alignCards(
    o.map(({ href }) => href),
    t.map(({ href }) => href)
  )
  const dropped = [
    ...o
      .filter(({ href }) => alignment.oursOnly.includes(href))
      .map(({ li }) => ours.element(li)),
    ...t
      .filter(({ href }) => alignment.theirsOnly.includes(href))
      .map(({ li }) => theirs.element(li)),
  ]
  for (const li of dropped) defaultTreeAdapter.detachNode(li)
  return {
    edits: dropped.length,
    problems: alignment.problem === undefined ? [] : [alignment.problem],
    shared: alignment.shared.length,
  }
}

/**
 * footnote-markup: ours' footnotes take what is visible of theirs' — the
 * `section-separator` the section adds, the `footnotes-list` and `footnote-item` classes,
 * `[n]` for the marker `n`, and `↩︎` for `↩` — where both sides' footnotes are whole and
 * alike in number, and each part differs from theirs exactly so. The ids, the attributes
 * no style reads, and the notes' prose stay each side's own.
 */
function footnoteMarkup(ours: View, theirs: View): Outcome {
  const o = footnotesOf(ours.root, COMRAK_IDS)
  const t = footnotesOf(theirs.root, MARKDOWN_IT_IDS)
  if (o === null || t === null || o.notes.length !== t.notes.length) {
    return { edits: 0, problems: [] }
  }
  let edits = 0
  const sectionClass = t.section.attrs.get('class') ?? ''
  const separated = [...tokens(o.section.attrs.get('class')), 'section-separator']
  if (sameNames(separated, tokens(sectionClass))) {
    setAttr(ours.element(o.section), 'class', sectionClass)
    edits += 1
  }
  const classes: [RenderedElement, RenderedElement, string][] = [
    [o.list, t.list, 'footnotes-list'],
    ...o.notes.map((note, n): [RenderedElement, RenderedElement, string] => [
      note.item,
      t.notes[n].item,
      'footnote-item',
    ]),
  ]
  for (const [mine, reference, name] of classes) {
    if (!mine.attrs.has('class') && reference.attrs.get('class') === name) {
      setAttr(ours.element(mine), 'class', name)
      edits += 1
    }
  }
  for (const [n, note] of o.notes.entries()) {
    const reference = t.notes[n]
    const texts: [RenderedElement, RenderedElement, string, string][] = [
      [note.ref, reference.ref, String(n + 1), `[${n + 1}]`],
      [note.backref, reference.backref, '↩', '↩︎'],
    ]
    for (const [mine, theirsOf, was, is] of texts) {
      if (textOf(mine) === was && textOf(theirsOf) === is) {
        setText(ours.element(mine), is)
        edits += 1
      }
    }
  }
  return { edits, problems: [] }
}

/** The text of a page's reading-time chip in its `article-header`. */
function readingText(view: View): RenderedText | null {
  for (const header of descendants(view.root)) {
    if (header.tag !== 'article-header') continue
    for (const chip of descendants(header)) {
      if (!isReadingChip(chip)) continue
      for (const text of chip.children) {
        if (text.kind === 'text' && minutesRead(text.text.trim()) !== undefined) return text
      }
    }
  }
  return null
}

/**
 * reading-time: the header's reading-time chip in ours reads theirs' minutes where it
 * reads one minute under them, the one direction parity accepts. Only the number
 * changes; the chip's text is otherwise ours.
 */
function readingTime(ours: View, theirs: View): Outcome {
  const o = readingText(ours)
  const t = readingText(theirs)
  if (o === null || t === null || !minuteUnder(o.text.trim(), t.text.trim())) {
    return { edits: 0, problems: [] }
  }
  const node = ours.text(o)
  const minutes = minutesRead(t.text.trim())
  node.value = node.value.replace(/\d+(?= min read)/, String(minutes))
  return { edits: 1, problems: [] }
}

/**
 * md-photo-wrap: markdown-it wraps the tail of an in-body `article-photo` in a `<p>`,
 * which the parser leaves as husks in its `figure` (photoHusk), whose margins ours does
 * not have. Theirs drops each husk among a `figure`'s children.
 */
function mdPhotoWrap(_ours: View, theirs: View): Outcome {
  const husks = [...descendants(theirs.root)].flatMap((figure) =>
    elementsIn(figure).filter((p) => photoHusk(figure, p))
  )
  for (const p of husks) defaultTreeAdapter.detachNode(theirs.element(p))
  return { edits: husks.length, problems: [] }
}

/** Each neutralizer, by the parity class whose difference it undoes, in the order run. */
const NEUTRALIZERS: Record<string, (ours: View, theirs: View) => Outcome> = {
  'recommended-set': recommendedSet,
  'footnote-markup': footnoteMarkup,
  'reading-time': readingTime,
  'md-photo-wrap': mdPhotoWrap,
}

// --- Serving --------------------------------------------------------------------------

/** The elements whose first newline the parser drops, which the serializer must keep. */
const LEADING_NEWLINE = new Set(['pre', 'textarea', 'listing'])

/**
 * `doc` as served: printed by parse5, which neither writes back the newline the parser
 * drops at the start of a `pre`, `textarea` or `listing` — so each such element whose
 * text starts with one gets it doubled first — nor keeps a legacy doctype's public and
 * system ids, which decide quirks mode; a page whose mode that changes is a problem.
 */
function served(doc: Document, side: string): { html: string; problems: string[] } {
  const walk = (node: Node): void => {
    if (!('childNodes' in node)) return
    if (isElement(node) && LEADING_NEWLINE.has(node.tagName)) {
      const [first] = node.childNodes
      if (isText(first) && first.value.startsWith('\n')) first.value = `\n${first.value}`
    }
    for (const child of node.childNodes) walk(child)
  }
  walk(doc)
  const html = serialize(doc)
  const mode = parse(html).mode
  const problems =
    mode === doc.mode ? [] : [`${side} would render in ${mode} mode, not ${doc.mode}`]
  return { html, problems }
}

/** A post's two pages as served for the look check, and what neutralizing them did. */
export interface Neutralized {
  ours: string
  theirs: string
  /** How many edits each neutralizer made, by name, where it made any. */
  edits: Map<string, number>
  /** How many recommended cards both pages list, or null where either has no list. */
  sharedCards: number | null
  /** What stops the pages from comparing as neutralized, each with what found it. */
  problems: string[]
}

/** Both pages of a post with every neutralizer applied, as served. */
export function neutralize(ours: string, theirs: string): Neutralized {
  const docs = { ours: parse(ours), theirs: parse(theirs) }
  const edits = new Map<string, number>()
  const problems: string[] = []
  let sharedCards: number | null = null
  for (const [name, neutralizer] of Object.entries(NEUTRALIZERS)) {
    // Read afresh for each, so that none reads what another has already edited away.
    const outcome = neutralizer(new View(docs.ours), new View(docs.theirs))
    if (outcome.edits > 0) edits.set(name, outcome.edits)
    if (outcome.shared !== undefined) sharedCards = outcome.shared
    problems.push(...outcome.problems.map((problem) => `${name}: ${problem}`))
  }
  const servedOurs = served(docs.ours, 'ours')
  const servedTheirs = served(docs.theirs, 'theirs')
  problems.push(
    ...[...servedOurs.problems, ...servedTheirs.problems].map((p) => `serving: ${p}`)
  )
  return { ours: servedOurs.html, theirs: servedTheirs.html, edits, sharedCards, problems }
}
