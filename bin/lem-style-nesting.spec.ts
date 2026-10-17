// A component's `lem-style` nests its rules under `.fnName { … }` (lemmon's D20). A
// nested selector without its `&` — `img {` for `& img {` — is a relative selector, which
// lightningcss accepts and normalizes as if the `&` were there, so css-bundle cannot see
// it missing; but Chrome before 120 and Safari before 17.2 drop such a rule, and D20's
// browser floor reaches below both. So every selector under a wrapper names its parent.

import { readdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const INCLUDES = fileURLToPath(new URL('../www/_includes/', import.meta.url))

/**
 * The selector lines inside the `.fnName { … }` wrapper of each `lem-style` block in
 * `lem`; a block that opens with no wrapper is a plain stylesheet, and is skipped.
 */
function nestedSelectors(lem: string): string[] {
  const selectors: string[] = []
  for (const [, body] of lem.matchAll(/<lem-style>\n([\s\S]*?)\n\s*<\/lem-style>/g)) {
    const lines = body.split('\n')
    const wrapper = /^(\s*)\.[\w-]+ \{$/.exec(lines[0])
    if (wrapper === null) continue
    const end = lines.indexOf(`${wrapper[1]}}`)
    for (const line of lines.slice(1, end).map((l) => l.trim())) {
      if (/[{,]$/.test(line)) selectors.push(line)
    }
  }
  return selectors
}

/** Whether a nested selector line starts with `&`, an at-rule, or a keyframe stop. */
const namesParent = (line: string): boolean => /^(&|@|from\b|to\b|\d+%)/.test(line)

describe('nestedSelectors()', () => {
  const lem = [
    '<lem-fn f()>',
    '  <p>x</p>',
    '  <lem-style>',
    '    .f {',
    '      & a,',
    '      &[open] b {',
    '        color: red;',
    '      }',
    '',
    '      @media (min-width: 600px) {',
    '        img {',
    '          display: block;',
    '        }',
    '      }',
    '    }',
    '',
    '    @keyframes fade {',
    '      from {',
    '        opacity: 1;',
    '      }',
    '    }',
    '  </lem-style>',
    '  <lem-style>',
    '    pho-picture img {',
    '      display: block;',
    '    }',
    '  </lem-style>',
    '</lem-fn>',
  ].join('\n')

  it('should read every selector line under a wrapper, and none outside one', () => {
    expect(nestedSelectors(lem)).toEqual([
      '& a,',
      '&[open] b {',
      '@media (min-width: 600px) {',
      'img {',
    ])
  })

  it('should find the one that does not name its parent', () => {
    expect(nestedSelectors(lem).filter((line) => !namesParent(line))).toEqual(['img {'])
  })
})

describe('www/_includes/**/*.lem', () => {
  it('should nest every scoped selector under its wrapper with `&`', async () => {
    const files = (await readdir(INCLUDES, { recursive: true })).filter((file) =>
      file.endsWith('.lem')
    )
    const selectors = (
      await Promise.all(
        files.map(async (file) =>
          nestedSelectors(await readFile(join(INCLUDES, file), 'utf8')).map((line) => ({
            file,
            line,
          }))
        )
      )
    ).flat()
    expect(selectors.length).toBeGreaterThan(50)
    const bare = selectors.filter(({ line }) => !namesParent(line))
    expect(bare.map(({ file, line }) => `${file}: ${line}`)).toEqual([])
  })
})
