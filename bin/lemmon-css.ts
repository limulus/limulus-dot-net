// Writes the stylesheets the Lemmon port collects as copies. base.webc links normalize,
// main and hljs-github, which WebC bundles after every component's styles, each trimmed;
// map-box.webc links mapbox-gl's stylesheet, which WebC bundles before map-box's own
// styles. A `.lem` file cannot read a CSS file (a Lemmon data source is YAML), so the
// port carries a copy of each: www/_lemmon/site-styles.lem defines `siteStyles()`, one
// `lem-style` block per global stylesheet in that order, and www/_lemmon/mapbox-gl.lem
// defines `mapboxGlStyles()`, which map-box.lem calls, each line indented four spaces so
// that a `lem-style` body's trim and dedent (lemmon's D26) give back the file trimmed.

import esMain from 'es-main'
import { readFile, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'

/** The global stylesheets, by name, in the order base.webc links them. */
export const STYLESHEETS = ['normalize', 'main', 'hljs-github'].map((name) => ({
  name,
  path: fileURLToPath(new URL(`../www/_includes/css/${name}.css`, import.meta.url)),
}))

export const TARGET = fileURLToPath(
  new URL('../www/_lemmon/site-styles.lem', import.meta.url)
)

/** mapbox-gl's stylesheet, where map-box.webc links it from. */
export const MAPBOX_GL = {
  name: 'mapbox-gl',
  path: fileURLToPath(
    new URL('../node_modules/mapbox-gl/dist/mapbox-gl.css', import.meta.url)
  ),
}

export const MAPBOX_GL_TARGET = fileURLToPath(
  new URL('../www/_lemmon/mapbox-gl.lem', import.meta.url)
)

/** A stylesheet's name and text. */
export interface Stylesheet {
  name: string
  text: string
}

/** Every global stylesheet's text, in order. */
export async function readStylesheets(): Promise<Stylesheet[]> {
  return Promise.all(
    STYLESHEETS.map(async ({ name, path }) => ({
      name,
      text: await readFile(path, 'utf8'),
    }))
  )
}

/** mapbox-gl's stylesheet's text. */
export async function readMapboxGl(): Promise<Stylesheet> {
  return { name: MAPBOX_GL.name, text: await readFile(MAPBOX_GL.path, 'utf8') }
}

/**
 * The lines of `sheet` trimmed, as its `lem-style` body holds them before the indent.
 *
 * @throws on a `<`, since a `lem-style` body is a template and `<lem.`, `<lem-` or
 *   `</lem-` there (even in a comment) would be a tag; and on an empty stylesheet, whose
 *   block would collect nothing
 */
function linesOf({ name, text }: Stylesheet): string[] {
  const tag = text.split('\n').findIndex((line) => line.includes('<'))
  if (tag !== -1) {
    throw new Error(`${name}.css: line ${tag + 1} holds a "<", which could open a lem tag`)
  }
  const trimmed = text.trim()
  if (trimmed === '') throw new Error(`${name}.css is empty`)
  return trimmed.split('\n')
}

/** A `.lem` file defining `fn()`, one `lem-style` per stylesheet, in the order given. */
export function stylesFunction(fn: string, sheets: Stylesheet[]): string {
  const blocks = sheets.map((sheet) => {
    const body = linesOf(sheet).map((line) => (line === '' ? '' : `    ${line}`))
    return ['  <lem-style>', ...body, '  </lem-style>'].join('\n')
  })
  return [`<lem-fn ${fn}()>`, ...blocks, '</lem-fn>', ''].join('\n')
}

/** The text of site-styles.lem for the global stylesheets, in the order given. */
export const siteStyles = (sheets: Stylesheet[]): string =>
  stylesFunction('siteStyles', sheets)

/** The text of mapbox-gl.lem for mapbox-gl's stylesheet. */
export const mapboxGlStyles = (sheet: Stylesheet): string =>
  stylesFunction('mapboxGlStyles', [sheet])

if (esMain(import.meta)) {
  const sheets = await readStylesheets()
  await writeFile(TARGET, siteStyles(sheets))
  console.log(`${TARGET}: ${sheets.map(({ name }) => `${name}.css`).join(', ')}`)
  const mapboxGl = await readMapboxGl()
  await writeFile(MAPBOX_GL_TARGET, mapboxGlStyles(mapboxGl))
  console.log(`${MAPBOX_GL_TARGET}: ${mapboxGl.name}.css`)
}
