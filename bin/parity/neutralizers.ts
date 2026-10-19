// What `npm run parity:look` serves in place of each page: both builds' pages with every
// visible difference a parity class forgives undone, so their screenshots can be held to
// exact equality. Each neutralizer is named for the class in classes.ts whose difference
// it undoes, and finds what to undo with that class's own predicates, read over a parse5
// tree; it edits the tree, which is served as parse5 prints it.

import type { RenderedElement, RenderedNode, RenderedText } from '@limulus/lemmon-shell'
import { defaultTreeAdapter, parse, serialize, type DefaultTreeAdapterMap } from 'parse5'

import {
  COMRAK_IDS,
  descendants,
  elementsIn,
  footnotesOf,
  isReadingChip,
  MARKDOWN_IT_IDS,
  minutesRead,
  minuteUnder,
  photoHusk,
  textOf,
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
}

/**
 * footnote-markup: ours' footnotes take what is visible of theirs' — the
 * `footnotes-list` and `footnote-item` classes, `[n]` for the marker `n`, and `↩︎` for
 * `↩` — where both sides' footnotes are whole and alike in number, and each part differs
 * from theirs exactly so. The section keeps its own classes: the rule theirs' draws as a
 * `section-separator`, main.css draws above any `.footnotes`, so the shot shows whether
 * ours' has it. The ids, the attributes no style reads, and the notes' prose stay each
 * side's own.
 */
function footnoteMarkup(ours: View, theirs: View): Outcome {
  const o = footnotesOf(ours.root, COMRAK_IDS)
  const t = footnotesOf(theirs.root, MARKDOWN_IT_IDS)
  if (o === null || t === null || o.notes.length !== t.notes.length) {
    return { edits: 0, problems: [] }
  }
  let edits = 0
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

/**
 * The text of each reading-time chip in an article's header or in an article's card, in
 * page order.
 */
function readingTexts(view: View): RenderedText[] {
  const texts: RenderedText[] = []
  const walk = (element: RenderedElement, inArticle: boolean): void => {
    const here =
      inArticle || element.tag === 'article-header' || element.tag === 'article-card'
    if (here && isReadingChip(element)) {
      for (const text of element.children) {
        if (text.kind === 'text' && minutesRead(text.text.trim()) !== undefined) {
          texts.push(text)
        }
      }
      return
    }
    for (const child of elementsIn(element)) walk(child, here)
  }
  walk(view.root, false)
  return texts
}

/**
 * reading-time: each reading-time chip in an article's header or card in ours reads
 * theirs' minutes where it reads one minute under them, the one direction parity accepts,
 * the chips paired in page order where both pages have as many. Only the number changes;
 * the chip's text is otherwise ours.
 */
function readingTime(ours: View, theirs: View): Outcome {
  const o = readingTexts(ours)
  const t = readingTexts(theirs)
  if (o.length !== t.length) return { edits: 0, problems: [] }
  let edits = 0
  for (const [n, mine] of o.entries()) {
    const reference = t[n].text.trim()
    if (!minuteUnder(mine.text.trim(), reference)) continue
    const node = ours.text(mine)
    node.value = node.value.replace(/\d+(?= min read)/, String(minutesRead(reference)))
    edits += 1
  }
  return { edits, problems: [] }
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

/** Both builds' pages at a url as served for the look check, and what neutralizing did. */
export interface Neutralized {
  ours: string
  theirs: string
  /** How many edits each neutralizer made, by name, where it made any. */
  edits: Map<string, number>
  /** What stops the pages from comparing as neutralized, each with what found it. */
  problems: string[]
}

/** Both builds' pages at a url with every neutralizer applied, as served. */
export function neutralize(ours: string, theirs: string): Neutralized {
  const docs = { ours: parse(ours), theirs: parse(theirs) }
  const edits = new Map<string, number>()
  const problems: string[] = []
  for (const [name, neutralizer] of Object.entries(NEUTRALIZERS)) {
    // Read afresh for each, so that none reads what another has already edited away.
    const outcome = neutralizer(new View(docs.ours), new View(docs.theirs))
    if (outcome.edits > 0) edits.set(name, outcome.edits)
    problems.push(...outcome.problems.map((problem) => `${name}: ${problem}`))
  }
  const servedOurs = served(docs.ours, 'ours')
  const servedTheirs = served(docs.theirs, 'theirs')
  problems.push(
    ...[...servedOurs.problems, ...servedTheirs.problems].map((p) => `serving: ${p}`)
  )
  return { ours: servedOurs.html, theirs: servedTheirs.html, edits, problems }
}
