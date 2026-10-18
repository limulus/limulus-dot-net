import { readFile } from 'node:fs/promises'
import { describe, expect, it } from 'vitest'

import {
  MAPBOX_GL_TARGET,
  mapboxGlStyles,
  readMapboxGl,
  readStylesheets,
  siteStyles,
  TARGET,
} from './lemmon-css.ts'

describe('siteStyles', () => {
  it('should define siteStyles() with one lem-style per stylesheet, in order', () => {
    const text = siteStyles([
      { name: 'a', text: 'a { color: red; }\n' },
      { name: 'b', text: 'b { color: blue; }\n' },
    ])
    expect(text).toBe(
      [
        '<lem-fn siteStyles()>',
        '  <lem-style>',
        '    a { color: red; }',
        '  </lem-style>',
        '  <lem-style>',
        '    b { color: blue; }',
        '  </lem-style>',
        '</lem-fn>',
        '',
      ].join('\n')
    )
  })

  it('should trim each stylesheet and indent every line but a blank one', () => {
    const text = siteStyles([
      { name: 'a', text: '\n\n/* a */\n\na {\n  color: red;\n}\n\n' },
    ])
    expect(text.split('\n').slice(1, -2)).toEqual([
      '  <lem-style>',
      '    /* a */',
      '',
      '    a {',
      '      color: red;',
      '    }',
      '  </lem-style>',
    ])
  })

  it('should refuse a stylesheet holding a "<", which could open a lem tag', () => {
    const comment = { name: 'a', text: '\na { color: red; }\n/* </lem-style> */\n' }
    expect(() => siteStyles([comment])).toThrow('a.css: line 3 holds a "<"')
    const query = { name: 'b', text: '@media (width < 600px) {\n  a { color: red; }\n}\n' }
    expect(() => siteStyles([query])).toThrow('b.css: line 1 holds a "<"')
  })

  it('should refuse an empty stylesheet', () => {
    expect(() => siteStyles([{ name: 'a', text: ' \n  \n' }])).toThrow('a.css is empty')
  })
})

describe('mapboxGlStyles', () => {
  it('should define mapboxGlStyles() with one lem-style holding the stylesheet', () => {
    expect(mapboxGlStyles({ name: 'mapbox-gl', text: '.a{color:red}\n' })).toBe(
      [
        '<lem-fn mapboxGlStyles()>',
        '  <lem-style>',
        '    .a{color:red}',
        '  </lem-style>',
        '</lem-fn>',
        '',
      ].join('\n')
    )
  })

  it('should refuse a stylesheet holding a "<", as siteStyles does', () => {
    expect(() => mapboxGlStyles({ name: 'mapbox-gl', text: '/* <lem- */' })).toThrow(
      'mapbox-gl.css: line 1 holds a "<"'
    )
  })
})

describe('www/_lemmon/site-styles.lem', () => {
  it('should be what `npm run lemmon:css` derives from www/_includes/css/', async () => {
    const expected = siteStyles(await readStylesheets())
    expect(await readFile(TARGET, 'utf8')).toBe(expected)
  })
})

describe('www/_lemmon/mapbox-gl.lem', () => {
  it('should be what `npm run lemmon:css` derives from mapbox-gl.css', async () => {
    const expected = mapboxGlStyles(await readMapboxGl())
    expect(await readFile(MAPBOX_GL_TARGET, 'utf8')).toBe(expected)
  })
})
