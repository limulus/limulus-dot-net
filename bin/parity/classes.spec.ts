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
  feedForgiveness,
  firstDifference,
  lastDifference,
  normalized,
  forgiveness,
  isBundle,
  renamed,
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
const NO_CSS: Bundles = {
  ours: new Map(),
  theirs: new Map(),
  globals: '',
  linked: new Set(),
}

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

  it('should accept the photo page’s hash on its article and inside it', () => {
    const result = bodies(
      '<article class="photoPage"><nav><ul><li>x</li></ul></nav></article>',
      '<article class="w3ey9fgef"><nav class="w3ey9fgef"><ul class="w3ey9fgef">' +
        '<li class="w3ey9fgef">x</li></ul></nav></article>',
      scopedClass
    )
    expect(clean(result)).toBe(true)
    expect(forgiven(result)).toEqual([['scoped-class', 4]])
  })

  it('should not accept the photo page’s hash outside its article', () => {
    const result = bodies(
      '<main><p>x</p><article class="photoPage">a</article></main>',
      '<main><p class="w3ey9fgef">x</p><article class="w3ey9fgef">a</article></main>',
      scopedClass
    )
    expect(clean(result)).toBe(false)
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

describe('page-scoped-sprite', () => {
  const { pageScopedSprite, scopedClass } = CLASSES
  const STYLE = 'width: 0; height: 0; position: absolute; overflow: hidden'
  const HASH = ' class="w3ey9fgef"'

  /** A sprite in `wrapper`, each element carrying `attrs`. */
  const sprite = (attrs: string, wrapper = `div style="${STYLE}"`) =>
    `<${wrapper}${attrs}><svg${attrs}><symbol id="svg-camera"${attrs}>` +
    `<path d="M0 0h1v1H0z"${attrs}></path></symbol></svg></${wrapper.split(' ')[0]}>`

  /** A page's main: a sprite carrying `attrs`, then an article of class `article`. */
  const main = (attrs: string, article: string, wrapper?: string) =>
    `<main>${sprite(attrs, wrapper)}<article class="${article}">Split</article></main>`

  it('should accept the photo page’s hash on its sprite and all the sprite holds', () => {
    const result = bodies(
      main('', 'photoPage').replace('Split', '<h1>Split</h1>'),
      main(HASH, 'w3ey9fgef').replace('Split', `<h1${HASH}>Split</h1>`),
      scopedClass,
      pageScopedSprite
    )
    expect(clean(result)).toBe(true)
    expect(forgiven(result)).toEqual([
      ['page-scoped-sprite', 4],
      ['scoped-class', 2],
    ])
  })

  it('should not accept the hash on an element that is not a sprite’s wrapper', () => {
    for (const wrapper of ['div style="position: absolute"', `span style="${STYLE}"`]) {
      const result = bodies(
        main('', 'photoPage', wrapper),
        main(HASH, 'w3ey9fgef', wrapper),
        scopedClass,
        pageScopedSprite
      )
      expect(clean(result)).toBe(false)
    }
  })

  it('should not accept the hash where main holds no photo page on either side', () => {
    for (const article of ['photoPage', 'w3ey9fgef', 'article']) {
      const result = bodies(main('', article), main(HASH, article), pageScopedSprite)
      expect(clean(result)).toBe(false)
    }
  })

  it('should not accept a sprite outside main', () => {
    const page = (attrs: string, article: string) =>
      `<section>${sprite(attrs)}<article class="${article}">a</article></section>`
    const result = bodies(
      page('', 'photoPage'),
      page(HASH, 'w3ey9fgef'),
      scopedClass,
      pageScopedSprite
    )
    expect(clean(result)).toBe(false)
  })

  it('should not accept another hash, another class beside it, or a class in ours', () => {
    for (const [ours, theirs] of [
      ['', ' class="wb7dbjyrb"'],
      ['', ' class="w3ey9fgef hidden"'],
      [' class="hidden"', ' class="w3ey9fgef"'],
    ]) {
      const result = bodies(
        main(ours, 'photoPage'),
        main(theirs, 'w3ey9fgef'),
        scopedClass,
        pageScopedSprite
      )
      expect(clean(result)).toBe(false)
    }
  })
})

describe('isBundle()', () => {
  it('should take each side’s bundles in its own directory alone', () => {
    expect(isBundle('/assets/immutable/bundle/8HhNww8jAp.css', 'ours')).toBe(true)
    expect(isBundle('/assets/immutable/11ty/bundle/FmIqE84l-_.css', 'theirs')).toBe(true)
    expect(isBundle('/assets/immutable/11ty/bundle/FmIqE84ljF.css', 'ours')).toBe(false)
    expect(isBundle('/assets/immutable/bundle/8HhNww8jAp.css', 'theirs')).toBe(false)
  })

  it('should not take another name, extension or depth there', () => {
    for (const url of [
      '/assets/immutable/bundle/8HhNww8jA.css',
      '/assets/immutable/bundle/8HhNww8jApp.css',
      '/assets/immutable/bundle/8HhNww8j.p.css',
      '/assets/immutable/bundle/8HhNww8jAp.css.map',
      '/assets/immutable/bundle/8HhNww8jAp.js',
      '/assets/immutable/bundle/x/8HhNww8jAp.css',
      '/x/assets/immutable/bundle/8HhNww8jAp.css',
    ]) {
      expect(isBundle(url, 'ours'), url).toBe(false)
    }
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

  /** Two components' styles as a `.lem` function writes them, and WebC's for them. */
  const DATA_CHIP = '.dataChip {\n  & svg { width: 1.2em; }\n}'
  const CHIP_LIST = '.chipList {\n  & ul { gap: 0.5rem; }\n}'
  const SCOPED_CSS = '.wvormuvo0 svg{width:1.2em}\n.wu_v_wm2n ul{gap:0.5rem}'
  const OURS = ours(`${DATA_CHIP}\n${CHIP_LIST}\n${GLOBALS}`)
  const THEIRS = theirs(`${SCOPED_CSS}\n${GLOBALS}`)

  const link = (href: string, more = '') => `<link rel="stylesheet" href="${href}"${more}>`

  /**
   * A css-bundle that reads the bundles given, ours' and theirs' above by default, and
   * records the links it is offered in `linked`.
   */
  const bundles = (
    files: { ours?: [string, Buffer][]; theirs?: [string, Buffer][] } = {},
    linked = new Set<string>()
  ) =>
    cssBundle({
      ours: new Map(files.ours ?? [OURS]),
      theirs: new Map(files.theirs ?? [THEIRS]),
      globals: GLOBALS,
      linked,
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
    const changed = ours(OURS[1].toString().replace('margin: 0', 'margin: 1'))
    expect(linked(changed[0], THEIRS[0], bundles({ ours: [changed] }))).toEqual({
      clean: false,
      refusals: [
        'css-bundle: ours does not end with the global stylesheets, ' +
          'at offset 3 from the end, ' +
          '"ap: 0.5rem; }\\n}\\nhtml { line-height: 1.15; }\\nbody { margin: 1; }" ' +
          'where expected "html { line-height: 1.15; }\\nbody { margin: 0; }"',
      ],
    })
  })

  it('should refuse ours holding anything after the global stylesheets', () => {
    const after = ours(`${OURS[1].toString()}\n.x{}`)
    expect(linked(after[0], THEIRS[0], bundles({ ours: [after] }))).toEqual({
      clean: false,
      refusals: [
        'css-bundle: ours does not end with the global stylesheets, ' +
          'at offset 1 from the end, ' +
          '"rem; }\\n}\\nhtml { line-height: 1.15; }\\nbody { margin: 0; }\\n.x{}" ' +
          'where expected "html { line-height: 1.15; }\\nbody { margin: 0; }"',
      ],
    })
  })

  it('should refuse theirs where it does not end with the global stylesheets', () => {
    const lacking = theirs(SCOPED_CSS)
    expect(linked(OURS[0], lacking[0], bundles({ theirs: [lacking] }))).toEqual({
      clean: false,
      refusals: [
        'css-bundle: theirs does not end with the global stylesheets, ' +
          'at offset 1 from the end, ' +
          '".wvormuvo0 svg{width:1.2em}\\n.wu_v_wm2n ul{gap:0.5rem}" ' +
          'where expected "html { line-height: 1.15; }\\nbody { margin: 0; }"',
      ],
    })
  })

  /** What css-bundle says of ours' bundle holding `css` before the globals. */
  const judged = (css: string) => {
    const changed = ours(`${css}\n${GLOBALS}`)
    return linked(changed[0], THEIRS[0], bundles({ ours: [changed] }))
  }

  it('should refuse a value changed in a component’s styles', () => {
    expect(judged(`${DATA_CHIP.replace('1.2em', '1.3em')}\n${CHIP_LIST}`)).toEqual({
      clean: false,
      refusals: [
        'css-bundle: the bundles differ once normalized and renamed, at offset 22, ' +
          'ours ".dataChip svg{width:1.3em}.chipList ul{gap:.5rem}' +
          'html{line-height:1.15}body{margin" ' +
          'where theirs ".dataChip svg{width:1.2em}.chipList ul{gap:.5rem}' +
          'html{line-height:1.15}body{margin"',
      ],
    })
  })

  it('should refuse ours lacking a component’s styles theirs has', () => {
    // Ours would end theirs, so a check that took either for a part would pass it.
    expect(judged(CHIP_LIST).refusals).toEqual([
      'css-bundle: the bundles differ once normalized and renamed, at offset 1, ' +
        'ours ".chipList ul{gap:.5rem}html{line-height:1.15}body{margin:0}" ' +
        'where theirs ".dataChip svg{width:1.2em}.chipList ul{gap:.5rem}html{line-he"',
    ])
  })

  it('should refuse ours holding a component’s styles theirs lacks', () => {
    const extra = '.pillButton {\n  & a { color: red; }\n}'
    // Theirs would end ours, so a check that took either for a part would pass it.
    expect(judged(`${extra}\n${DATA_CHIP}\n${CHIP_LIST}`).refusals).toEqual([
      'css-bundle: the bundles differ once normalized and renamed, at offset 1, ' +
        'ours ".pillButton a{color:red}.dataChip svg{width:1.2em}.chipList u" ' +
        'where theirs ".dataChip svg{width:1.2em}.chipList ul{gap:.5rem}html{line-he"',
    ])
  })

  it('should refuse two components’ styles in the other order', () => {
    expect(judged(`${CHIP_LIST}\n${DATA_CHIP}`).refusals).toEqual([
      'css-bundle: the bundles differ once normalized and renamed, at offset 1, ' +
        'ours ".chipList ul{gap:.5rem}.dataChip svg{width:1.2em}html{line-he" ' +
        'where theirs ".dataChip svg{width:1.2em}.chipList ul{gap:.5rem}html{line-he"',
    ])
  })

  it('should refuse a component’s styles under another one’s name', () => {
    const misnamed = DATA_CHIP.replace('.dataChip', '.chipList')
    expect(judged(`${misnamed}\n${CHIP_LIST}`).refusals).toEqual([
      'css-bundle: the bundles differ once normalized and renamed, at offset 1, ' +
        'ours ".chipList svg{width:1.2em}.chipList ul{gap:.5rem}html{line-he" ' +
        'where theirs ".dataChip svg{width:1.2em}.chipList ul{gap:.5rem}html{line-he"',
    ])
  })

  it('should refuse a bundle that does not parse, on either side', () => {
    expect(judged(`}\n${DATA_CHIP}\n${CHIP_LIST}`).refusals).toEqual([
      'css-bundle: ours does not parse: Invalid empty selector at line 1, column 1',
    ])
    const broken = theirs(`}\n${SCOPED_CSS}\n${GLOBALS}`)
    expect(linked(OURS[0], broken[0], bundles({ theirs: [broken] })).refusals).toEqual([
      'css-bundle: theirs, renamed, does not parse: ' +
        'Invalid empty selector at line 1, column 1',
    ])
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

  it('should record both bundles of each link it is offered, refused or not', () => {
    const accepted = new Set<string>()
    expect(linked(OURS[0], THEIRS[0], bundles({}, accepted)).clean).toBe(true)
    expect([...accepted]).toEqual([OURS[0], THEIRS[0]])
    const refused = new Set<string>()
    expect(linked(OURS[0], THEIRS[0], bundles({ ours: [] }, refused)).clean).toBe(false)
    expect([...refused]).toEqual([OURS[0], THEIRS[0]])
  })

  it('should record no bundle of a link it does not take', () => {
    const seen = new Set<string>()
    const cls = bundles({}, seen)
    bodies(`<div>${link(OURS[0])}</div>`, `<div>${link(THEIRS[0])}</div>`, cls)
    const media = ' media="print"'
    heads(link(OURS[0], media), link(THEIRS[0], media), cls)
    const misplaced = theirs(GLOBALS)
    linked(misplaced[0], THEIRS[0], bundles({ ours: [misplaced] }, seen))
    expect([...seen]).toEqual([])
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

describe('renamed()', () => {
  it('should give each WebC hash its function name on class selectors only', () => {
    expect(
      renamed('.wvormuvo0 svg,#wvormuvo0,[class=wvormuvo0],.wo-ywfb1w>header,.x{a:b}')
    ).toBe('.dataChip svg,#wvormuvo0,[class=wvormuvo0],.article>header,.x{a:b}')
  })

  it('should give the photo page’s hash and its components’ their names', () => {
    expect(
      renamed('.w3ey9fgef nav{a:b}.wtw5vxrij section{a:b}.wz5lbi-ak.loading{a:b}')
    ).toBe('.photoPage nav{a:b}.photoMeta section{a:b}.mapBox.loading{a:b}')
  })
})

describe('normalized()', () => {
  it('should flatten nesting and print it minified, as WebC printed calc()', () => {
    const css = [
      '.a {',
      '  & b { margin: calc(var(--p) * -1); }',
      '  @media (min-width: 600px) {',
      '    & c { margin: 0; }',
      '  }',
      '}',
    ].join('\n')
    expect(normalized(css)).toBe(
      '.a b{margin:calc(var(--p)*-1)}@media (width >= 600px){.a c{margin:0}}'
    )
  })

  it('should throw where the CSS does not parse', () => {
    expect(() => normalized('a{}}')).toThrow('Unexpected end of input')
  })
})

describe('firstDifference()', () => {
  it('should show up to 60 characters of each text either side of where they part', () => {
    const a = 'x'.repeat(100) + 'a' + 'y'.repeat(100)
    const b = 'x'.repeat(100) + 'b' + 'y'.repeat(100)
    expect(firstDifference(a, b)).toBe(
      `at offset 100, ours "${'x'.repeat(60)}a${'y'.repeat(59)}" ` +
        `where theirs "${'x'.repeat(60)}b${'y'.repeat(59)}"`
    )
    expect(firstDifference('ab', 'abc')).toBe('at offset 2, ours "ab" where theirs "abc"')
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

  it('should accept a pill-button carrying its link’s title and rel', () => {
    const link = '<a href="/photos/split/" title="Split" rel="prev">Previous</a>'
    const result = bodies(
      `<pill-button>${link}</pill-button>`,
      `<pill-button href="/photos/split/" title="Split" rel="prev">${link}</pill-button>`,
      webcAttrLeak
    )
    expect(clean(result)).toBe(true)
    expect(forgiven(result)).toEqual([['webc-attr-leak', 1]])
  })

  it('should not accept a title or rel its link does not have', () => {
    for (const leaked of [' title="Other"', ' rel="next"']) {
      const link = '<a href="/photos/split/" title="Split" rel="prev">Previous</a>'
      const result = bodies(
        `<pill-button>${link}</pill-button>`,
        `<pill-button${leaked}>${link}</pill-button>`,
        webcAttrLeak
      )
      expect(clean(result)).toBe(false)
    }
    const bare = bodies(
      '<pill-button><a href="/">x</a></pill-button>',
      '<pill-button title="x"><a href="/">x</a></pill-button>',
      webcAttrLeak
    )
    expect(clean(bare)).toBe(false)
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

  describe('on an article-list', () => {
    const card = (author: string) =>
      `<article-card><a><data-chip><picture></picture> ${author} </data-chip>` +
      '<data-chip>November 24, 2024</data-chip></a></article-card>'
    const list = (attrs: string, ...authors: string[]) =>
      `<article-list${attrs}><ul>${authors.map((a) => `<li>${card(a)}</li>`).join('')}</ul></article-list>`
    const eric = ['Eric McCarthy', 'Eric McCarthy']

    it('should accept the author and limit its page filtered it by', () => {
      const result = bodies(
        list('', ...eric),
        list(' author="eric" limit="4"', ...eric),
        webcAttrLeak
      )
      expect(clean(result)).toBe(true)
      expect(forgiven(result)).toEqual([['webc-attr-leak', 1]])
      const full = bodies(list('', ...eric), list(' limit="2"', ...eric), webcAttrLeak)
      expect(clean(full)).toBe(true)
    })

    it('should not accept an author where the cards name more than one', () => {
      const mixed = ['Eric McCarthy', 'Rebecca Reyes']
      expect(
        clean(bodies(list('', ...mixed), list(' author="eric"', ...mixed), webcAttrLeak))
      ).toBe(false)
    })

    it('should not accept an author with no cards, no author chips, or no id', () => {
      expect(clean(bodies(list(''), list(' author="eric"'), webcAttrLeak))).toBe(false)
      const chipless = (attrs: string) =>
        `<article-list${attrs}><ul><li><article-card><a>x</a></article-card></li></ul></article-list>`
      expect(clean(bodies(chipless(''), chipless(' author="eric"'), webcAttrLeak))).toBe(
        false
      )
      expect(
        clean(
          bodies(list('', ...eric), list(' author="Eric McCarthy"', ...eric), webcAttrLeak)
        )
      ).toBe(false)
    })

    it('should not accept a limit fewer than its cards, or one that is no count', () => {
      for (const limit of ['1', '0', 'four', '', '4.5', '1e3', ' 4']) {
        const result = bodies(
          list('', ...eric),
          list(` limit="${limit}"`, ...eric),
          webcAttrLeak
        )
        expect(clean(result)).toBe(false)
      }
    })

    it('should not accept either on another element', () => {
      expect(
        clean(bodies('<ul></ul>', '<ul author="eric" limit="4"></ul>', webcAttrLeak))
      ).toBe(false)
    })
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

  describe('given an id the author wrote, which is no slug of the heading', () => {
    const heading = (id: string, attrs = '') =>
      `<h2 id="${id}"${attrs}>The Demo: <code>&lt;sphere-shadow&gt;</code></h2>`

    it('should accept theirs’ tabindex where both sides give the id alike', () => {
      const result = bodies(heading('demo'), heading('demo', ' tabindex="-1"'), headingId)
      expect(clean(result)).toBe(true)
      expect(forgiven(result)).toEqual([['heading-id', 1]])
    })

    it('should not accept ids that differ, nor the tabindex beside them', () => {
      const ours = heading('demo')
      const theirs = heading('demo-1', ' tabindex="-1"')
      expect(clean(bodies(ours, theirs, headingId))).toBe(false)
      const anyId: Forgiveness = { name: 'any-id', attr: (name) => name === 'id' }
      const result = bodies(ours, theirs, headingId, anyId)
      expect(result.differences.map(({ note }) => note)).toEqual([
        'attributes differ: tabindex',
      ])
    })

    it('should not accept the tabindex beside ids differing only in case', () => {
      const anyId: Forgiveness = { name: 'any-id', attr: (name) => name === 'id' }
      const result = bodies(
        heading('demo'),
        heading('Demo', ' tabindex="-1"'),
        headingId,
        anyId
      )
      expect(result.differences.map(({ note }) => note)).toEqual([
        'attributes differ: tabindex',
      ])
    })

    it('should not accept a tabindex other than theirs’ -1', () => {
      expect(
        clean(bodies(heading('demo'), heading('demo', ' tabindex="0"'), headingId))
      ).toBe(false)
      expect(
        clean(bodies(heading('demo', ' tabindex="-1"'), heading('demo'), headingId))
      ).toBe(false)
    })

    it('should not accept the tabindex on an element that is no heading', () => {
      const result = bodies(
        '<p id="demo">x</p>',
        '<p id="demo" tabindex="-1">x</p>',
        headingId
      )
      expect(clean(result)).toBe(false)
    })

    it('should not accept the tabindex on a heading neither side gives an id', () => {
      const result = bodies(
        '<h2>The Demo</h2>',
        '<h2 tabindex="-1">The Demo</h2>',
        headingId
      )
      expect(clean(result)).toBe(false)
    })
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

describe('md-photo-wrap in a feed', () => {
  const { mdPhotoWrapFeed } = CLASSES
  /** A photo as an entry's content carries it, `inLink` ending its picture. */
  const photo = (inLink: string, tail: string) =>
    '<figure><a href="/photos/x/"><pho-picture><blur-hash>b</blur-hash>' +
    `${inLink}</pho-picture></a><figcaption>c</figcaption>${tail}</figure>`

  it('should accept the empty paragraphs posthtml leaves in a photo’s link and figure', () => {
    const result = bodies(photo('', ''), photo('<p></p>', '<p></p>'), mdPhotoWrapFeed)
    expect(clean(result)).toBe(true)
    expect(forgiven(result)).toEqual([['md-photo-wrap', 2]])
  })

  it('should not accept a paragraph with content in either place', () => {
    expect(clean(bodies(photo('', ''), photo('<p>x</p>', ''), mdPhotoWrapFeed))).toBe(false)
    expect(clean(bodies(photo('', ''), photo('', '<p>x</p>'), mdPhotoWrapFeed))).toBe(false)
  })

  it('should not accept the page’s husk holding a link, which a feed does not have', () => {
    const result = bodies(photo('', ''), photo('', '<p><a></a></p>'), mdPhotoWrapFeed)
    expect(clean(result)).toBe(false)
  })

  it('should not accept an empty paragraph anywhere else in a picture', () => {
    const notLast = photo('', '').replace('<blur-hash>', '<p></p><blur-hash>')
    expect(clean(bodies(photo('', ''), notLast, mdPhotoWrapFeed))).toBe(false)
    const unlinked = (p: string) =>
      `<figure><pho-picture><blur-hash>b</blur-hash>${p}</pho-picture></figure>`
    expect(clean(bodies(unlinked(''), unlinked('<p></p>'), mdPhotoWrapFeed))).toBe(false)
    const outside = (p: string) =>
      `<div><a href="/x/"><pho-picture><blur-hash>b</blur-hash>${p}</pho-picture></a></div>`
    expect(clean(bodies(outside(''), outside('<p></p>'), mdPhotoWrapFeed))).toBe(false)
  })

  it('should not accept an empty paragraph in a figure with no photo', () => {
    const result = bodies(
      '<figure>f</figure>',
      '<figure>f<p></p></figure>',
      mdPhotoWrapFeed
    )
    expect(clean(result)).toBe(false)
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

  it('should accept a reading time one minute off theirs in an article’s card', () => {
    const card = (text: string) =>
      `<article-card><a><data-chip><svg><use href="#svg-scroll-solid"></use></svg>${text}</data-chip></a></article-card>`
    const result = bodies(card('5 min read'), card('6 min read'), readingTime)
    expect(clean(result)).toBe(true)
    expect(forgiven(result)).toEqual([['reading-time', 1]])
    expect(clean(bodies(card('4 min read'), card('6 min read'), readingTime))).toBe(false)
  })
})

describe('svg-desc-counter', () => {
  const { svgDescCounter } = CLASSES
  const icon = (label: number, desc = label, name = 'newspaper-solid') =>
    `<svg aria-labelledby="symbol-${name}-desc-${label}"><desc id="symbol-${name}-desc-${desc}">d</desc></svg>`
  const card = (icons: string) => `<article-card><a>${icons}</a></article-card>`

  it('should accept another counter for the same icon in a card', () => {
    const result = bodies(card(icon(1)), card(icon(4)), svgDescCounter)
    expect(clean(result)).toBe(true)
    expect(forgiven(result)).toEqual([['svg-desc-counter', 2]])
  })

  it('should accept cards numbered in another order, each id once a side', () => {
    const result = bodies(
      card(icon(1)) + card(icon(2)),
      card(icon(2)) + card(icon(1)),
      svgDescCounter
    )
    expect(clean(result)).toBe(true)
    expect(forgiven(result)).toEqual([['svg-desc-counter', 4]])
  })

  it('should not accept another counter outside a card', () => {
    expect(clean(bodies(icon(1), icon(4), svgDescCounter))).toBe(false)
    const header = (icons: string) => `<article-header>${icons}</article-header>`
    expect(clean(bodies(header(icon(1)), header(icon(4)), svgDescCounter))).toBe(false)
  })

  it('should not accept another icon', () => {
    const result = bodies(card(icon(1)), card(icon(4, 4, 'bell-solid')), svgDescCounter)
    expect(clean(result)).toBe(false)
  })

  it('should not accept an svg that names a desc other than its own', () => {
    expect(clean(bodies(card(icon(1)), card(icon(4, 5)), svgDescCounter))).toBe(false)
    expect(clean(bodies(card(icon(1, 2)), card(icon(4)), svgDescCounter))).toBe(false)
  })

  it('should accept the base-36 counter eleventy-plugin-svg-sprite writes past 9', () => {
    const lettered =
      '<svg aria-labelledby="symbol-newspaper-solid-desc-g"><desc id="symbol-newspaper-solid-desc-g">d</desc></svg>'
    expect(clean(bodies(card(icon(1)), card(lettered), svgDescCounter))).toBe(true)
  })

  describe('in the TIL topics’ list', () => {
    const topics = (...labels: number[]) =>
      `<main><chip-list><ul>${labels
        .map(
          (n, i) =>
            `<li><a href="/tils/topic-${i}/"><data-chip>${icon(n, n, 'lightbulb-solid')}</data-chip></a></li>`
        )
        .join('')}</ul></chip-list></main>`

    it('should accept the topics numbered after the cards in ours', () => {
      const result = bodies(topics(2, 3), topics(0, 1), svgDescCounter)
      expect(clean(result)).toBe(true)
      expect(forgiven(result)).toEqual([['svg-desc-counter', 4]])
    })

    it('should not accept another counter in another chip list', () => {
      const header = (html: string) => `<article-header>${html}</article-header>`
      const chips = (n: number) =>
        `<chip-list><ul><li><a href="/tils/git/"><data-chip>${icon(n, n, 'lightbulb-solid')}</data-chip></a></li></ul></chip-list>`
      expect(clean(bodies(header(chips(2)), header(chips(0)), svgDescCounter))).toBe(false)
      const linked = (n: number, href: string) =>
        `<main><chip-list><ul><li><a href="${href}"><data-chip>${icon(n)}</data-chip></a></li></ul></chip-list></main>`
      for (const href of ['/feed/', '/tils/git/reindex/', '/tils/']) {
        expect(clean(bodies(linked(2, href), linked(0, href), svgDescCounter))).toBe(false)
      }
    })
  })

  it('should not accept a counter another icon on the page also carries', () => {
    const result = bodies(
      card(`${icon(1)}${icon(1)}`),
      card(`${icon(4)}${icon(5)}`),
      svgDescCounter
    )
    expect(clean(result)).toBe(false)
  })
})

describe('source-pill', () => {
  const { sourcePill } = CLASSES
  const SOURCE = 'https://github.com/limulus/limulus-dot-net/blob/main/'
  const pill = (href: string, icon = 'code-solid') =>
    `<pill-button><a href="${href}"><svg><use href="#svg-${icon}"></use></svg>Source</a></pill-button>`
  const header = (inner: string) =>
    `<header class="ldnHeader"><section><ul><li>${inner}</li></ul></section></header>`

  it('should accept the page template’s .lem where theirs links the .webc beside it', () => {
    const result = bodies(
      header(pill(`${SOURCE}www/photos/index.lem`)),
      header(pill(`${SOURCE}www/photos/index.webc`)),
      sourcePill
    )
    expect(clean(result)).toBe(true)
    expect(forgiven(result)).toEqual([['source-pill', 1]])
  })

  it('should not accept another path, or another pair of extensions', () => {
    for (const [ours, theirs] of [
      ['www/feed/index.lem', 'www/links/index.webc'],
      ['www/feed/index.md', 'www/feed/index.webc'],
      ['www/feed/index.lem', 'www/feed/index.md'],
      ['_includes/x.lem', '_includes/x.webc'],
    ]) {
      const result = bodies(
        header(pill(`${SOURCE}${ours}`)),
        header(pill(`${SOURCE}${theirs}`)),
        sourcePill
      )
      expect(clean(result)).toBe(false)
    }
    expect(
      clean(
        bodies(
          header(pill('https://example.com/www/feed/index.lem')),
          header(pill('https://example.com/www/feed/index.webc')),
          sourcePill
        )
      )
    ).toBe(false)
  })

  it('should not accept a link that is not the header’s Source pill', () => {
    const [ours, theirs] = [`${SOURCE}www/index.lem`, `${SOURCE}www/index.webc`]
    expect(clean(bodies(pill(ours), pill(theirs), sourcePill))).toBe(false)
    expect(
      clean(
        bodies(
          header(pill(ours, 'bell-solid')),
          header(pill(theirs, 'bell-solid')),
          sourcePill
        )
      )
    ).toBe(false)
    const bare = (href: string) =>
      header(`<a href="${href}"><svg><use href="#svg-code-solid"></use></svg></a>`)
    expect(clean(bodies(bare(ours), bare(theirs), sourcePill))).toBe(false)
  })

  it('should not accept the same pill in another header', () => {
    const plain = (inner: string) =>
      `<header><section><ul><li>${inner}</li></ul></section></header>`
    const result = bodies(
      plain(pill(`${SOURCE}www/index.lem`)),
      plain(pill(`${SOURCE}www/index.webc`)),
      sourcePill
    )
    expect(clean(result)).toBe(false)
  })

  it('should not accept the paths in another attribute', () => {
    const titled = (title: string) =>
      header(
        `<pill-button><a href="/" title="${title}"><svg><use href="#svg-code-solid"></use></svg></a></pill-button>`
      )
    const result = bodies(
      titled(`${SOURCE}www/index.lem`),
      titled(`${SOURCE}www/index.webc`),
      sourcePill
    )
    expect(clean(result)).toBe(false)
  })
})

describe('forgiveness()', () => {
  it('should consult every class, in order', () => {
    const { classes } = forgiveness(NO_CSS)
    expect(classes.map((cls) => cls.name)).toEqual([
      'scoped-class',
      'page-scoped-sprite',
      'css-bundle',
      'webc-attr-leak',
      'svg-desc-counter',
      'datetime-text',
      'utc-revision-display',
      'generator',
      'heading-id',
      'md-photo-wrap',
      'attr-escaping',
      'footnote-markup',
      'reading-time',
      'source-pill',
    ])
  })
})

describe('feedForgiveness()', () => {
  it('should consult a page’s classes, md-photo-wrap in a feed’s shape', () => {
    const page = forgiveness(NO_CSS).classes
    const feed = feedForgiveness(NO_CSS).classes
    expect(feed.map((cls) => cls.name)).toEqual(page.map((cls) => cls.name))
    expect(feed).toContain(CLASSES.mdPhotoWrapFeed)
    expect(feed).not.toContain(CLASSES.mdPhotoWrap)
  })
})
