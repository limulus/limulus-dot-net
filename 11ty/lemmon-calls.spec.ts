import { describe, expect, it } from 'vitest'

import { webcForLemmonCalls } from './lemmon-calls.ts'

const WEBC = [
  `{% renderTemplate 'webc' %}`,
  `<article-photo id="middle-falls" placement="right"></article-photo>`,
  `{% endrenderTemplate %}`,
]

describe('webcForLemmonCalls', () => {
  it('should write an articlePhoto call as the WebC block it replaced', () => {
    const markdown =
      'Before.\n\n<lem.articlePhoto(site.photos["middle-falls"], .right)>\n\nAfter.\n'
    expect(webcForLemmonCalls(markdown)).toBe(`Before.\n\n${WEBC.join('\n')}\n\nAfter.\n`)
  })

  it('should indent each line of the block as the call was indented', () => {
    const markdown = '  <lem.articlePhoto(site.photos["middle-falls"], .right)>  \n'
    expect(webcForLemmonCalls(markdown)).toBe(
      `${WEBC.map((line) => `  ${line}`).join('\n')}\n`
    )
  })

  it('should leave markdown without a lem line as it is', () => {
    const markdown = 'A <lem.articlePhoto> mid-line is prose.\n'
    expect(webcForLemmonCalls(markdown)).toBe(markdown)
  })

  it('should refuse a lem line it has no WebC form for', () => {
    expect(() => webcForLemmonCalls('<lem.chipList(null, raw(""))>\n')).toThrow(
      'no WebC form for the lem line <lem.chipList(null, raw(""))>'
    )
  })

  it('should refuse an indented keyword tag it has no WebC form for', () => {
    expect(() => webcForLemmonCalls('   <lem-let photo = site.photos["x"] />\n')).toThrow(
      'no WebC form for the lem line <lem-let'
    )
  })

  it('should refuse a lem line inside a code fence, which it does not parse', () => {
    expect(() => webcForLemmonCalls('```\n<lem.page.title>\n```\n')).toThrow(
      'no WebC form for the lem line <lem.page.title>'
    )
  })
})
