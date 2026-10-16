// The forgiveness classes `npm run parity` accepts between a feed post `lem build` writes
// and the one Eleventy writes. Each states one difference as narrowly as it can be told
// apart from a regression beside it: a class that forgives more than it claims hides real
// differences (the lemmon repo's ∆xWs retrospective), so every predicate checks what the
// difference must be, not only where it may be. Each names the lemmon backlog item or
// decision that retires it; one that names none is a difference in Eleventy's own output
// and lasts until the cutover.

import type {
  Display,
  Forgiveness,
  MatchedPair,
  RenderedElement,
  RenderedNode,
  RenderedPage,
  Scope,
} from '@limulus/lemmon-shell'

/** A card in an `article-list`: its `li`, the `article-card`, and the url it links to. */
export interface Card {
  li: RenderedElement
  card: RenderedElement
  href: string
}

/** A feed post's card on Eleventy's feed index, which lists every article. */
export interface ReferenceCard extends Card {
  /** The instant its `time[datetime]` names. */
  published: number
}

/** The post a comparison is of, for the classes that judge it against the site. */
export interface Post {
  /** Its url, `/feed/<slug>/`. */
  url: string
  /** The card of every feed post, from Eleventy's feed index. */
  feed: ReferenceCard[]
}

/**
 * The custom elements whose whitespace the site's CSS decides, each checked against its
 * `.webc` source: `article-header.webc` makes `article-photo` a block, and
 * `data-chip.webc` makes its host a flex container. Declaring one the CSS does not back
 * would hide a real space.
 */
export const SITE_DISPLAY: Record<string, Display> = {
  'article-photo': 'block',
  'data-chip': 'flex',
}

// --- Reading the trees ------------------------------------------------------------

const tokens = (value: string | undefined): string[] =>
  (value ?? '').split(/\s+/).filter(Boolean)

const isElement = (node: RenderedNode | undefined, tag?: string): node is RenderedElement =>
  node?.kind === 'element' && (tag === undefined || node.tag === tag)

const hasClass = (element: RenderedElement, name: string): boolean =>
  tokens(element.attrs.get('class')).includes(name)

function* descendants(element: RenderedElement): Generator<RenderedElement> {
  for (const child of element.children) {
    if (isElement(child)) {
      yield child
      yield* descendants(child)
    }
  }
}

const textOf = (node: RenderedNode): string =>
  node.kind === 'text' ? node.text : node.children.map(textOf).join('')

/** The element children of `element`. */
const elementsIn = (element: RenderedElement): RenderedElement[] =>
  element.children.filter((child) => isElement(child))

/** The pair enclosing the one `at` is about. */
const parentOf = (at: Scope): MatchedPair | undefined => at.ancestors.at(-1)

/** Each side's root element. */
const rootsOf = (at: Scope): MatchedPair => at.ancestors[0] ?? at

/** Two lists of class names holding the same names, in any order. */
const sameNames = (a: string[], b: string[]): boolean =>
  a.length === b.length && [...a].sort().join(' ') === [...b].sort().join(' ')

// --- ∆D3R: component CSS ----------------------------------------------------------

/**
 * Each component or layout whose WebC `<style webc:scoped>` adds a class: the tag of
 * the element that hosts it, the hash WebC adds, and the D20 function-name class the
 * port's `.lem` function writes in its place.
 */
const SCOPED = [
  { host: 'header', named: 'ldnHeader', hash: 'w5jpt_6fe' },
  { host: 'pill-button', named: 'pillButton', hash: 'wb7dbjyrb' },
  { host: 'article', named: 'article', hash: 'wo-ywfb1w' },
  { host: 'article', named: 'video', hash: 'w3qf9ro4j' },
  { host: 'article-header', named: 'articleHeader', hash: 'w4k-xl22k' },
  { host: 'article-photo', named: 'articlePhoto', hash: 'wdam8yees' },
  { host: 'chip-list', named: 'chipList', hash: 'wu_v_wm2n' },
  { host: 'data-chip', named: 'dataChip', hash: 'wvormuvo0' },
  { host: 'revision-history', named: 'revisionHistory', hash: 'wf0vdtkv2' },
  { host: 'article-list', named: 'articleList', hash: 'wi9jish7p' },
  { host: 'article-card', named: 'articleCard', hash: 'wjjnq-bzf' },
  { host: 'article-vod', named: 'articleVod', hash: 'wyaf15udt' },
]

/**
 * A `class` differs only by scoped-style classes: on a component's host element ours
 * has its function name where theirs has its hash, and inside a host theirs has the
 * hash where ours has nothing; every other class name agrees. A function name on any
 * other element, or a hash outside its component's host, is not this class.
 */
const scopedClass: Forgiveness = {
  name: 'scoped-class',
  attr: (name, ours, theirs, at) => {
    if (name !== 'class') return false
    const o = tokens(ours)
    const t = tokens(theirs)
    const named = SCOPED.filter((s) => o.includes(s.named))
    const hashed = SCOPED.filter((s) => t.includes(s.hash))
    if (hashed.length === 0) return false
    const onHost = (s: (typeof SCOPED)[number], pair: MatchedPair): boolean =>
      pair.ours.tag === s.host &&
      pair.theirs.tag === s.host &&
      hasClass(pair.ours, s.named) &&
      hasClass(pair.theirs, s.hash)
    const placed =
      named.every((s) => onHost(s, at)) &&
      hashed.every((s) => onHost(s, at) || at.ancestors.some((pair) => onHost(s, pair)))
    return (
      placed &&
      sameNames(
        o.filter((c) => !named.some((s) => s.named === c)),
        t.filter((c) => !hashed.some((s) => s.hash === c))
      )
    )
  },
}

const INTERIM_CSS = [
  '/_includes/css/normalize.css',
  '/_includes/css/main.css',
  '/_includes/css/hljs-github.css',
]

const isStylesheet = (element: RenderedElement): boolean =>
  element.tag === 'link' && element.attrs.get('rel') === 'stylesheet'

/**
 * Where theirs links Eleventy's CSS bundle, ours links the three stylesheets
 * `_includes/css/` passes through: the first in the bundle's place, the other two
 * after it in order, all in `head`.
 */
const interimCss: Forgiveness = {
  name: 'interim-css',
  attr: (name, ours, theirs, at) =>
    name === 'href' &&
    isStylesheet(at.ours) &&
    parentOf(at)?.ours.tag === 'head' &&
    ours === INTERIM_CSS[0] &&
    /^\/assets\/immutable\/11ty\/bundle\/[\w-]+\.css$/.test(theirs ?? ''),
  oursOnly: (ours, at) => {
    if (at.ours.tag !== 'head' || !isStylesheet(ours) || ours.attrs.size !== 2) return false
    const n = INTERIM_CSS.indexOf(ours.attrs.get('href') ?? '')
    const siblings = elementsIn(at.ours)
    const before = siblings[siblings.indexOf(ours) - 1]
    return n > 0 && isElement(before) && before.attrs.get('href') === INTERIM_CSS[n - 1]
  },
}

// --- ∆d1N: the asset pipeline -----------------------------------------------------

const HASHED = '[A-Z0-9]{8}'

/** Which `/lib` bundle a module script loads, by the element it stands in. */
const SCRIPT_LIBS: Partial<Record<string, string>> = {
  head: 'common',
  'article-vod': 'video-on-demand',
}

/**
 * The three module scripts Eleventy's esbuild step hashes, which ours omits until the
 * asset pipeline: `/lib/common` in `head`, `/lib/video-on-demand` in `article-vod`, and
 * the inline loader of `/lib/rum` at the end of `body`, each with no other attribute.
 */
const unbuiltScripts: Forgiveness = {
  name: 'unbuilt-scripts',
  theirsOnly: (theirs, at) => {
    if (theirs.tag !== 'script' || theirs.attrs.get('type') !== 'module') return false
    if (theirs.attrs.get('async') !== '') return false
    const src = theirs.attrs.get('src')
    if (src === undefined) {
      return (
        at.theirs.tag === 'body' &&
        theirs.attrs.size === 2 &&
        new RegExp(
          `^if \\(window\\.location\\.hostname\\.endsWith\\('limulus\\.net'\\)\\) \\{\\n` +
            `import\\('/lib/rum/index\\.${HASHED}\\.js'\\)\\n\\}$`
        ).test(textOf(theirs))
      )
    }
    const lib = SCRIPT_LIBS[at.theirs.tag]
    return (
      lib !== undefined &&
      theirs.attrs.size === 3 &&
      theirs.children.length === 0 &&
      new RegExp(`^/lib/${lib}/index\\.${HASHED}\\.js$`).test(src)
    )
  },
}

// --- WebC's own markup ------------------------------------------------------------

/**
 * An attribute WebC copies from a component's props onto an element, which ours does
 * not: `href` on a `pill-button` (its `a`'s), `placement` on the `pho-picture` and `img`
 * inside an `article-photo` (the photo's), and `id` on an in-body `article-photo` (the
 * alias of the photo it links to).
 */
const webcAttrLeak: Forgiveness = {
  name: 'webc-attr-leak',
  attr: (name, ours, theirs, at) => {
    if (ours !== undefined || theirs === undefined) return false
    const element = at.theirs
    switch (`${element.tag} ${name}`) {
      case 'pill-button href':
        return elementsIn(element).some(
          (a) => a.tag === 'a' && a.attrs.get('href') === theirs
        )
      case 'pho-picture placement':
      case 'img placement': {
        const photo = at.ancestors.findLast((pair) => pair.theirs.tag === 'article-photo')
        return photo?.theirs.attrs.get('placement') === theirs
      }
      case 'article-photo id':
        return [...descendants(element)].some(
          (a) => a.tag === 'a' && a.attrs.get('href') === `/photos/${theirs}/`
        )
      default:
        return false
    }
  },
}

/** The attribute ours wrote with a `"` in it that theirs has cut at the quote. */
function cutAttribute(at: Scope): [string, string] | undefined {
  return [...at.ours.attrs].find(
    ([name, value]) =>
      value.includes('"') &&
      at.theirs.attrs.get(name) === value.slice(0, value.indexOf('"'))
  )
}

/**
 * A word of a cut-off value as the junk attribute name it became, and that name as
 * parsed, alike: lowercased, a trailing quote dropped (the value's own closing quote
 * ends its last word), and hyphens dropped (WebC camel-cased a hyphenated name).
 */
const junkName = (word: string): string =>
  word.toLowerCase().replace(/"$/, '').replaceAll('-', '')

/**
 * WebC wrote a raw `"` inside a quoted attribute, which ours escapes: parsed, theirs'
 * value stops at the quote and each word after it is an empty junk attribute. The cut
 * attribute is explained when theirs is ours cut at its first quote and the words cut
 * off are exactly the empty attributes theirs has and ours lacks — as sets, since the
 * parser keeps only the first of a repeated name, and without a word naming an attribute
 * the element already has. That check holds every junk attribute to empty and theirs
 * alone, so one is explained, on that element only, by being one of the words (fidelity
 * class, widened).
 */
const attrEscaping: Forgiveness = {
  name: 'attr-escaping',
  attr: (name, _ours, _theirs, at) => {
    const cut = cutAttribute(at)
    if (cut === undefined) return false
    const [cutName, value] = cut
    const words = new Set(tokens(value.slice(value.indexOf('"') + 1)).map(junkName))
    for (const real of at.ours.attrs.keys()) words.delete(junkName(real))
    if (name !== cutName) return words.has(junkName(name))
    const junk = [...at.theirs.attrs]
      .filter(([junkAttr, junkValue]) => junkValue === '' && !at.ours.attrs.has(junkAttr))
      .map(([junkAttr]) => junkName(junkAttr))
    return sameNames([...words], [...new Set(junk)])
  },
}

// --- D38: datetimes print in their written offset ---------------------------------

/**
 * A timestamp as ours writes one, in RFC 3339 or (for a title) RFC 2822, and only in
 * the offsets this site's dates are written in: `-07:00`, whose zone keeps no daylight
 * time, or UTC. Any other offset — a zone or daylight-time slip in the formatting — is
 * not this class, even where it names the same instant.
 */
const RFC_3339 = /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(\.\d+)?(Z|-07:00|\+00:00)$/
const RFC_2822 =
  /^[A-Z][a-z]{2}, \d{1,2} [A-Z][a-z]{2} \d{4} \d\d:\d\d:\d\d (-0700|\+0000)$/

const instant = (text: string): Date | undefined => {
  const date = new Date(text)
  return Number.isNaN(date.getTime()) ? undefined : date
}

/**
 * A timestamp attribute — `time[datetime]`, `time[title]`, and the `content` of
 * `meta[property=article:published_time]` and `article:modified_time` — where ours
 * writes the instant in its written offset and theirs is exactly that instant's UTC
 * `toISOString()` (or `toUTCString()`, for a title).
 */
const datetimeText: Forgiveness = {
  name: 'datetime-text',
  attr: (name, ours, theirs, at) => {
    const element = at.ours
    const property = element.attrs.get('property') ?? ''
    const iso =
      (element.tag === 'time' && name === 'datetime') ||
      (element.tag === 'meta' &&
        name === 'content' &&
        /^article:(published|modified)_time$/.test(property))
    const utc = element.tag === 'time' && name === 'title'
    if (ours === undefined || theirs === undefined || !(iso || utc)) return false
    const date = instant(ours)
    if (date === undefined) return false
    return iso
      ? RFC_3339.test(ours) && theirs === date.toISOString()
      : RFC_2822.test(ours) && theirs === date.toUTCString()
  },
}

const wallClock = (date: string): string => date.slice(0, 19).replace('T', ' ')

/**
 * A revision's `time` text is the UTC wall clock in theirs and the written offset's in
 * ours, both of the instant ours' `datetime` names.
 */
const utcRevisionDisplay: Forgiveness = {
  name: 'utc-revision-display',
  text: (ours, theirs, at) => {
    const written = at.ours.attrs.get('datetime') ?? ''
    const date = instant(written)
    return (
      at.ours.tag === 'time' &&
      at.ancestors.some((pair) => pair.ours.tag === 'revision-history') &&
      RFC_3339.test(written) &&
      date !== undefined &&
      ours === wallClock(written) &&
      theirs === wallClock(date.toISOString())
    )
  },
}

// --- The generators themselves ----------------------------------------------------

/** `meta[name=generator]` names Eleventy on theirs and Lemmon on ours. */
const generator: Forgiveness = {
  name: 'generator',
  attr: (name, ours, theirs, at) =>
    at.ours.tag === 'meta' &&
    at.ours.attrs.get('name') === 'generator' &&
    name === 'content' &&
    /^Lemmon \d+\.\d+\.\d+$/.test(ours ?? '') &&
    /^Eleventy v\d+\.\d+\.\d+$/.test(theirs ?? ''),
}

// --- Markdown: comrak against markdown-it and its plugins -------------------------

/**
 * comrak's anchorizer: lowercased, everything but letters, marks, numbers, connector
 * punctuation, spaces and hyphens dropped, and each space a hyphen.
 */
export const comrakSlug = (text: string): string =>
  text
    .toLowerCase()
    .replace(/[^\p{L}\p{M}\p{N}\p{Pc} -]/gu, '')
    .replaceAll(' ', '-')

/** markdown-it-anchor's default slugify. */
export const anchorSlug = (text: string): string =>
  encodeURIComponent(text.trim().toLowerCase().replace(/\s+/g, '-'))

/**
 * A heading's `id` is comrak's slug of its text in ours and markdown-it-anchor's in
 * theirs, which also adds `tabindex="-1"`. Either attribute is explained only on a
 * heading whose ids are both those slugs (fidelity class, widened from h2 to h1–h6).
 */
const headingId: Forgiveness = {
  name: 'heading-id',
  attr: (name, ours, theirs, at) =>
    /^h[1-6]$/.test(at.ours.tag) &&
    at.ours.attrs.get('id') === comrakSlug(textOf(at.ours)) &&
    at.theirs.attrs.get('id') === anchorSlug(textOf(at.theirs)) &&
    (name === 'id' || (name === 'tabindex' && ours === undefined && theirs === '-1')),
}

/**
 * markdown-it wraps the tail of an in-body `article-photo` in a `<p>`, which the parser
 * leaves as an empty `p`, or a `p` holding one empty `a`, in a `figure` holding a
 * `pho-picture`; ours splices the markup unwrapped. A `p` with content is a dropped
 * paragraph and is not this class (fidelity class).
 */
const mdPhotoWrap: Forgiveness = {
  name: 'md-photo-wrap',
  theirsOnly: (theirs, at) => {
    if (at.theirs.tag !== 'figure' || theirs.tag !== 'p') return false
    if (![...descendants(at.theirs)].some((d) => d.tag === 'pho-picture')) return false
    const [only, ...rest] = theirs.children
    return (
      only === undefined ||
      (rest.length === 0 && isElement(only, 'a') && only.children.length === 0)
    )
  },
}

/** A footnote, its reference in the prose, and the link back to that reference. */
interface Note {
  item: RenderedElement
  ref: RenderedElement
  backref: RenderedElement
}

/** One side's footnotes section, its list, and its notes in list order. */
interface Footnotes {
  section: RenderedElement
  list: RenderedElement
  notes: Note[]
}

/** Whether a note's and its reference's ids are one generator's, the note `n`th. */
type IdScheme = (item: string, ref: string, n: number) => boolean

/** comrak's ids name the footnote's label: `fn-<label>` and `fnref-<label>`. */
const COMRAK_IDS: IdScheme = (item, ref) =>
  item.startsWith('fn-') && ref === `fnref-${item.slice(3)}`

/** markdown-it-footnote's ids number the notes: `fn<n>` and `fnref<n>`. */
const MARKDOWN_IT_IDS: IdScheme = (item, ref, n) => item === `fn${n}` && ref === `fnref${n}`

const footnotesCache = new WeakMap<RenderedElement, Footnotes | null>()

/**
 * One side's footnotes, or null unless they are whole: one `section.footnotes` holding
 * one `ol` of `li`s, each holding one backref, which names a reference in a
 * `sup.footnote-ref`, which names that note back, with ids in `scheme` — and no
 * reference left over.
 */
function footnotesOf(root: RenderedElement, scheme: IdScheme): Footnotes | null {
  const cached = footnotesCache.get(root)
  if (cached !== undefined) return cached
  const all = [...descendants(root)]
  const refs = all
    .filter((sup) => sup.tag === 'sup' && hasClass(sup, 'footnote-ref'))
    .flatMap((sup) => elementsIn(sup).filter((a) => a.tag === 'a'))
  const sections = all.filter((s) => s.tag === 'section' && hasClass(s, 'footnotes'))
  const [list, ...others] = sections.length === 1 ? elementsIn(sections[0]) : []
  const notes: Note[] = []
  if (isElement(list, 'ol') && others.length === 0) {
    for (const [n, item] of elementsIn(list).entries()) {
      const backrefs = [...descendants(item)].filter(
        (a) => a.tag === 'a' && hasClass(a, 'footnote-backref')
      )
      const href = backrefs.length === 1 ? backrefs[0].attrs.get('href') : undefined
      const ref = refs.find((r) => href === `#${r.attrs.get('id')}`)
      const id = item.attrs.get('id') ?? ''
      if (
        item.tag !== 'li' ||
        ref === undefined ||
        ref.attrs.get('href') !== `#${id}` ||
        !scheme(id, ref.attrs.get('id') ?? '', n + 1)
      ) {
        break
      }
      notes.push({ item, ref, backref: backrefs[0] })
    }
  }
  const whole =
    isElement(list, 'ol') &&
    notes.length > 0 &&
    notes.length === elementsIn(list).length &&
    notes.length === refs.length
  const result = whole ? { section: sections[0], list, notes } : null
  footnotesCache.set(root, result)
  return result
}

/**
 * Footnotes as markdown-it-footnote writes them where ours has comrak's: notes numbered
 * in theirs' ids and labelled in ours', `[n]` where ours says `n`, `↩︎` for `↩`, theirs'
 * `footnotes-list`, `footnote-item` and `section-separator` classes, and ours'
 * `data-footnote*` and `aria-label`. Explained only where the footnotes are whole on
 * both sides — every reference and its note name each other — and the pair is the same
 * note's, so a reference that points at another note, or a note out of its place, is
 * not this class. The prose of the notes compares as any text does (∆ITg).
 */
const footnoteMarkup: Forgiveness = {
  name: 'footnote-markup',
  attr: (name, ours, theirs, at) => {
    const found = paired(at)
    if (found === null) return false
    const { o, t, n } = found
    if (at.ours === o.section && at.theirs === t.section) {
      return (
        (name === 'class' &&
          sameNames([...tokens(ours), 'section-separator'], tokens(theirs))) ||
        (name === 'data-footnotes' && ours === '' && theirs === undefined)
      )
    }
    if (at.ours === o.list && at.theirs === t.list) {
      return name === 'class' && ours === undefined && theirs === 'footnotes-list'
    }
    switch (`${n.role} ${name}`) {
      case 'item id':
      case 'ref href':
      case 'ref id':
      case 'backref href':
        return true
      case 'item class':
        return ours === undefined && theirs === 'footnote-item'
      case 'ref data-footnote-ref':
      case 'backref data-footnote-backref':
        return ours === '' && theirs === undefined
      case 'backref data-footnote-backref-idx':
        return ours === String(n.number) && theirs === undefined
      case 'backref aria-label':
        return ours === `Back to reference ${n.number}` && theirs === undefined
      default:
        return false
    }
  },
  text: (ours, theirs, at) => {
    const { n } = paired(at) ?? {}
    if (n?.role === 'ref') return ours === String(n.number) && theirs === `[${n.number}]`
    return n?.role === 'backref' && ours === '↩' && theirs === '↩︎'
  },
}

/**
 * Both sides' footnotes where both are whole and alike in length, with the role and
 * number of the note `at`'s pair is part of on both sides, if it is one.
 */
function paired(at: Scope): {
  o: Footnotes
  t: Footnotes
  n: { role: keyof Note | null; number: number }
} | null {
  const roots = rootsOf(at)
  const o = footnotesOf(roots.ours, COMRAK_IDS)
  const t = footnotesOf(roots.theirs, MARKDOWN_IT_IDS)
  if (o === null || t === null || o.notes.length !== t.notes.length) return null
  for (const role of ['item', 'ref', 'backref'] as const) {
    const n = o.notes.findIndex((note) => note[role] === at.ours)
    if (n !== -1 && t.notes[n][role] === at.theirs) {
      return { o, t, n: { role, number: n + 1 } }
    }
  }
  return { o, t, n: { role: null, number: 0 } }
}

/**
 * A reading-time chip in the post's header reads `N min read` one minute under theirs:
 * the reading-time package counts the markdown source, where a link is its URL, and
 * Lemmon's `readingTime()` the rendered text, on purpose (its doc comment in lemmon's
 * `builtins/text.rs`). Only that direction has been seen, so only it is accepted.
 */
const readingTime: Forgiveness = {
  name: 'reading-time',
  text: (ours, theirs, at) => {
    const chip = at.ours
    const scroll = [...descendants(chip)].some(
      (use) => use.tag === 'use' && use.attrs.get('href') === '#svg-scroll-solid'
    )
    const [o, t] = [ours, theirs].map((text) => /^(\d+) min read$/.exec(text)?.[1])
    return (
      chip.tag === 'data-chip' &&
      scroll &&
      at.ancestors.some((pair) => pair.ours.tag === 'article-header') &&
      o !== undefined &&
      t !== undefined &&
      Number(o) === Number(t) - 1
    )
  },
}

// --- ∆tAw: the other collections --------------------------------------------------

const DESC_ID = /^symbol-(.+)-desc-[0-9a-z]+$/

const idCounts = new WeakMap<RenderedElement, Map<string, number>>()

/** How many elements under `root` carry `id`. */
function carriers(root: RenderedElement, id: string): number {
  let counts = idCounts.get(root)
  if (counts === undefined) {
    counts = new Map()
    for (const element of descendants(root)) {
      const own = element.attrs.get('id')
      if (own !== undefined) counts.set(own, (counts.get(own) ?? 0) + 1)
    }
    idCounts.set(root, counts)
  }
  return counts.get(id) ?? 0
}

/** The `desc` child of `svg` whose id its `aria-labelledby` names. */
const labelOf = (svg: RenderedElement): RenderedElement | undefined =>
  elementsIn(svg).find(
    (desc) =>
      desc.tag === 'desc' && desc.attrs.get('id') === svg.attrs.get('aria-labelledby')
  )

/**
 * Inside a recommended card, an icon's `svg[aria-labelledby]` and its `desc[id]` are
 * `symbol-<icon>-desc-<n>` with the same icon and another `n`: eleventy-plugin-svg-sprite
 * counts each icon's uses on a page, in base 36, and the cards' pages differ — another
 * card set, or the feed index. On each side the
 * `svg` must still name its own `desc`, and no other element on that side's page may
 * carry the id (∆tAw, with recommended-set).
 */
const svgDescCounter: Forgiveness = {
  name: 'svg-desc-counter',
  attr: (name, ours, theirs, at) => {
    const isSvg = at.ours.tag === 'svg' && name === 'aria-labelledby'
    const isDesc = at.ours.tag === 'desc' && name === 'id'
    const svg = isSvg ? at : parentOf(at)
    if (!(isSvg || isDesc) || svg?.ours.tag !== 'svg') return false
    const [o, t] = [ours, theirs].map((id) => DESC_ID.exec(id ?? '')?.[1])
    const labels = [labelOf(svg.ours), labelOf(svg.theirs)]
    const own = isSvg
      ? labels.every((label) => label !== undefined)
      : labels[0] === at.ours && labels[1] === at.theirs
    const roots = rootsOf(at)
    const unique =
      carriers(roots.ours, ours ?? '') <= 1 && carriers(roots.theirs, theirs ?? '') <= 1
    return o !== undefined && o === t && own && unique
  },
}

const RECOMMENDED = 5

/** An `article-list`'s `ul` and its cards, whether text stands among them, or null. */
function listOf(
  list: RenderedElement
): { ul: RenderedElement; cards: Card[]; text: boolean } | null {
  const [ul, ...rest] = elementsIn(list)
  if (!isElement(ul, 'ul') || rest.length > 0) return null
  const cards: Card[] = []
  let text = ul.children.some((child) => child.kind === 'text')
  for (const li of elementsIn(ul)) {
    const [card, ...more] = elementsIn(li)
    if (li.tag !== 'li' || !isElement(card, 'article-card') || more.length > 0) return null
    const href = [...descendants(card)].find((a) => a.tag === 'a')?.attrs.get('href')
    if (href === undefined) return null
    text ||= li.children.some((child) => child.kind === 'text')
    cards.push({ li, card, href })
  }
  return { ul, cards, text }
}

/** The instant a card's `time[datetime]` names. */
const publishedAt = (card: RenderedElement): number =>
  Date.parse(
    [...descendants(card)].find((time) => time.tag === 'time')?.attrs.get('datetime') ?? ''
  )

/** Every feed post's card on Eleventy's feed index page, in its order. */
export function feedCards(index: RenderedPage): ReferenceCard[] {
  const list = [...descendants(index.root)].find(
    (element) => element.tag === 'article-list'
  )
  const cards = list === undefined ? [] : (listOf(list)?.cards ?? [])
  return cards
    .filter(({ href }) => href.startsWith('/feed/'))
    .map((card) => ({ ...card, published: publishedAt(card.card) }))
}

/** `element` without its children, so a comparison sees only its attributes. */
const alone = (element: RenderedElement): RenderedElement => ({ ...element, children: [] })

/**
 * "You Might Enjoy…" lists the newest feed posts in ours and the newest of all articles
 * — feed posts, links and TILs — in theirs, so the lists differ by the cards one side
 * lists and the other does not, and by nothing else. Ours must list exactly the newest
 * min(5, posts − 1) feed posts but the page itself, newest first, as the feed index's
 * dates rank them; theirs' feed cards must be ours' first; no text may stand in the
 * list. The `ul`, each `li` and each card of ours are still compared: against theirs'
 * where it lists the post, else against the post's card on the feed index, with
 * svg-desc-counter in effect inside each card. Counted once per card one side lists and
 * the other does not, and not at all where the selection is refused.
 */
export function recommendedSet(post: Post): Forgiveness {
  return {
    name: 'recommended-set',
    subtree: (at, sub) => {
      const section = parentOf(at)
      if (at.ours.tag !== 'article-list' || section?.ours.tag !== 'section') return null
      const heading = elementsIn(section.ours)[0]
      if (!isElement(heading, 'h2') || textOf(heading) !== 'You Might Enjoy…') return null
      const ours = listOf(at.ours)
      const theirs = listOf(at.theirs)
      if (ours === null || theirs === null) return null
      const hrefs = ours.cards.map(({ href }) => href)
      const expected = [...post.feed]
        .sort((a, b) => b.published - a.published)
        .map(({ href }) => href)
        .filter((href) => href !== post.url)
        .slice(0, Math.min(RECOMMENDED, post.feed.length - 1))
      const references = ours.cards.map((card) => ({
        card,
        reference:
          theirs.cards.find(({ href }) => href === card.href) ??
          post.feed.find(({ href }) => href === card.href),
      }))
      const problems: string[] = []
      if (ours.text || theirs.text) problems.push('text stands in the card list')
      if (hrefs.join(' ') !== expected.join(' ')) {
        problems.push(
          `ours lists ${hrefs.join(', ')}; the newest are ${expected.join(', ')}`
        )
      }
      const feed = theirs.cards.filter(({ href }) => href.startsWith('/feed/'))
      if (feed.some(({ href }, n) => hrefs[n] !== href)) {
        problems.push("theirs' feed cards are not ours' first, in order")
      }
      for (const { card, reference } of references) {
        if (reference === undefined) problems.push(`no card to compare ${card.href} with`)
      }
      if (problems.length > 0) sub.differ(`recommended-set: ${problems.join('; ')}`)
      sub.compare(alone(ours.ul), alone(theirs.ul), 'ul')
      for (const { card, reference } of references) {
        if (reference === undefined) continue
        sub.compare(alone(card.li), alone(reference.li), `li ${card.href}`)
        sub.compare(card.card, reference.card, `card ${card.href}`, [svgDescCounter])
      }
      if (problems.length > 0) return 0
      const shared = ours.cards.filter((card) =>
        theirs.cards.some(({ href }) => href === card.href)
      )
      return ours.cards.length - shared.length + (theirs.cards.length - shared.length)
    },
  }
}

/** Every class `npm run parity` accepts on `post`, in the order they are consulted. */
export function forgiveness(post: Post): Forgiveness[] {
  return [
    scopedClass,
    interimCss,
    unbuiltScripts,
    webcAttrLeak,
    datetimeText,
    utcRevisionDisplay,
    generator,
    headingId,
    mdPhotoWrap,
    attrEscaping,
    footnoteMarkup,
    readingTime,
    recommendedSet(post),
  ]
}

export const CLASSES = {
  scopedClass,
  interimCss,
  unbuiltScripts,
  webcAttrLeak,
  datetimeText,
  utcRevisionDisplay,
  generator,
  headingId,
  mdPhotoWrap,
  attrEscaping,
  footnoteMarkup,
  readingTime,
  svgDescCounter,
}
