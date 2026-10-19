// What parity's XML leg does with a feed entry's content, the HTML a feed carries escaped.
// Eleventy's is the post's body after its transforms, with every url its HTML-base plugin
// covers made absolute against the post's url on the site's origin, and ours must be made
// the same way. So ours is first checked for a relative url left in any attribute that
// plugin covers. Then, on both sides, each url on the origin is written back as the page
// writes it — a fragment of the entry's own page as the fragment, any other as its path —
// so that the page classes, whose predicates read a page's links, see what they see on a
// page; and the two are compared as rendered pages through those classes, md-photo-wrap
// in the shape the feed gives it.

import { compareRendered, renderedPage, type Comparison } from '@limulus/lemmon-shell'
import { parse, type DefaultTreeAdapterMap } from 'parse5'

import { feedForgiveness, SITE_DISPLAY, type Bundles } from './classes.ts'

type Tree = DefaultTreeAdapterMap
type Node = Tree['node']

/**
 * The attributes Eleventy's HTML-base plugin makes absolute, by the tag that carries
 * them: `@11ty/posthtml-urls`' table (its lib/defaultOptions.js), keyed by tag name alone,
 * so an SVG `a` is in it and a custom element is not. The table's `content` of a
 * `meta[http-equiv=refresh]` is left out, as the shell's rewrite leaves it out (lemmon's
 * D46): no body holds one, and one would show as a difference, theirs absolute and ours
 * not.
 */
export const URL_ATTRIBUTES: Readonly<Record<string, readonly string[]>> = {
  a: ['href', 'ping'],
  area: ['href', 'ping'],
  audio: ['src'],
  base: ['href'],
  blockquote: ['cite'],
  button: ['formaction'],
  del: ['cite'],
  embed: ['src'],
  form: ['action'],
  iframe: ['src'],
  img: ['src', 'srcset'],
  input: ['formaction', 'src'],
  ins: ['cite'],
  link: ['href'],
  object: ['data'],
  q: ['cite'],
  script: ['src'],
  source: ['src', 'srcset'],
  track: ['src'],
  video: ['poster', 'src'],
}

/** Where a url stands in an attribute's value: its start and end. */
type Span = [number, number]

/**
 * The urls of a `srcset`, as the HTML standard reads one: each candidate's url is its
 * first run of non-space, less any commas ending it, which end the candidate; otherwise
 * its descriptors run to the next comma outside parentheses.
 */
export function srcsetUrls(value: string): Span[] {
  const spans: Span[] = []
  let at = 0
  while (at < value.length) {
    while (at < value.length && /[\s,]/.test(value[at])) at += 1
    if (at === value.length) break
    const start = at
    while (at < value.length && !/\s/.test(value[at])) at += 1
    let end = at
    while (value[end - 1] === ',') end -= 1
    spans.push([start, end])
    if (end < at) continue
    let depth = 0
    while (at < value.length && (value[at] !== ',' || depth > 0)) {
      if (value[at] === '(') depth += 1
      if (value[at] === ')') depth -= 1
      at += 1
    }
  }
  return spans
}

/** The urls of a `ping`, split on commas, as posthtml-urls splits it, and on spaces. */
export function pingUrls(value: string): Span[] {
  return [...value.matchAll(/[^\s,]+/g)].map((m): Span => [m.index, m.index + m[0].length])
}

/** Where each url stands in the value of the attribute `name`. */
function urlsOf(name: string, value: string): Span[] {
  if (name === 'srcset') return srcsetUrls(value)
  if (name === 'ping') return pingUrls(value)
  return [[0, value.length]]
}

/** An attribute the table names, where it stands in the page, and the urls in it. */
interface UrlAttribute {
  tag: string
  name: string
  value: string
  /** Where `name="value"` stands in the page's text. */
  start: number
  end: number
  urls: Span[]
}

/**
 * Every attribute the table names in `page`, once each, with where it stands: parsed with
 * scripting off, so a `noscript`'s markup is read as posthtml reads it, and through each
 * `template`'s content. An attribute with a prefix (`xlink:href`) is not the table's, nor
 * one with no place in the text — a copy the parser made of an element it reopened, whose
 * original is read where it stands; a reopened copy that keeps the original's place is
 * read once.
 */
function urlAttributes(page: string): UrlAttribute[] {
  const doc = parse(page, { scriptingEnabled: false, sourceCodeLocationInfo: true })
  const found = new Map<number, UrlAttribute>()
  const walk = (node: Node): void => {
    if ('tagName' in node) {
      const names = URL_ATTRIBUTES[node.tagName] ?? []
      for (const { name, value, prefix } of node.attrs) {
        const location = node.sourceCodeLocation?.attrs?.[name]
        if (prefix !== undefined || !names.includes(name) || location === undefined)
          continue
        const urls = urlsOf(name, value)
        const { startOffset: start, endOffset: end } = location
        found.set(start, { tag: node.tagName, name, value, start, end, urls })
      }
      if (node.tagName === 'template') walk((node as Tree['template']).content)
    }
    if ('childNodes' in node) for (const child of node.childNodes) walk(child)
  }
  walk(doc)
  return [...found.values()]
}

/**
 * Each attribute in `page` the table names that holds a url Eleventy would not keep as
 * it is — one `new URL` refuses on its own, once trimmed — as its open tag shows it.
 */
export function relativeUrls(page: string): string[] {
  return urlAttributes(page)
    .filter(({ value, urls }) =>
      urls.some(([start, end]) => !URL.canParse(value.slice(start, end).trim()))
    )
    .map(({ tag, name, value }) => `<${tag} ${name}="${value}">`)
}

/**
 * A url as the page would write it, where it is written on `origin`: the fragment alone
 * where it names a fragment of the entry's own page, at `itemPath`, and otherwise the
 * path, query and fragment. Matched as written, so a url on another origin, or spelled
 * otherwise, stays as it is.
 */
export function local(url: string, origin: string, itemPath: string | undefined): string {
  if (!url.startsWith(`${origin}/`)) return url
  const path = url.slice(origin.length)
  const hash = path.indexOf('#')
  return hash !== -1 && path.slice(0, hash) === itemPath ? path.slice(hash) : path
}

/**
 * `page` with every url the table names written as the page would write it (local), each
 * `srcset` and `ping` candidate by candidate; every other byte as it was, so nothing but
 * those values can compare otherwise for having been through here.
 */
export function neutralized(
  page: string,
  origin: string,
  itemPath: string | undefined
): string {
  let text = page
  const attributes = urlAttributes(page).sort((a, b) => b.start - a.start)
  for (const { name, value, start, end, urls } of attributes) {
    let rewritten = value
    for (const [from, to] of urls.toReversed()) {
      const url = local(value.slice(from, to), origin, itemPath)
      rewritten = rewritten.slice(0, from) + url + rewritten.slice(to)
    }
    if (rewritten === value) continue
    const escaped = rewritten.replaceAll('&', '&amp;').replaceAll('"', '&quot;')
    text = `${text.slice(0, start)}${name}="${escaped}"${text.slice(end)}`
  }
  return text
}

/** A feed entry's content, standing alone as a page's body. */
export const asPage = (content: string): string =>
  `<!doctype html><html><head></head><body>${content}</body></html>`

/** How two entries' content compares. */
export interface ContentComparison {
  comparison: Comparison
  /** Each attribute in ours holding a relative url, as its open tag shows it. */
  relative: string[]
  /** Why a class refused a difference, where it records that. */
  refusals: string[]
}

/** What comparing an entry's content needs beside the content itself. */
export interface ContentOptions {
  /** The site's origin, on which both builds write every link. */
  origin: string
  /** The path of the entry's own page, where its key names one on the origin. */
  itemPath: string | undefined
  css: Bundles
}

/**
 * Compares two feed entries' decoded content, `ours` from `lem build` and `theirs`
 * Eleventy's: ours checked for relative urls, both neutralized, then compared as
 * rendered pages through the page classes with the feed's md-photo-wrap.
 */
export function compareContent(
  ours: string,
  theirs: string,
  { origin, itemPath, css }: ContentOptions
): ContentComparison {
  const pages = { ours: asPage(ours), theirs: asPage(theirs) }
  const { classes, refusals } = feedForgiveness(css)
  const rendered = (page: string) =>
    renderedPage(neutralized(page, origin, itemPath), { display: SITE_DISPLAY })
  const comparison = compareRendered(rendered(pages.ours), rendered(pages.theirs), classes)
  return { comparison, relative: relativeUrls(pages.ours), refusals }
}
