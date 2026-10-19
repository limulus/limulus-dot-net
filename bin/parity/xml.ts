// Parity's XML leg: what `npm run parity` does with each `.xml` file either build writes,
// the three feeds and the sitemap. Each is read strictly (xml-read.ts) and compared as
// XML: the processing instructions before the root, the declaration among them, by
// target and pseudo-attributes; elements and attributes by namespace and local name,
// since a prefix is the writer's choice, namespace declarations and attribute order
// ignored; text decoded, whitespace-only text between elements ignored and a leaf's text
// trimmed. A feed's entries are an ordered list keyed by guid or id and the sitemap's a
// set keyed by `loc`; a date compares as its instant where both sides match its
// element's grammar (dates.ts); and an entry's content is HTML, compared as a page is
// (feed-content.ts). The classes here are counted, as a page's are, in EXPECTED under
// the file's url, beside the page classes that fire in its entries' content.

import { renderedPage, type Difference } from '@limulus/lemmon-shell'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'

import { miscounts, reportLines, type PageReport } from './check.ts'
import { descendants, type Bundles } from './classes.ts'
import { GRAMMARS, rfc3339, type Grammar } from './dates.ts'
import { compareContent } from './feed-content.ts'
import { everyFile } from './files.ts'
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
  type Instruction,
  type XmlDocument,
  type XmlElement,
  type XmlNode,
} from './xml-read.ts'

// --- What each kind of file holds ----------------------------------------------------

/** What a file is, by its root: a feed in either format, the sitemap, or other XML. */
export type Kind = 'rss' | 'atom' | 'sitemap' | 'xml'

const ROOTS: Partial<Record<string, Kind>> = {
  [expanded(null, 'rss')]: 'rss',
  [expanded(NS.atom, 'feed')]: 'atom',
  [expanded(NS.sitemap, 'urlset')]: 'sitemap',
}

export const kindOf = (root: XmlElement): Kind => ROOTS[keyOf(root)] ?? 'xml'

/** The elements holding a date in each kind of file, by expanded name. */
const DATES: Record<Kind, Partial<Record<string, Grammar>>> = {
  rss: {
    [expanded(null, 'pubDate')]: GRAMMARS.rfc822,
    [expanded(null, 'lastBuildDate')]: GRAMMARS.rfc822,
  },
  atom: {
    [expanded(NS.atom, 'updated')]: GRAMMARS.rfc3339,
    [expanded(NS.atom, 'published')]: GRAMMARS.rfc3339,
  },
  sitemap: {
    [expanded(NS.sitemap, 'lastmod')]: GRAMMARS.rfc3339,
    [expanded(NS.video, 'publication_date')]: GRAMMARS.rfc3339,
  },
  xml: {},
}

/** Where a list's entries are: the element holding them, each entry, and its key. */
interface Entries {
  container: string
  entry: string
  key: string
}

const ENTRIES: Partial<Record<Kind, Entries>> = {
  rss: {
    container: expanded(null, 'channel'),
    entry: expanded(null, 'item'),
    key: expanded(null, 'guid'),
  },
  atom: {
    container: expanded(NS.atom, 'feed'),
    entry: expanded(NS.atom, 'entry'),
    key: expanded(NS.atom, 'id'),
  },
  sitemap: {
    container: expanded(NS.sitemap, 'urlset'),
    entry: expanded(NS.sitemap, 'url'),
    key: expanded(NS.sitemap, 'loc'),
  },
}

/** Whether a pair inside an entry is that entry's HTML content, RSS's or Atom's. */
function isContent(kind: Kind, o: XmlElement, t: XmlElement): boolean {
  const html = (e: XmlElement) => e.attrs.get(expanded(null, 'type'))?.value === 'html'
  if (kind === 'rss') return keyOf(t) === expanded(null, 'description')
  return kind === 'atom' && keyOf(t) === expanded(NS.atom, 'content') && html(o) && html(t)
}

/**
 * The pages www/sitemap.njk dates by a collection's newest post rather than by a date of
 * their own: `/feed/` by the articles', `/penumbra/` and `/penumbra/journal/` by the
 * penumbra posts'.
 */
const COLLECTION_DATED = new Set(['/feed/', '/penumbra/', '/penumbra/journal/'])

// --- Showing --------------------------------------------------------------------------

const SHOW_LIMIT = 160

const truncated = (text: string): string =>
  text.length > SHOW_LIMIT ? `${text.slice(0, SHOW_LIMIT - 1)}…` : text

/** An element as a report shows it: its open tag, without namespace declarations. */
export function showXml(element: XmlElement): string {
  const attrs = [...element.attrs.values()].map(({ name, value }) => ` ${name}="${value}"`)
  return truncated(`<${element.name}${attrs.join('')}>`)
}

const showText = (text: string): string => truncated(JSON.stringify(text))

/** A node as a report shows it, or null for none. */
function show(node: XmlNode | undefined): string | null {
  if (node === undefined) return null
  return node.kind === 'text' ? showText(node.text.trim()) : showXml(node)
}

/** A child's step in a path: its name, and its place among same-named siblings, if any. */
function step(node: XmlNode, siblings: XmlNode[]): string {
  if (node.kind === 'text') return 'text'
  const same = siblings.filter((s) => s.kind === 'element' && keyOf(s) === keyOf(node))
  return same.length > 1 ? `${node.name}[${same.indexOf(node)}]` : node.name
}

/** Two instructions with one target, alike in pseudo-attributes, or else in data. */
function sameInstruction(o: Instruction, t: Instruction): boolean {
  if (o.target !== t.target) return false
  const [op, tp] = [pseudoAttributes(o.data), pseudoAttributes(t.data)]
  if (op === null || tp === null) return o.data.trim() === t.data.trim()
  return op.size === tp.size && [...tp].every(([name, value]) => op.get(name) === value)
}

// --- Comparing ------------------------------------------------------------------------

/** What comparing an XML file needs beside the file itself. */
export interface XmlContext {
  /** The site's origin, on which every link, guid and `loc` is written. */
  origin: string
  /** The CSS bundles both builds wrote, for the page classes in an entry's content. */
  css: Bundles
  /** The url of every page Eleventy wrote. */
  pages: ReadonlySet<string>
  /** The pages Eleventy wrote that carry their publication time. */
  dated: ReadonlySet<string>
  /** The url of every feed Eleventy wrote. */
  feeds: ReadonlySet<string>
}

/** Compares two files' trees, counting what each class forgives. */
class XmlComparator {
  readonly differences: Difference[] = []
  readonly forgiven = new Map<string, number>()
  readonly refusals: string[] = []
  matched = 0
  readonly #context: XmlContext
  readonly #kind: Kind

  constructor(context: XmlContext, kind: Kind) {
    this.#context = context
    this.#kind = kind
  }

  differ(path: string, ours: string | null, theirs: string | null, note?: string): void {
    this.differences.push({ path, ours, theirs, ...(note === undefined ? {} : { note }) })
  }

  /** A difference one side alone has, shown on that side. */
  oneSided(path: string, side: 'ours' | 'theirs', shown: string, note: string): void {
    if (side === 'ours') this.differ(path, shown, null, note)
    else this.differ(path, null, shown, note)
  }

  forgive(name: string, times = 1): void {
    this.forgiven.set(name, (this.forgiven.get(name) ?? 0) + times)
  }

  /** The instructions before the root, the declaration among them, in order. */
  prolog(ours: Instruction[], theirs: Instruction[]): void {
    const shown = (i: Instruction | undefined) =>
      i === undefined ? null : `<?${i.target} ${i.data}?>`
    for (let n = 0; n < Math.max(ours.length, theirs.length); n += 1) {
      const [o, t] = [ours[n], theirs[n]]
      if (o !== undefined && t !== undefined && sameInstruction(o, t)) this.matched += 1
      else this.differ(`prolog[${n}]`, shown(o), shown(t), 'the instructions differ')
    }
  }

  /** Two elements with one expanded name at `path`, inside the entry keyed `item`. */
  element(o: XmlElement, t: XmlElement, path: string, item?: string): void {
    this.matched += 1
    if (item === undefined && this.isAlternateSlash(o, t)) {
      this.forgive('feed-alternate-slash')
    } else {
      this.attributes(o, t, path)
    }
    const grammar = DATES[this.#kind][keyOf(t)]
    const entries = ENTRIES[this.#kind]
    const leaves = isLeaf(o) && isLeaf(t)
    if (grammar !== undefined && leaves) {
      this.date(o, t, path, grammar)
    } else if (item !== undefined && leaves && isContent(this.#kind, o, t)) {
      this.content(textOf(o), textOf(t), path, item)
    } else if (keyOf(t) === entries?.container && this.#kind === 'sitemap') {
      this.sitemap(o, t, path, entries)
    } else if (keyOf(t) === entries?.container) {
      this.feed(o, t, path, entries)
    } else {
      this.children(o, t, path, item)
    }
  }

  attributes(o: XmlElement, t: XmlElement, path: string): void {
    const keys = [...new Set([...t.attrs.keys(), ...o.attrs.keys()])]
    const names = keys
      .filter((key) => o.attrs.get(key)?.value !== t.attrs.get(key)?.value)
      .map((key) => (t.attrs.get(key) ?? o.attrs.get(key))?.name)
    if (names.length > 0) {
      this.differ(path, showXml(o), showXml(t), `attributes differ: ${names.join(', ')}`)
    }
  }

  /**
   * Children in order: a leaf's text trimmed; otherwise its elements paired one by one,
   * whitespace-only text between them ignored and any other text compared as it is,
   * stopping at the first pair that cannot be made, which would misalign the rest.
   */
  children(o: XmlElement, t: XmlElement, path: string, item?: string): void {
    if (isLeaf(o) && isLeaf(t)) {
      const [ot, tt] = [textOf(o).trim(), textOf(t).trim()]
      if (ot !== tt) this.differ(path, showText(ot), showText(tt), 'the text differs')
      else if (ot !== '') this.matched += 1
      return
    }
    const content = (e: XmlElement) =>
      e.children.filter((child) => child.kind === 'element' || child.text.trim() !== '')
    const [oc, tc] = [content(o), content(t)]
    for (let n = 0; n < Math.max(oc.length, tc.length); n += 1) {
      const [on, tn] = [oc[n], tc[n]]
      const here = `${path} > ${tn === undefined ? step(on, oc) : step(tn, tc)}`
      if (on?.kind === 'element' && tn?.kind === 'element' && keyOf(on) === keyOf(tn)) {
        this.element(on, tn, here, item)
      } else if (on?.kind === 'text' && tn?.kind === 'text' && on.text === tn.text) {
        this.matched += 1
      } else {
        this.differ(here, show(on), show(tn), 'the children differ from here on')
        return
      }
    }
  }

  /** A date: the same text, or both in `grammar` naming one instant (date-spelling). */
  date(o: XmlElement, t: XmlElement, path: string, grammar: Grammar): void {
    const [ot, tt] = [textOf(o).trim(), textOf(t).trim()]
    if (ot === tt) {
      this.matched += 1
      return
    }
    const [oi, ti] = [grammar.read(ot), grammar.read(tt)]
    if (oi !== undefined && oi === ti) {
      this.forgive('date-spelling')
      return
    }
    let note = 'they name different instants'
    if (ti === undefined) note = `theirs is no ${grammar.name} date`
    if (oi === undefined) note = `ours is no ${grammar.name} date`
    this.differ(path, showText(ot), showText(tt), note)
  }

  /** An entry's content, the HTML it carries, through feed-content.ts. */
  content(ours: string, theirs: string, path: string, item: string): void {
    const { origin, css } = this.#context
    const itemPath = this.pathOf(item)
    const result = compareContent(ours, theirs, { origin, itemPath, css })
    for (const tag of result.relative) {
      this.differ(path, tag, null, 'ours has a relative url left')
    }
    for (const d of result.comparison.differences) {
      this.differ(`${path} > ${d.path}`, d.ours, d.theirs, d.note)
    }
    for (const [name, times] of result.comparison.forgiven) this.forgive(name, times)
    this.matched += result.comparison.matched
    this.refusals.push(...result.refusals)
  }

  /**
   * One side's entries by key, in order. An entry without exactly one key, or with a
   * key another has, is a difference, and not compared further.
   */
  keyed(
    entries: Entries,
    container: XmlElement,
    path: string,
    side: 'ours' | 'theirs'
  ): Map<string, XmlElement> {
    const keyed = new Map<string, XmlElement>()
    const items = elementsOf(container).filter((c) => keyOf(c) === entries.entry)
    for (const [n, item] of items.entries()) {
      const keys = elementsOf(item).filter((c) => keyOf(c) === entries.key)
      const key = keys.length === 1 ? textOf(keys[0]).trim() : undefined
      if (key === undefined) {
        this.oneSided(`${path} > ${item.name}[${n}]`, side, showXml(item), 'no single key')
      } else if (keyed.has(key)) {
        this.oneSided(`${path} > ${item.name}[${key}]`, side, showXml(item), 'a key twice')
      } else {
        keyed.set(key, item)
      }
    }
    return keyed
  }

  /**
   * A feed: everything but its entries compared in order as children are, then its
   * entries as an ordered list of keys — an entry one side alone has, then the order of
   * those both have — and each pair compared field by field.
   */
  feed(o: XmlElement, t: XmlElement, path: string, entries: Entries): void {
    const head = (e: XmlElement): XmlElement => ({
      ...e,
      children: e.children.filter((c) => c.kind === 'text' || keyOf(c) !== entries.entry),
    })
    this.children(head(o), head(t), path)
    const ours = this.keyed(entries, o, path, 'ours')
    const theirs = this.keyed(entries, t, path, 'theirs')
    // An entry one side alone has is reported as that; the order is the shared entries'.
    const oKeys = [...ours.keys()].filter((key) => theirs.has(key))
    const tKeys = [...theirs.keys()].filter((key) => ours.has(key))
    const at = oKeys.findIndex((key, n) => key !== tKeys[n])
    if (at !== -1) {
      const note = 'the entries both have are in another order from here on'
      this.differ(`${path} > entries[${at}]`, oKeys[at], tKeys[at], note)
    }
    for (const [key, item] of theirs) {
      const here = `${path} > ${item.name}[${key}]`
      const mine = ours.get(key)
      if (mine === undefined) this.oneSided(here, 'theirs', showXml(item), 'theirs alone')
      else this.element(mine, item, here, key)
    }
    for (const [key, item] of ours) {
      if (theirs.has(key)) continue
      this.oneSided(`${path} > ${item.name}[${key}]`, 'ours', showXml(item), 'ours alone')
    }
  }

  /**
   * The sitemap: its `url`s a set keyed by `loc`, each pair compared by url(); a `loc`
   * one side alone lists is sitemap-feed-entries' or sitemap-unlisted-page's, or a
   * difference.
   */
  sitemap(o: XmlElement, t: XmlElement, path: string, entries: Entries): void {
    for (const [side, element] of [
      ['ours', o],
      ['theirs', t],
    ] as const) {
      for (const other of elementsOf(element).filter((c) => keyOf(c) !== entries.entry)) {
        const here = `${path} > ${other.name}`
        this.oneSided(here, side, showXml(other), 'a sitemap holds only urls')
      }
    }
    const ours = this.keyed(entries, o, path, 'ours')
    const theirs = this.keyed(entries, t, path, 'theirs')
    for (const [loc, url] of theirs) {
      const here = `${path} > ${url.name}[${loc}]`
      const mine = ours.get(loc)
      if (mine !== undefined) this.url(mine, url, here, loc)
      else if (this.isFeed(loc)) this.forgive('sitemap-feed-entries')
      else this.oneSided(here, 'theirs', showXml(url), 'theirs alone lists it')
    }
    for (const [loc, url] of ours) {
      if (theirs.has(loc)) continue
      const here = `${path} > ${url.name}[${loc}]`
      if (this.isUnlistedPage(loc)) this.forgive('sitemap-unlisted-page')
      else this.oneSided(here, 'ours', showXml(url), 'ours alone lists it')
    }
  }

  /**
   * One `url` both list: its text, then its children paired by expanded name, each
   * name's in order. A `lastmod` theirs alone has is sitemap-undated-lastmod's, or a
   * difference.
   */
  url(o: XmlElement, t: XmlElement, path: string, loc: string): void {
    this.matched += 1
    this.attributes(o, t, path)
    const loose = (e: XmlElement) =>
      e.children.filter((c) => c.kind === 'text' && c.text.trim() !== '').length
    if (loose(o) + loose(t) > 0) {
      this.differ(path, showXml(o), showXml(t), 'a url holds text beside its elements')
    }
    const named = (e: XmlElement) => {
      const groups = new Map<string, XmlElement[]>()
      for (const child of elementsOf(e)) {
        groups.set(keyOf(child), [...(groups.get(keyOf(child)) ?? []), child])
      }
      return groups
    }
    const [ours, theirs] = [named(o), named(t)]
    for (const key of new Set([...theirs.keys(), ...ours.keys()])) {
      const [os, ts] = [ours.get(key) ?? [], theirs.get(key) ?? []]
      if (os.length === 0 && ts.length === 1 && this.isUndatedLastmod(ts[0], loc)) {
        this.forgive('sitemap-undated-lastmod')
        continue
      }
      const count = Math.max(os.length, ts.length)
      for (let n = 0; n < count; n += 1) {
        const [mine, theirsOf] = [os.at(n), ts.at(n)]
        // One of the two is there, at an n under the longer list's length.
        const either = (theirsOf ?? mine) as XmlElement
        const here = `${path} > ${count > 1 ? `${either.name}[${n}]` : either.name}`
        if (mine === undefined)
          this.oneSided(here, 'theirs', showXml(either), 'theirs alone')
        else if (theirsOf === undefined)
          this.oneSided(here, 'ours', showXml(mine), 'ours alone')
        else this.element(mine, theirsOf, here)
      }
    }
  }

  /** The path of a url written on the site's origin, if it is written there. */
  pathOf(url: string): string | undefined {
    const { origin } = this.#context
    return url.startsWith(`${origin}/`) ? url.slice(origin.length) : undefined
  }

  /**
   * feed-alternate-slash: Eleventy's Atom feeds link the page they are the feed of as
   * their `metadata.base`, `https://limulus.net/tils` with no slash, which names no file
   * and is served only by the CloudFront function's dot-less rewrite; ours links the
   * page's own url, `https://limulus.net/tils/`, which the link check of lemmon's D47
   * requires, the port's fix of 2026-10-19, each feed's `<id>` kept as Eleventy writes
   * it. So: an Atom feed's own `link`, not an entry's, alternate by its `rel` or by having
   * none, every other attribute alike, theirs' `href` on the origin and ours' that and a
   * slash, naming a page Eleventy wrote. It lasts until the cutover.
   */
  isAlternateSlash(o: XmlElement, t: XmlElement): boolean {
    const href = expanded(null, 'href')
    const others = (e: XmlElement) => [...e.attrs].filter(([key]) => key !== href)
    const [os, ts] = [others(o), others(t)]
    const path = this.pathOf(t.attrs.get(href)?.value ?? '')
    return (
      this.#kind === 'atom' &&
      keyOf(t) === expanded(NS.atom, 'link') &&
      (t.attrs.get(expanded(null, 'rel'))?.value ?? 'alternate') === 'alternate' &&
      os.length === ts.length &&
      ts.every(([key, { value }]) => o.attrs.get(key)?.value === value) &&
      path !== undefined &&
      o.attrs.get(href)?.value === `${this.#context.origin}${path}/` &&
      this.#context.pages.has(`${path}/`)
    )
  }

  /**
   * sitemap-feed-entries: Eleventy's sitemap lists each feed, which eleventy-plugin-rss
   * leaves in `collections.all`, and ours lists none, as Eric decided on 2026-10-18 —
   * a `loc` only theirs lists, naming a feed Eleventy wrote. It lasts until the cutover.
   */
  isFeed(loc: string): boolean {
    const path = this.pathOf(loc)
    return path !== undefined && this.#context.feeds.has(path)
  }

  /**
   * sitemap-unlisted-page: Eleventy's sitemap lists only the first page a paginated
   * template makes, the one pagination puts in `collections.all`, so it leaves out
   * `/tils/nodejs/`, and ours lists every page, as Eric decided on 2026-10-18 — a `loc`
   * only ours lists, naming a page Eleventy wrote. It lasts until the cutover.
   */
  isUnlistedPage(loc: string): boolean {
    const path = this.pathOf(loc)
    return path !== undefined && this.#context.pages.has(path)
  }

  /**
   * sitemap-undated-lastmod: Eleventy gives a page with no date of its own the time its
   * template file was created, the checkout's, and ours gives it no `lastmod`, as Eric
   * decided on 2026-10-18 — theirs' `lastmod` is an RFC 3339 date, on a page Eleventy
   * wrote, which carries no publication time and is not one www/sitemap.njk dates by a
   * collection. It lasts until the cutover.
   */
  isUndatedLastmod(lastmod: XmlElement, loc: string): boolean {
    const path = this.pathOf(loc)
    const { pages, dated } = this.#context
    return (
      keyOf(lastmod) === expanded(NS.sitemap, 'lastmod') &&
      isLeaf(lastmod) &&
      rfc3339(textOf(lastmod).trim()) !== undefined &&
      path !== undefined &&
      pages.has(path) &&
      !dated.has(path) &&
      !COLLECTION_DATED.has(path)
    )
  }
}

/** What compareXml is given. */
export interface XmlInput {
  url: string
  /** The bytes `lem build` wrote at the url, or null. */
  ours: Uint8Array | null
  /** The bytes Eleventy wrote at the url, or null. */
  theirs: Uint8Array | null
  context: XmlContext
  /** How often each class should fire on this file. */
  expected: Record<string, number>
}

/**
 * Compares the two builds' files at one url, or reports the side that lacks it; a file
 * not read is one difference, saying why.
 */
export function compareXml({ url, ours, theirs, context, expected }: XmlInput): PageReport {
  if (ours === null) return { url, missing: 'ours', miscounts: [], refusals: [] }
  if (theirs === null) return { url, missing: 'theirs', miscounts: [], refusals: [] }
  const read = (side: string, bytes: Uint8Array): XmlDocument | Difference => {
    try {
      return parseStrict(bytes)
    } catch (error) {
      if (!(error instanceof XmlError)) throw error
      const note = `${side} is not read: ${error.message}`
      return { path: 'document', ours: null, theirs: null, note }
    }
  }
  const docs = { ours: read('ours', ours), theirs: read('theirs', theirs) }
  if (!('root' in docs.ours) || !('root' in docs.theirs)) {
    const differences = [docs.ours, docs.theirs].filter(
      (d): d is Difference => !('root' in d)
    )
    const comparison = { differences, forgiven: new Map<string, number>(), matched: 0 }
    return { url, comparison, miscounts: [], refusals: [] }
  }
  const [o, t] = [docs.ours.root, docs.theirs.root]
  const comparator = new XmlComparator(context, kindOf(t))
  comparator.prolog(docs.ours.prolog, docs.theirs.prolog)
  if (keyOf(o) === keyOf(t)) comparator.element(o, t, t.name)
  else comparator.differ(t.name, showXml(o), showXml(t), 'the roots differ')
  const { differences, forgiven, matched, refusals } = comparator
  return {
    url,
    comparison: { differences, forgiven, matched },
    miscounts: miscounts(expected, forgiven),
    refusals,
  }
}

/** The report of one XML file as printed, as a page's is. */
export function xmlReportLines(
  report: PageReport,
  sides: { ours: string; theirs: string }
): string[] {
  if (report.missing === undefined) return reportLines(report, sides)
  return [`${report.url}: FAIL, no such file in ${sides[report.missing]}`]
}

// --- Reading the dists ----------------------------------------------------------------

/** Whether the file at `url` is XML parity compares: a `.xml` file at any depth. */
export const isXml = (url: string): boolean => url.endsWith('.xml')

/** The url of every `.xml` file under `dist`, sorted: none where it wrote no directory. */
export async function xmlIn(dist: string): Promise<string[]> {
  return (await everyFile(dist)).filter(isXml)
}

/**
 * The bytes the build in `dist` wrote at `url`, or null where `files`, its xmlIn(), does
 * not hold the url exactly — the listing decides, as pageAt()'s does.
 */
export async function xmlAt(
  dist: string,
  url: string,
  files: readonly string[]
): Promise<Uint8Array | null> {
  return files.includes(url) ? readFile(join(dist, url)) : null
}

/** The url of each file whose root is a feed's, RSS or Atom; a file not read is none. */
export function feedsOf(files: Map<string, Uint8Array>): Set<string> {
  const feeds = new Set<string>()
  for (const [url, bytes] of files) {
    try {
      const kind = kindOf(parseStrict(bytes).root)
      if (kind === 'rss' || kind === 'atom') feeds.add(url)
    } catch (error) {
      if (!(error instanceof XmlError)) throw error
    }
  }
  return feeds
}

/** Whether a page carries its publication time, `meta[property=article:published_time]`. */
export const isDated = (html: string): boolean =>
  [...descendants(renderedPage(html).root)].some(
    (meta) => meta.tag === 'meta' && meta.attrs.get('property') === 'article:published_time'
  )
