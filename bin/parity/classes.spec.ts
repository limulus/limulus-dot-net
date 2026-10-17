import {
  compareRendered,
  renderedPage,
  type Comparison,
  type Forgiveness,
} from '@limulus/lemmon-shell'
import { describe, expect, it } from 'vitest'

import {
  anchorSlug,
  bundleName,
  CLASSES,
  comrakSlug,
  cssBundle,
  feedCards,
  lastDifference,
  forgiveness,
  recommendedSet,
  SITE_DISPLAY,
  type Bundles,
} from './classes.ts'

/** Compares two documents built from a head and a body, through `classes`. */
function compare(
  ours: { head?: string; body?: string },
  theirs: { head?: string; body?: string },
  classes: Forgiveness[]
): Comparison {
  const page = ({ head = '', body = '' }: { head?: string; body?: string }) =>
    renderedPage(`<!doctype html><html><head>${head}</head><body>${body}</body></html>`, {
      display: SITE_DISPLAY,
    })
  return compareRendered(page(ours), page(theirs), classes)
}

/** Compares two bodies through `classes`. */
const bodies = (ours: string, theirs: string, ...classes: Forgiveness[]): Comparison =>
  compare({ body: ours }, { body: theirs }, classes)

/** Compares two heads through `classes`. */
const heads = (ours: string, theirs: string, ...classes: Forgiveness[]): Comparison =>
  compare({ head: ours }, { head: theirs }, classes)

const forgiven = (comparison: Comparison): [string, number][] => [...comparison.forgiven]

/** Whether the comparison found nothing it could not explain. */
const clean = (comparison: Comparison): boolean => comparison.differences.length === 0

/** No CSS bundles, for the classes that do not read them. */
const NO_CSS: Bundles = { ours: new Map(), theirs: new Map(), globals: '' }

describe('scoped-class', () => {
  const { scopedClass } = CLASSES

  it('should accept a function name on its host where theirs has its hash', () => {
    const result = bodies(
      '<data-chip class="dataChip">x</data-chip>',
      '<data-chip class="wvormuvo0">x</data-chip>',
      scopedClass
    )
    expect(clean(result)).toBe(true)
    expect(forgiven(result)).toEqual([['scoped-class', 1]])
  })

  it('should accept a hash inside its host, beside the classes both sides have', () => {
    const result = bodies(
      '<article class="article"><footer class="section-separator">f</footer></article>',
      '<article class="wo-ywfb1w"><footer class="section-separator wo-ywfb1w">f</footer></article>',
      scopedClass
    )
    expect(clean(result)).toBe(true)
    expect(forgiven(result)).toEqual([['scoped-class', 2]])
  })

  it('should tell the two layouts hosted by an article apart', () => {
    const video = bodies(
      '<article class="video"><header>h</header></article>',
      '<article class="w3qf9ro4j"><header class="w3qf9ro4j">h</header></article>',
      scopedClass
    )
    expect(clean(video)).toBe(true)
    const crossed = bodies(
      '<article class="video">a</article>',
      '<article class="wo-ywfb1w">a</article>',
      scopedClass
    )
    expect(clean(crossed)).toBe(false)
  })

  it('should not accept a function name on another component’s host', () => {
    expect(
      clean(
        bodies(
          '<chip-list class="dataChip">x</chip-list>',
          '<chip-list class="wvormuvo0">x</chip-list>',
          scopedClass
        )
      )
    ).toBe(false)
    expect(
      clean(
        bodies(
          '<data-chip class="chipList">x</data-chip>',
          '<data-chip class="wu_v_wm2n">x</data-chip>',
          scopedClass
        )
      )
    ).toBe(false)
  })

  it('should not accept a hash outside its component’s host', () => {
    expect(clean(bodies('<p>x</p>', '<p class="wb7dbjyrb">x</p>', scopedClass))).toBe(false)
    expect(
      clean(
        bodies(
          '<pill-button class="pillButton"><a href="/">a</a></pill-button>',
          '<pill-button class="wb7dbjyrb"><a href="/" class="wvormuvo0">a</a></pill-button>',
          scopedClass
        )
      )
    ).toBe(false)
  })

  it('should not accept a class shaped like a hash that is no component’s', () => {
    expect(clean(bodies('<p>x</p>', '<p class="wordcount">x</p>', scopedClass))).toBe(false)
  })

  it('should not accept another class beside a hash', () => {
    const result = bodies(
      '<data-chip class="dataChip small">x</data-chip>',
      '<data-chip class="wvormuvo0 large">x</data-chip>',
      scopedClass
    )
    expect(clean(result)).toBe(false)
  })

  it('should not accept a function name on an element inside another host', () => {
    const result = bodies(
      '<article class="article"><header class="ldnHeader">h</header></article>',
      '<article class="wo-ywfb1w"><header class="wo-ywfb1w">h</header></article>',
      scopedClass
    )
    expect(clean(result)).toBe(false)
  })
})

describe('css-bundle', () => {
  const GLOBALS = 'html { line-height: 1.15; }\nbody { margin: 0; }'

  /** A bundle holding `text` under `dir`, at the url its hash names. */
  const bundle = (dir: string, text: string): [string, Buffer] => {
    const bytes = Buffer.from(text)
    return [`${dir}${bundleName(bytes)}.css`, bytes]
  }
  const ours = (text: string) => bundle('/assets/immutable/bundle/', text)
  const theirs = (text: string) => bundle('/assets/immutable/11ty/bundle/', text)
  const OURS = ours(GLOBALS)
  const THEIRS = theirs(`.wvormuvo0{display:flex}\n${GLOBALS}`)

  const link = (href: string, more = '') => `<link rel="stylesheet" href="${href}"${more}>`

  /** A css-bundle that reads the bundles given, ours' and theirs' above by default. */
  const bundles = (
    files: { ours?: [string, Buffer][]; theirs?: [string, Buffer][] } = {}
  ) =>
    cssBundle({
      url: '/feed/x/',
      feed: [],
      css: {
        ours: new Map(files.ours ?? [OURS]),
        theirs: new Map(files.theirs ?? [THEIRS]),
        globals: GLOBALS,
      },
    })

  /** Two links in head compared through `cls`, and what it refused. */
  const linked = (oursHref: string, theirsHref: string, cls = bundles()) => {
    const result = heads(link(oursHref), link(theirsHref), cls)
    return { clean: clean(result), refusals: cls.refusals }
  }

  it('should name a bundle as Eleventy and the bundler do', () => {
    expect(bundleName(Buffer.from(''))).toBe('47DEQpj8HB')
    expect(bundleName(Buffer.from('0'))).toBe('X-zrZv_Ibz')
  })

  it('should accept ours’ bundle where theirs links Eleventy’s, once', () => {
    const cls = bundles()
    const result = heads(
      `${link(OURS[0])}<title>t</title>`,
      `${link(THEIRS[0])}<title>t</title>`,
      cls
    )
    expect(clean(result)).toBe(true)
    expect(forgiven(result)).toEqual([['css-bundle', 1]])
    expect(cls.refusals).toEqual([])
  })

  it('should refuse a bundle not named by its hash, on either side', () => {
    const o = '/assets/immutable/bundle/AAAAAAAAAA.css'
    expect(linked(o, THEIRS[0], bundles({ ours: [[o, OURS[1]]] }))).toEqual({
      clean: false,
      refusals: [`css-bundle: ${o} is not named by its hash, ${bundleName(OURS[1])}`],
    })
    const t = '/assets/immutable/11ty/bundle/AAAAAAAAAA.css'
    expect(linked(OURS[0], t, bundles({ theirs: [[t, THEIRS[1]]] }))).toEqual({
      clean: false,
      refusals: [`css-bundle: ${t} is not named by its hash, ${bundleName(THEIRS[1])}`],
    })
  })

  it('should refuse a bundle that was not written, on either side', () => {
    expect(linked(OURS[0], THEIRS[0], bundles({ ours: [] }))).toEqual({
      clean: false,
      refusals: [`css-bundle: ${OURS[0]} was not written`],
    })
    expect(linked(OURS[0], THEIRS[0], bundles({ theirs: [] }))).toEqual({
      clean: false,
      refusals: [`css-bundle: ${THEIRS[0]} was not written`],
    })
  })

  it('should refuse ours where one byte of a global stylesheet changed', () => {
    const changed = ours(GLOBALS.replace('margin: 0', 'margin: 1'))
    expect(linked(changed[0], THEIRS[0], bundles({ ours: [changed] }))).toEqual({
      clean: false,
      refusals: [
        'css-bundle: ours does not end with the global stylesheets, ' +
          'at offset 3 from the end, "html { line-height: 1.15; }\\nbody { margin: 1; }" ' +
          'where expected "html { line-height: 1.15; }\\nbody { margin: 0; }"',
      ],
    })
  })

  it('should refuse ours holding anything after the global stylesheets', () => {
    const after = ours(`${GLOBALS}\n.x{}`)
    expect(linked(after[0], THEIRS[0], bundles({ ours: [after] }))).toEqual({
      clean: false,
      refusals: [
        'css-bundle: ours does not end with the global stylesheets, ' +
          'at offset 1 from the end, ' +
          '"html { line-height: 1.15; }\\nbody { margin: 0; }\\n.x{}" ' +
          'where expected "html { line-height: 1.15; }\\nbody { margin: 0; }"',
      ],
    })
  })

  it('should refuse theirs where it does not end with the global stylesheets', () => {
    const lacking = theirs('.wvormuvo0{display:flex}')
    expect(linked(OURS[0], lacking[0], bundles({ theirs: [lacking] }))).toEqual({
      clean: false,
      refusals: [
        'css-bundle: theirs does not end with the global stylesheets, ' +
          'at offset 1 from the end, ".wvormuvo0{display:flex}" ' +
          'where expected "html { line-height: 1.15; }\\nbody { margin: 0; }"',
      ],
    })
  })

  it('should refuse ours holding anything before the global stylesheets', () => {
    const more = ours(`.dataChip { display: flex; }\n${GLOBALS}`)
    expect(linked(more[0], THEIRS[0], bundles({ ours: [more] }))).toEqual({
      clean: false,
      refusals: [
        'css-bundle: ours holds 29 characters before the global stylesheets, ' +
          'which no component collects yet',
      ],
    })
  })

  it('should not take a bundle link outside head', () => {
    const cls = bundles()
    const result = bodies(
      `<div>${link(OURS[0])}</div>`,
      `<div>${link(THEIRS[0])}</div>`,
      cls
    )
    expect(clean(result)).toBe(false)
    expect(cls.refusals).toEqual([])
  })

  it('should not take a link carrying a third attribute, or another rel', () => {
    const cls = bundles()
    const media = ' media="print"'
    expect(clean(heads(link(OURS[0], media), link(THEIRS[0], media), cls))).toBe(false)
    const preload = (href: string) => `<link rel="preload" href="${href}">`
    expect(clean(heads(preload(OURS[0]), preload(THEIRS[0]), cls))).toBe(false)
    expect(cls.refusals).toEqual([])
  })

  it('should not take a bundle’s url in another attribute', () => {
    const cls = bundles()
    const src = (url: string) => `<link rel="stylesheet" src="${url}">`
    expect(clean(heads(src(OURS[0]), src(THEIRS[0]), cls))).toBe(false)
    expect(cls.refusals).toEqual([])
  })

  it('should not take an href outside its side’s bundle directory', () => {
    const misplaced = theirs(GLOBALS)
    expect(linked(misplaced[0], THEIRS[0], bundles({ ours: [misplaced] }))).toEqual({
      clean: false,
      refusals: [],
    })
    const theirsMisplaced = ours(THEIRS[1].toString())
    expect(
      linked(OURS[0], theirsMisplaced[0], bundles({ theirs: [theirsMisplaced] }))
    ).toEqual({ clean: false, refusals: [] })
  })
})

describe('lastDifference()', () => {
  it('should show up to 60 characters of each text either side of where they part', () => {
    const a = 'x'.repeat(100) + 'a' + 'y'.repeat(100)
    const b = 'x'.repeat(100) + 'b' + 'y'.repeat(100)
    expect(lastDifference(a, b)).toBe(
      `at offset 100 from the end, "${'x'.repeat(59)}a${'y'.repeat(60)}" ` +
        `where expected "${'x'.repeat(59)}b${'y'.repeat(60)}"`
    )
    expect(lastDifference('ab', 'cab')).toBe(
      'at offset 2 from the end, "ab" where expected "cab"'
    )
  })
})

describe('unbuilt-scripts', () => {
  const { unbuiltScripts } = CLASSES
  const rum =
    '<script type="module" async>\n  if (window.location.hostname.endsWith(\'limulus.net\')) {\n' +
    "    import('/lib/rum/index.VATR7HHP.js')\n  }\n</script>"

  it('should accept the three hashed module scripts where each belongs', () => {
    const result = compare(
      { head: '<title>t</title>', body: '<article-vod>v</article-vod><p>x</p>' },
      {
        head: '<title>t</title><script type="module" src="/lib/common/index.YDUDOD6U.js" async></script>',
        body:
          '<article-vod>v<script type="module" src="/lib/video-on-demand/index.O25LTEX2.js" async></script></article-vod>' +
          `<p>x</p>${rum}`,
      },
      [unbuiltScripts]
    )
    expect(clean(result)).toBe(true)
    expect(forgiven(result)).toEqual([['unbuilt-scripts', 3]])
  })

  it('should not accept another bundle, a script elsewhere, or another attribute', () => {
    const script = (src: string, more = '') =>
      `<script type="module" src="${src}" async${more}></script>`
    expect(clean(heads('', script('/lib/other/index.YDUDOD6U.js'), unbuiltScripts))).toBe(
      false
    )
    expect(clean(bodies('', script('/lib/common/index.YDUDOD6U.js'), unbuiltScripts))).toBe(
      false
    )
    expect(
      clean(heads('', script('/lib/common/index.YDUDOD6U.js', ' nomodule'), unbuiltScripts))
    ).toBe(false)
    expect(clean(heads('', script('/lib/common/index.unhashed.js'), unbuiltScripts))).toBe(
      false
    )
  })

  it('should not accept an inline script that does more than load the bundle', () => {
    const extended = rum.replace("import('/lib/rum", "track()\n    import('/lib/rum")
    expect(clean(bodies('', extended, unbuiltScripts))).toBe(false)
  })

  it('should not accept the inline loader anywhere but body', () => {
    expect(clean(heads('', rum, unbuiltScripts))).toBe(false)
  })
})

describe('webc-attr-leak', () => {
  const { webcAttrLeak } = CLASSES

  it('should accept a pill-button carrying its link’s href', () => {
    const result = bodies(
      '<pill-button><a href="/feed.xml">RSS</a></pill-button>',
      '<pill-button href="/feed.xml"><a href="/feed.xml">RSS</a></pill-button>',
      webcAttrLeak
    )
    expect(clean(result)).toBe(true)
    expect(forgiven(result)).toEqual([['webc-attr-leak', 1]])
  })

  it('should accept the photo’s placement inside it and its alias on it', () => {
    const photo = (attrs: string, inner: string) =>
      `<article-photo placement="right"${attrs}><figure><a href="/photos/falls/">` +
      `<pho-picture${inner}><img src="x.jpg"${inner}></pho-picture></a></figure></article-photo>`
    const result = bodies(
      photo('', ''),
      photo(' id="falls"', ' placement="right"'),
      webcAttrLeak
    )
    expect(clean(result)).toBe(true)
    expect(forgiven(result)).toEqual([['webc-attr-leak', 3]])
  })

  it('should not accept an href its link does not have, or a placement not the photo’s', () => {
    expect(
      clean(
        bodies(
          '<pill-button><a href="/feed.xml">RSS</a></pill-button>',
          '<pill-button href="/other/"><a href="/feed.xml">RSS</a></pill-button>',
          webcAttrLeak
        )
      )
    ).toBe(false)
    expect(
      clean(
        bodies(
          '<article-photo placement="right"><pho-picture></pho-picture></article-photo>',
          '<article-photo placement="right"><pho-picture placement="left"></pho-picture></article-photo>',
          webcAttrLeak
        )
      )
    ).toBe(false)
  })

  it('should not accept an id naming a photo the element does not link to', () => {
    const result = bodies(
      '<article-photo><a href="/photos/falls/">f</a></article-photo>',
      '<article-photo id="gorge"><a href="/photos/falls/">f</a></article-photo>',
      webcAttrLeak
    )
    expect(clean(result)).toBe(false)
  })

  it('should not accept the attribute where ours has one too', () => {
    const result = bodies(
      '<pill-button href="/x/"><a href="/feed.xml">RSS</a></pill-button>',
      '<pill-button href="/feed.xml"><a href="/feed.xml">RSS</a></pill-button>',
      webcAttrLeak
    )
    expect(clean(result)).toBe(false)
  })
})

describe('datetime-text', () => {
  const { datetimeText } = CLASSES

  it('should accept a time and a meta naming the same instant in UTC', () => {
    const result = compare(
      {
        head: '<meta property="article:published_time" content="2026-06-19T15:28:00-07:00">',
        body: '<time datetime="2026-06-19T15:28:00-07:00" title="Fri, 19 Jun 2026 15:28:00 -0700">x</time>',
      },
      {
        head: '<meta property="article:published_time" content="2026-06-19T22:28:00.000Z">',
        body: '<time datetime="2026-06-19T22:28:00.000Z" title="Fri, 19 Jun 2026 22:28:00 GMT">x</time>',
      },
      [datetimeText]
    )
    expect(clean(result)).toBe(true)
    expect(forgiven(result)).toEqual([['datetime-text', 2]])
  })

  it('should accept fractional seconds written shorter than toISOString writes them', () => {
    const result = bodies(
      '<time datetime="2026-06-28T18:40:44.77Z">x</time>',
      '<time datetime="2026-06-28T18:40:44.770Z">x</time>',
      datetimeText
    )
    expect(clean(result)).toBe(true)
  })

  it('should not accept another instant', () => {
    const result = bodies(
      '<time datetime="2026-06-19T15:28:00-07:00">x</time>',
      '<time datetime="2026-06-19T22:29:00.000Z">x</time>',
      datetimeText
    )
    expect(clean(result)).toBe(false)
  })

  it('should not accept the same instant in an attribute that is no timestamp', () => {
    const result = heads(
      '<meta property="og:updated_time" content="2026-06-19T15:28:00-07:00">',
      '<meta property="og:updated_time" content="2026-06-19T22:28:00.000Z">',
      datetimeText
    )
    expect(clean(result)).toBe(false)
  })

  it('should not accept UTC text that is not what toISOString or toUTCString write', () => {
    expect(
      clean(
        bodies(
          '<time datetime="2026-06-19T15:28:00-07:00">x</time>',
          '<time datetime="2026-06-19T22:28:00Z">x</time>',
          datetimeText
        )
      )
    ).toBe(false)
    expect(
      clean(
        bodies(
          '<time title="Fri, 19 Jun 2026 15:28:00 -0700">x</time>',
          '<time title="2026-06-19T22:28:00.000Z">x</time>',
          datetimeText
        )
      )
    ).toBe(false)
  })

  it('should accept UTC written as Z or +00:00', () => {
    const utc = (written: string) =>
      bodies(
        `<time datetime="${written}">x</time>`,
        '<time datetime="2024-11-24T18:51:00.000Z">x</time>',
        datetimeText
      )
    expect(clean(utc('2024-11-24T18:51:00Z'))).toBe(true)
    expect(clean(utc('2024-11-24T18:51:00+00:00'))).toBe(true)
  })

  it('should not accept an offset the site does not write, though the instant agrees', () => {
    expect(
      clean(
        bodies(
          '<time datetime="2026-06-19T16:28:00-06:00">x</time>',
          '<time datetime="2026-06-19T22:28:00.000Z">x</time>',
          datetimeText
        )
      )
    ).toBe(false)
    expect(
      clean(
        bodies(
          '<time title="Fri, 19 Jun 2026 16:28:00 -0600">x</time>',
          '<time title="Fri, 19 Jun 2026 22:28:00 GMT">x</time>',
          datetimeText
        )
      )
    ).toBe(false)
  })

  it('should not accept ours written in another format, though the instant agrees', () => {
    const result = bodies(
      '<time datetime="Fri, 19 Jun 2026 15:28:00 -0700">x</time>',
      '<time datetime="2026-06-19T22:28:00.000Z">x</time>',
      datetimeText
    )
    expect(clean(result)).toBe(false)
  })
})

describe('utc-revision-display', () => {
  const { utcRevisionDisplay } = CLASSES
  const time = (text: string) => `<time datetime="2025-11-03T16:33:40-07:00">${text}</time>`

  it('should accept a revision time shown as the UTC wall clock in theirs', () => {
    const result = bodies(
      `<revision-history><a>${time('2025-11-03 16:33:40')}</a></revision-history>`,
      `<revision-history><a>${time('2025-11-03 23:33:40')}</a></revision-history>`,
      utcRevisionDisplay
    )
    expect(clean(result)).toBe(true)
    expect(forgiven(result)).toEqual([['utc-revision-display', 1]])
  })

  it('should not accept another hour, or a time outside the revision history', () => {
    expect(
      clean(
        bodies(
          `<revision-history>${time('2025-11-03 16:33:40')}</revision-history>`,
          `<revision-history>${time('2025-11-03 22:33:40')}</revision-history>`,
          utcRevisionDisplay
        )
      )
    ).toBe(false)
    expect(
      clean(
        bodies(time('2025-11-03 16:33:40'), time('2025-11-03 23:33:40'), utcRevisionDisplay)
      )
    ).toBe(false)
  })

  it('should not accept a revision written in an offset the site does not write', () => {
    const at = (text: string) =>
      `<revision-history><time datetime="2025-11-03T17:33:40-06:00">${text}</time></revision-history>`
    expect(
      clean(
        bodies(at('2025-11-03 17:33:40'), at('2025-11-03 23:33:40'), utcRevisionDisplay)
      )
    ).toBe(false)
  })
})

describe('generator', () => {
  const { generator } = CLASSES
  const meta = (name: string, content: string) =>
    `<meta name="${name}" content="${content}">`

  it('should accept Lemmon where theirs names Eleventy', () => {
    const result = heads(
      meta('generator', 'Lemmon 0.0.0'),
      meta('generator', 'Eleventy v3.1.2'),
      generator
    )
    expect(clean(result)).toBe(true)
    expect(forgiven(result)).toEqual([['generator', 1]])
  })

  it('should not accept another meta, or ours naming something else', () => {
    expect(
      clean(
        heads(meta('author', 'Lemmon 0.0.0'), meta('author', 'Eleventy v3.1.2'), generator)
      )
    ).toBe(false)
    expect(
      clean(
        heads(
          meta('generator', 'Eleventy v3.1.2'),
          meta('generator', 'Eleventy v3.1.3'),
          generator
        )
      )
    ).toBe(false)
  })
})

describe('heading-id', () => {
  const { headingId } = CLASSES

  it('should slug a heading as comrak and markdown-it-anchor do', () => {
    expect(comrakSlug('Rebuilding limulus.net')).toBe('rebuilding-limulusnet')
    expect(anchorSlug('Rebuilding limulus.net')).toBe('rebuilding-limulus.net')
    expect(comrakSlug('Elon Musk’s homepage')).toBe('elon-musks-homepage')
    expect(anchorSlug('Elon Musk’s homepage')).toBe('elon-musk%E2%80%99s-homepage')
  })

  it('should accept each side’s slug of the heading, and theirs’ tabindex', () => {
    const result = bodies(
      '<h2 id="elon-musks-homepage">Elon Musk’s homepage</h2><h3 id="plain">Plain</h3>',
      '<h2 id="elon-musk%E2%80%99s-homepage" tabindex="-1">Elon Musk’s homepage</h2>' +
        '<h3 id="plain" tabindex="-1">Plain</h3>',
      headingId
    )
    expect(clean(result)).toBe(true)
    expect(forgiven(result)).toEqual([['heading-id', 2]])
  })

  it('should not accept an id in ours that is not comrak’s slug of the heading', () => {
    const result = bodies(
      '<h2 id="elon-musk">Elon Musk’s homepage</h2>',
      '<h2 id="elon-musk%E2%80%99s-homepage" tabindex="-1">Elon Musk’s homepage</h2>',
      headingId
    )
    expect(clean(result)).toBe(false)
  })

  it('should not accept an id in theirs that is not the percent-encoded slug', () => {
    const result = bodies(
      '<h2 id="elon-musks-homepage">Elon Musk’s homepage</h2>',
      '<h2 id="elon-musks-homepage-1" tabindex="-1">Elon Musk’s homepage</h2>',
      headingId
    )
    expect(clean(result)).toBe(false)
  })

  it('should not accept another tabindex, or the ids on an element that is no heading', () => {
    expect(
      clean(
        bodies(
          '<h3 id="plain">Plain</h3>',
          '<h3 id="plain" tabindex="0">Plain</h3>',
          headingId
        )
      )
    ).toBe(false)
    expect(
      clean(bodies('<p id="a-b">A.B</p>', '<p id="a.b" tabindex="-1">A.B</p>', headingId))
    ).toBe(false)
  })
})

describe('md-photo-wrap', () => {
  const { mdPhotoWrap } = CLASSES
  const figure = (tail: string) => `<figure><pho-picture>p</pho-picture>${tail}</figure>`

  it('should accept the empty paragraphs markdown-it leaves in a photo’s figure', () => {
    const result = bodies(figure(''), figure('<p></p><p><a></a></p>'), mdPhotoWrap)
    expect(clean(result)).toBe(true)
    expect(forgiven(result)).toEqual([['md-photo-wrap', 2]])
  })

  it('should not accept a paragraph with content, or one in a figure with no photo', () => {
    expect(clean(bodies(figure(''), figure('<p>dropped</p>'), mdPhotoWrap))).toBe(false)
    expect(clean(bodies(figure(''), figure('<p><a>x</a></p>'), mdPhotoWrap))).toBe(false)
    expect(
      clean(bodies('<figure>f</figure>', '<figure>f<p></p></figure>', mdPhotoWrap))
    ).toBe(false)
  })
})

describe('attr-escaping', () => {
  const { attrEscaping } = CLASSES
  const ours = '<img alt="A glass &quot;All in All,&quot; floor-to-ceiling work">'

  it('should accept a value cut at a raw quote and the words after it as junk', () => {
    const result = bodies(
      ours,
      '<img alt="A glass "All in All," floorToCeiling work">',
      attrEscaping
    )
    expect(clean(result)).toBe(true)
    expect(forgiven(result)).toEqual([['attr-escaping', 1]])
  })

  it('should not accept a junk attribute that is no word of what was cut off', () => {
    const result = bodies(
      ours,
      '<img alt="A glass "All in All," onload work">',
      attrEscaping
    )
    expect(clean(result)).toBe(false)
  })

  it('should not accept junk on an element whose value was not cut', () => {
    const result = bodies('<img alt="A glass">', '<img alt="A glass" all in>', attrEscaping)
    expect(clean(result)).toBe(false)
  })

  it('should not accept a value cut anywhere but at the quote', () => {
    const result = bodies(ours, '<img alt="A gl">', attrEscaping)
    expect(clean(result)).toBe(false)
  })

  it('should not accept words ours has after the quote that theirs lost', () => {
    const appended = ours.replace('work">', 'work nothing here is real">')
    const result = bodies(
      appended,
      '<img alt="A glass "All in All," floorToCeiling work">',
      attrEscaping
    )
    expect(clean(result)).toBe(false)
  })

  it('should not accept a junk attribute with a value', () => {
    const result = bodies(
      ours,
      '<img alt="A glass "All in=x All," floorToCeiling work">',
      attrEscaping
    )
    expect(clean(result)).toBe(false)
  })

  it('should not accept a word naming an attribute ours has, set to another value', () => {
    const result = bodies(
      ours.replace('<img ', '<img in="a" '),
      '<img alt="A glass "All in All," floorToCeiling work" in="b">',
      attrEscaping
    )
    expect(clean(result)).toBe(false)
  })

  it('should accept a word the parser dropped for naming an attribute already there', () => {
    const result = bodies(
      '<img src="x.jpg" alt="A &quot;big&quot; src here">',
      '<img src="x.jpg" alt="A "big" src here">',
      attrEscaping
    )
    expect(clean(result)).toBe(true)
  })
})

describe('footnote-markup', () => {
  const { footnoteMarkup } = CLASSES

  /** A post with two footnote references, in comrak's markup. */
  const comrak = ({
    refs = ['except', 'scope'],
    numbers = ['1', '2'],
    prose = ['Except.', 'Scope.'],
  } = {}) =>
    `<p>A<sup class="footnote-ref"><a href="#fn-${refs[0]}" id="fnref-except" data-footnote-ref>${numbers[0]}</a></sup>` +
    ` b<sup class="footnote-ref"><a href="#fn-${refs[1]}" id="fnref-scope" data-footnote-ref>${numbers[1]}</a></sup></p>` +
    '<section class="footnotes" data-footnotes><ol>' +
    `<li id="fn-except"><p>${prose[0]} <a href="#fnref-except" class="footnote-backref" data-footnote-backref data-footnote-backref-idx="1" aria-label="Back to reference 1">↩</a></p></li>` +
    `<li id="fn-scope"><p>${prose[1]} <a href="#fnref-scope" class="footnote-backref" data-footnote-backref data-footnote-backref-idx="2" aria-label="Back to reference 2">↩</a></p></li>` +
    '</ol></section>'

  /** The same post as markdown-it-footnote writes it. */
  const markdownIt = ({ numbers = ['1', '2'] } = {}) =>
    `<p>A<sup class="footnote-ref"><a href="#fn1" id="fnref1">[${numbers[0]}]</a></sup>` +
    ` b<sup class="footnote-ref"><a href="#fn2" id="fnref2">[${numbers[1]}]</a></sup></p>` +
    '<section class="footnotes section-separator"><ol class="footnotes-list">' +
    '<li id="fn1" class="footnote-item"><p>Except. <a href="#fnref1" class="footnote-backref">↩︎</a></p></li>' +
    '<li id="fn2" class="footnote-item"><p>Scope. <a href="#fnref2" class="footnote-backref">↩︎</a></p></li>' +
    '</ol></section>'

  it('should accept the two generators’ markup for the same notes', () => {
    const result = bodies(comrak(), markdownIt(), footnoteMarkup)
    expect(result.differences).toEqual([])
    // Two refs and their numbers, the section, the list, two notes, two backrefs and
    // their arrows.
    expect(forgiven(result)).toEqual([['footnote-markup', 12]])
  })

  it('should not accept a reference that points at another note', () => {
    const result = bodies(
      comrak({ refs: ['scope', 'except'] }),
      markdownIt(),
      footnoteMarkup
    )
    expect(clean(result)).toBe(false)
  })

  it('should not accept references numbered other than their notes, though both agree', () => {
    const result = bodies(
      comrak({ numbers: ['2', '1'] }),
      markdownIt({ numbers: ['2', '1'] }),
      footnoteMarkup
    )
    expect(clean(result)).toBe(false)
  })

  it('should not accept a note whose prose differs', () => {
    const result = bodies(
      comrak({ prose: ['Except.', 'Out of scope.'] }),
      markdownIt(),
      footnoteMarkup
    )
    expect(result.differences.map((d) => d.path)).toEqual([
      'html > body[0] > section[0] > ol[0] > li[1] > p[0] > child 0',
    ])
  })

  it('should not accept footnote-shaped markup outside whole footnotes', () => {
    const result = bodies(
      '<sup class="footnote-ref"><a href="#fn-x" id="fnref-x">1</a></sup>',
      '<sup class="footnote-ref"><a href="#fn1" id="fnref1">[1]</a></sup>',
      footnoteMarkup
    )
    expect(clean(result)).toBe(false)
  })

  it('should not accept theirs’ references paired with ours’ in another order', () => {
    const crossed = markdownIt()
      .replace('<a href="#fn1" id="fnref1">[1]</a>', '<a href="#fn2" id="fnref2">[1]</a>')
      .replace('<a href="#fn2" id="fnref2">[2]</a>', '<a href="#fn1" id="fnref1">[2]</a>')
    expect(clean(bodies(comrak(), crossed, footnoteMarkup))).toBe(false)
  })

  it('should not accept a backref numbered other than its note', () => {
    const misnumbered = comrak().replace(
      'data-footnote-backref-idx="1"',
      'data-footnote-backref-idx="2"'
    )
    expect(clean(bodies(misnumbered, markdownIt(), footnoteMarkup))).toBe(false)
  })
})

describe('reading-time', () => {
  const { readingTime } = CLASSES
  const chip = (text: string, icon = 'scroll-solid') =>
    `<article-header><data-chip><svg><use href="#svg-${icon}"></use></svg>${text}</data-chip></article-header>`

  it('should accept a reading time one minute off theirs', () => {
    const result = bodies(chip('5 min read'), chip('6 min read'), readingTime)
    expect(clean(result)).toBe(true)
    expect(forgiven(result)).toEqual([['reading-time', 1]])
  })

  it('should not accept two minutes off, another chip, or a chip outside the header', () => {
    expect(clean(bodies(chip('4 min read'), chip('6 min read'), readingTime))).toBe(false)
    expect(
      clean(bodies(chip('5 min read', 'clock'), chip('6 min read', 'clock'), readingTime))
    ).toBe(false)
    const bare = (text: string) =>
      `<data-chip><svg><use href="#svg-scroll-solid"></use></svg>${text}</data-chip>`
    expect(clean(bodies(bare('5 min read'), bare('6 min read'), readingTime))).toBe(false)
  })

  it('should not accept ours a minute over theirs', () => {
    expect(clean(bodies(chip('7 min read'), chip('6 min read'), readingTime))).toBe(false)
  })
})

describe('svg-desc-counter', () => {
  const { svgDescCounter } = CLASSES
  const icon = (label: number, desc = label, name = 'newspaper-solid') =>
    `<svg aria-labelledby="symbol-${name}-desc-${label}"><desc id="symbol-${name}-desc-${desc}">d</desc></svg>`

  it('should accept another counter for the same icon', () => {
    const result = bodies(icon(1), icon(4), svgDescCounter)
    expect(clean(result)).toBe(true)
    expect(forgiven(result)).toEqual([['svg-desc-counter', 2]])
  })

  it('should not accept another icon', () => {
    const result = bodies(icon(1), icon(4, 4, 'bell-solid'), svgDescCounter)
    expect(clean(result)).toBe(false)
  })

  it('should not accept an svg that names a desc other than its own', () => {
    expect(clean(bodies(icon(1), icon(4, 5), svgDescCounter))).toBe(false)
    expect(clean(bodies(icon(1, 2), icon(4), svgDescCounter))).toBe(false)
  })

  it('should accept the base-36 counter eleventy-plugin-svg-sprite writes past 9', () => {
    const lettered =
      '<svg aria-labelledby="symbol-newspaper-solid-desc-g"><desc id="symbol-newspaper-solid-desc-g">d</desc></svg>'
    expect(clean(bodies(icon(1), lettered, svgDescCounter))).toBe(true)
  })

  it('should not accept a counter another icon on the page also carries', () => {
    const result = bodies(`${icon(1)}${icon(1)}`, `${icon(4)}${icon(5)}`, svgDescCounter)
    expect(clean(result)).toBe(false)
  })
})

describe('recommended-set', () => {
  const DATES: Record<string, string> = {
    '/feed/lima-agent-isolation/': '2026-06-19T15:28:00-07:00',
    '/feed/better-software-with-ai/': '2026-04-04T10:30:00-07:00',
    '/feed/the-social-contract/': '2025-04-26T11:12:00-07:00',
    '/feed/workout-exporter/': '2025-03-15T23:10:00-07:00',
    '/feed/write-to-your-rep/': '2025-02-09T14:35:00-07:00',
    '/feed/new-york-2024/': '2024-12-27T23:05:00-07:00',
    '/feed/the-rebound/': '2024-11-24T11:35:00-07:00',
    '/links/2026/07/04/usa/': '2026-07-04T16:40:00-07:00',
    '/tils/2026/05/01/x/': '2026-05-01T10:00:00-07:00',
    '/links/2026/04/01/y/': '2026-04-01T10:00:00-07:00',
    '/tils/2025/01/01/z/': '2025-01-01T10:00:00-07:00',
  }
  const [LAI, BSWA, TSC, WE, WTYR, NY, TR] = Object.keys(DATES)

  interface CardOptions {
    counter?: string
    title?: string
    minutes?: string
    li?: string
  }

  /** A card for `url` as article-card writes it, its icon's desc numbered `counter`. */
  const card = (
    url: string,
    { counter = '0', title = url, minutes = '3', li = '' }: CardOptions = {}
  ) =>
    `<li${li}><article-card><article><a href="${url}"><h1>${title}</h1>` +
    `<svg aria-labelledby="symbol-clock-desc-${counter}"><desc id="symbol-clock-desc-${counter}">d</desc></svg>` +
    `<time datetime="${DATES[url]}">${DATES[url]}</time> ${minutes} min read</a></article></article-card></li>`

  /** The footer's recommendations, as the article layout writes them. */
  const footer = (cards: string[], ul = '') =>
    '<footer><section><h2>You Might Enjoy…</h2>' +
    `<article-list><ul${ul}>${cards.join('')}</ul></article-list></section></footer>`

  /** Eleventy's feed index, listing every article newest first, its counters base 36. */
  const index = (urls: string[]) =>
    renderedPage(
      '<!doctype html><html><body><main><article-list><ul>' +
        urls.map((url, n) => card(url, { counter: (n + 10).toString(36) })).join('') +
        '</ul></article-list></main></body></html>'
    )
  const FEED = feedCards(index(Object.keys(DATES)))
  const POST = { url: TR, feed: FEED, css: NO_CSS }

  /** Ours' five cards, each numbered as one page counts them. */
  const ours = (
    urls = [LAI, BSWA, TSC, WE, WTYR],
    options: Record<string, CardOptions> = {}
  ) => urls.map((url, n) => card(url, { counter: String(n), ...options[url] }))

  const theirs = footer([
    card('/links/2026/07/04/usa/', { counter: '0' }),
    card(LAI, { counter: '1' }),
    card('/tils/2026/05/01/x/', { counter: '2' }),
    card(BSWA, { counter: '3' }),
    card('/links/2026/04/01/y/', { counter: '4' }),
  ])

  const recommended = (list: string, post = POST) =>
    bodies(list, theirs, recommendedSet(post))
  const notes = (result: Comparison) => result.differences.map((d) => d.note)
  const paths = (result: Comparison) =>
    result.differences.map((d) =>
      d.path.replace('html > body[0] > footer[0] > section[0] > ', '')
    )

  it('should read every feed post’s card off the feed index, and nothing else', () => {
    expect(FEED.map(({ href }) => href)).toEqual([LAI, BSWA, TSC, WE, WTYR, NY, TR])
    expect(FEED[0].published).toBe(Date.parse(DATES[LAI]))
    expect(feedCards(renderedPage('<p>no list</p>'))).toEqual([])
  })

  it('should accept the newest feed posts where theirs lists links and TILs among them', () => {
    const result = recommended(footer(ours()))
    expect(result.differences).toEqual([])
    // Three of ours theirs lacks and three of theirs ours lacks; every card's icon counter.
    expect(forgiven(result)).toEqual([
      ['svg-desc-counter', 10],
      ['recommended-set', 6],
    ])
  })

  it('should compare a card both sides list against theirs', () => {
    const result = recommended(footer(ours(undefined, { [LAI]: { title: 'Another' } })))
    expect(paths(result)).toEqual([
      `article-list[0] > card ${LAI} > article[0] > a[0] > h1[0] > child 0`,
    ])
  })

  it('should compare a card only ours lists against its card on the feed index', () => {
    const retitled = recommended(footer(ours(undefined, { [WTYR]: { title: 'Another' } })))
    expect(paths(retitled)).toEqual([
      `article-list[0] > card ${WTYR} > article[0] > a[0] > h1[0] > child 0`,
    ])
    const slower = recommended(footer(ours(undefined, { [WTYR]: { minutes: '4' } })))
    expect(paths(slower)).toEqual([
      `article-list[0] > card ${WTYR} > article[0] > a[0] > child 3`,
    ])
  })

  it('should compare the list’s and each item’s attributes', () => {
    expect(notes(recommended(footer(ours(), ' class="oops"')))).toEqual([
      'attributes differ: class',
    ])
    const item = recommended(footer(ours(undefined, { [WE]: { li: ' class="oops"' } })))
    expect(paths(item)).toEqual([`article-list[0] > li ${WE}`])
  })

  it('should refuse text standing in the list or an item', () => {
    const inList = footer(ours()).replace('<ul>', '<ul>stray')
    expect(notes(recommended(inList))).toEqual([
      'recommended-set: text stands in the card list',
    ])
    const inItem = footer(ours()).replace('<li>', '<li>stray')
    expect(notes(recommended(inItem))).toEqual([
      'recommended-set: text stands in the card list',
    ])
  })

  it('should refuse a selection other than the newest five feed posts but the page', () => {
    const newest = `the newest are ${[LAI, BSWA, TSC, WE, WTYR].join(', ')}`
    const swapped = recommended(footer(ours([LAI, BSWA, TSC, WE, NY])))
    expect(notes(swapped)).toEqual([
      `recommended-set: ours lists ${[LAI, BSWA, TSC, WE, NY].join(', ')}; ${newest}`,
    ])
    expect(swapped.forgiven.has('recommended-set')).toBe(false)
    const self = recommended(footer(ours([LAI, BSWA, TSC, WE, TR])))
    expect(notes(self)[0]).toMatch(/^recommended-set: ours lists .*the-rebound/)
    const misordered = recommended(footer(ours([LAI, BSWA, WE, TSC, WTYR])))
    expect(notes(misordered)[0]).toMatch(/^recommended-set: ours lists /)
    const short = recommended(footer(ours([LAI, BSWA, TSC, WE])))
    expect(notes(short)[0]).toMatch(/^recommended-set: ours lists /)
  })

  it('should list min(5, posts − 1), counting the posts on the feed index', () => {
    const three = { url: TSC, feed: feedCards(index([LAI, BSWA, TSC])), css: NO_CSS }
    const twoCards = footer([card(LAI, { counter: '0' }), card(BSWA, { counter: '1' })])
    const result = bodies(
      twoCards,
      footer([card(LAI, { counter: '1' })]),
      recommendedSet(three)
    )
    expect(result.differences).toEqual([])
    expect(forgiven(result)).toEqual([
      ['svg-desc-counter', 4],
      ['recommended-set', 1],
    ])
  })

  it('should refuse theirs’ feed cards anywhere but ours’ first', () => {
    const late = footer([card(BSWA, { counter: '0' }), card(LAI, { counter: '1' })])
    const result = recommended(footer(ours()), POST)
    expect(result.differences).toEqual([])
    const reordered = bodies(footer(ours()), late, recommendedSet(POST))
    expect(notes(reordered)).toEqual([
      "recommended-set: theirs' feed cards are not ours' first, in order",
    ])
  })

  it('should refuse a card it has nothing to compare with', () => {
    const tilled = recommended(footer(ours([LAI, BSWA, TSC, WE, '/tils/2025/01/01/z/'])))
    expect(notes(tilled)).toEqual([
      expect.stringMatching(/; no card to compare \/tils\/2025\/01\/01\/z\/ with$/),
    ])
  })

  it('should still compare every card when it refuses the selection', () => {
    const result = recommended(
      footer(ours([LAI, BSWA, TSC, WE, NY], { [LAI]: { title: 'X' } }))
    )
    expect(notes(result)).toEqual([
      expect.stringMatching(/^recommended-set: ours lists /),
      undefined,
    ])
    expect(paths(result)[1]).toBe(
      `article-list[0] > card ${LAI} > article[0] > a[0] > h1[0] > child 0`
    )
    expect(result.forgiven.get('svg-desc-counter')).toBe(10)
  })

  it('should leave a list that is not the recommendations to the comparison', () => {
    const elsewhere = (cards: string[]) =>
      `<section><h2>Elsewhere</h2><article-list><ul>${cards.join('')}</ul></article-list></section>`
    const result = bodies(
      elsewhere(ours()),
      elsewhere(ours().slice(1)),
      recommendedSet(POST)
    )
    expect(clean(result)).toBe(false)
    expect(result.forgiven.size).toBe(0)
  })

  it('should leave a list shaped otherwise to the comparison', () => {
    const doubled = footer(ours()).replace(
      '</article-card></li>',
      '</article-card><p>x</p></li>'
    )
    const result = recommended(doubled)
    expect(clean(result)).toBe(false)
    expect(result.forgiven.has('recommended-set')).toBe(false)
  })
})

describe('forgiveness()', () => {
  it('should consult every class but the card-only one, recommended-set last', () => {
    const { classes } = forgiveness({ url: '/feed/x/', feed: [], css: NO_CSS })
    expect(classes.map((cls) => cls.name)).toEqual([
      'scoped-class',
      'css-bundle',
      'unbuilt-scripts',
      'webc-attr-leak',
      'datetime-text',
      'utc-revision-display',
      'generator',
      'heading-id',
      'md-photo-wrap',
      'attr-escaping',
      'footnote-markup',
      'reading-time',
      'recommended-set',
    ])
  })
})
