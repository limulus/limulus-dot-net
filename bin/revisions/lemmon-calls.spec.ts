import { describe, expect, it } from 'vitest'

import { eleventyFormsOfLemmonCalls } from './lemmon-calls.ts'

const WEBC = [
  `{% renderTemplate 'webc' %}`,
  `<article-photo id="middle-falls" placement="right"></article-photo>`,
  `{% endrenderTemplate %}`,
]

const PHOTO = '<lem.articlePhoto(site.photos["middle-falls"], .right)>'

/** Lem lines with no Eleventy form, as a post might hold them. */
const UNTRANSLATED: [what: string, markdown: string][] = [
  ['a call', '<lem.chipList(null, raw(""))>\n'],
  ['an indented keyword tag', '   <lem-let photo = site.photos["x"] />\n'],
  ['a line in a code fence', '```\n<lem.page.title>\n```\n'],
  [
    'a demo whose element is not a plain tag name',
    '<lem.demoWithFallback("Pixel Clock")>\n',
  ],
]

describe('eleventyFormsOfLemmonCalls', () => {
  it('should write an articlePhoto call as the WebC block it replaced', () => {
    const markdown = `Before.\n\n${PHOTO}\n\nAfter.\n`
    expect(eleventyFormsOfLemmonCalls(markdown)).toBe(
      `Before.\n\n${WEBC.join('\n')}\n\nAfter.\n`
    )
  })

  it('should indent each line of the block as the call was indented', () => {
    const markdown = `  ${PHOTO}  \n`
    expect(eleventyFormsOfLemmonCalls(markdown)).toBe(
      `${WEBC.map((line) => `  ${line}`).join('\n')}\n`
    )
  })

  describe('given a demoWithFallback call', () => {
    const DEMO = [
      `<div>`,
      `  <pixel-clock-demo>`,
      `    {% include 'dynamic-content-fallback' %}`,
      `  </pixel-clock-demo>`,
      `</div>`,
    ]

    it("should write it as the demo's element around the fallback include", () => {
      const markdown = 'Before.\n\n<lem.demoWithFallback("pixel-clock-demo")>\n\nAfter.\n'
      expect(eleventyFormsOfLemmonCalls(markdown)).toBe(
        `Before.\n\n${DEMO.join('\n')}\n\nAfter.\n`
      )
    })

    it('should indent each line of the block as the call was indented', () => {
      const markdown = '\t<lem.demoWithFallback("pixel-clock-demo")> \n'
      expect(eleventyFormsOfLemmonCalls(markdown)).toBe(
        `${DEMO.map((line) => `\t${line}`).join('\n')}\n`
      )
    })

    it.each(['x\\"><b', 'x><b', 'Pixel Clock', 'pixel-clock-demo '])(
      'should leave one whose element %j is not a plain tag name as written',
      (element) => {
        const markdown = `<lem.demoWithFallback("${element}")>\n`
        expect(eleventyFormsOfLemmonCalls(markdown)).toBe(markdown)
      }
    )
  })

  it('should translate a photo and a demo in one post', () => {
    const markdown = `${PHOTO}\n\n<lem.demoWithFallback("sphere-shadow-demo")>\n`
    const translated = eleventyFormsOfLemmonCalls(markdown)
    expect(translated).toContain(WEBC.join('\n'))
    expect(translated).toContain('  <sphere-shadow-demo>\n')
  })

  it('should leave markdown without a lem line as it is', () => {
    const markdown = 'A <lem.articlePhoto> mid-line is prose.\n'
    expect(eleventyFormsOfLemmonCalls(markdown)).toBe(markdown)
  })

  it.each(UNTRANSLATED)(
    'should leave %s it has no Eleventy form for as written',
    (_, markdown) => {
      expect(eleventyFormsOfLemmonCalls(markdown)).toBe(markdown)
    }
  )

  it('should translate the calls it knows beside a lem line it leaves as written', () => {
    const markdown = `${PHOTO}\n<lem.chipList(null, raw(""))>\n`
    expect(eleventyFormsOfLemmonCalls(markdown)).toBe(
      `${WEBC.join('\n')}\n<lem.chipList(null, raw(""))>\n`
    )
  })
})
