// Writes the photo database as the Lemmon port loads it: www/_data/photos.json keys each
// photo by its id and keeps an alias → id index beside the records, a mix that no single
// Lemmon type describes. The port's `{string: Photo}` wants the records alone, keyed by
// the alias a post's front matter names, so each alias is resolved here. A photos
// plugin's data hook will do this inside the build instead (∆c4j in the lemmon repo).

import esMain from 'es-main'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

export const SOURCE = fileURLToPath(new URL('../www/_data/photos.json', import.meta.url))
export const TARGET = fileURLToPath(new URL('../www/_lemmon/photos.json', import.meta.url))

type PhotoDb = Record<string, string | { alias: string }>

/**
 * The text of the Lemmon photo file for the text of photos.json: every photo an alias
 * names, keyed by that alias, in the index's order. A record no alias names is left out.
 */
export function lemmonPhotos(source: string): string {
  const db = JSON.parse(source) as PhotoDb
  const byAlias: PhotoDb = {}
  for (const [alias, id] of Object.entries(db)) {
    if (typeof id !== 'string') continue
    const photo = db[id]
    if (typeof photo !== 'object' || photo.alias !== alias) {
      throw new Error(
        `photos.json: the alias ${alias} names ${id}, which is no photo of it`
      )
    }
    byAlias[alias] = photo
  }
  return JSON.stringify(byAlias, null, 2) + '\n'
}

if (esMain(import.meta)) {
  const text = lemmonPhotos(await readFile(SOURCE, 'utf8'))
  await mkdir(dirname(TARGET), { recursive: true })
  await writeFile(TARGET, text)
  console.log(`${TARGET}: ${Object.keys(JSON.parse(text) as object).length} photos`)
}
