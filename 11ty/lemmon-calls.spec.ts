import { describe, expect, it } from 'vitest'

import { eleventyFormsOfLemmonCalls } from './lemmon-calls.ts'

const WEBC = [
  `{% renderTemplate 'webc' %}`,
  `<article-photo id="middle-falls" placement="right"></article-photo>`,
  `{% endrenderTemplate %}`,
]

describe('eleventyFormsOfLemmonCalls', () => {
  it('should write an articlePhoto call as the WebC block it replaced', () => {
    const markdown =
      'Before.\n\n<lem.articlePhoto(site.photos["middle-falls"], .right)>\n\nAfter.\n'
    expect(eleventyFormsOfLemmonCalls(markdown)).toBe(
      `Before.\n\n${WEBC.join('\n')}\n\nAfter.\n`
    )
  })

  it('should indent each line of the block as the call was indented', () => {
    const markdown = '  <lem.articlePhoto(site.photos["middle-falls"], .right)>  \n'
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
      'should refuse one whose element %j is not a plain tag name',
      (element) => {
        expect(() =>
          eleventyFormsOfLemmonCalls(`<lem.demoWithFallback("${element}")>\n`)
        ).toThrow('no Eleventy form for the lem line <lem.demoWithFallback(')
      }
    )
  })

  it('should translate a photo and a demo in one post', () => {
    const markdown =
      '<lem.articlePhoto(site.photos["middle-falls"], .right)>\n\n' +
      '<lem.demoWithFallback("sphere-shadow-demo")>\n'
    const translated = eleventyFormsOfLemmonCalls(markdown)
    expect(translated).toContain(WEBC.join('\n'))
    expect(translated).toContain('  <sphere-shadow-demo>\n')
  })

  it('should leave markdown without a lem line as it is', () => {
    const markdown = 'A <lem.articlePhoto> mid-line is prose.\n'
    expect(eleventyFormsOfLemmonCalls(markdown)).toBe(markdown)
  })

  it('should refuse a lem line it has no Eleventy form for', () => {
    expect(() => eleventyFormsOfLemmonCalls('<lem.chipList(null, raw(""))>\n')).toThrow(
      'no Eleventy form for the lem line <lem.chipList(null, raw(""))>'
    )
  })

  it('should refuse an indented keyword tag it has no Eleventy form for', () => {
    expect(() =>
      eleventyFormsOfLemmonCalls('   <lem-let photo = site.photos["x"] />\n')
    ).toThrow('no Eleventy form for the lem line <lem-let')
  })

  it('should refuse a lem line inside a code fence, which it does not parse', () => {
    expect(() => eleventyFormsOfLemmonCalls('```\n<lem.page.title>\n```\n')).toThrow(
      'no Eleventy form for the lem line <lem.page.title>'
    )
  })
})
