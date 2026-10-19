// What `npm run parity` holds each dist to as a whole: every file a build wrote falls in
// exactly one category, by the same predicate that chooses the files its comparison
// reads — pages and XML through the classes, CSS bundles through the pages that link
// them, script and passthrough files byte for byte. A file no category takes, or more
// than one, fails the run, named; a file only one build wrote is then reported wherever
// it stands, by its category's comparison.

import { isPage } from './check.ts'
import { isBundle } from './classes.ts'
import { filesWhere } from './files.ts'
import { isScriptFile } from './scripts.ts'
import { isXml } from './xml.ts'

/** The categories, in the order they are reported. */
export const CATEGORIES = ['page', 'xml', 'bundle', 'script', 'passthrough'] as const

/** What a file a build wrote is, and so how parity compares it. */
export type Category = (typeof CATEGORIES)[number]

/** What placing a file needs beside its url. */
export interface Placing {
  /** The build that wrote it, whose CSS bundles stand apart from the other's. */
  side: 'ours' | 'theirs'
  /** The entry points esbuild bundles, as entriesIn() names them. */
  entries: ReadonlySet<string>
  /** The url of every file in the input directory, `www/`. */
  input: ReadonlySet<string>
}

/**
 * Whether the file at `url` is passthrough: a copy of the input's file at the same
 * path, whichever build's glob copied it.
 */
export const isPassthrough = (url: string, input: ReadonlySet<string>): boolean =>
  input.has(url)

/** Every passthrough file under `dist`, keyed by its url, read as bytes. */
export const passthroughIn = (
  dist: string,
  input: ReadonlySet<string>
): Promise<Map<string, Buffer>> => filesWhere(dist, (url) => isPassthrough(url, input))

/** Each category's rule: the predicate its comparison reads its files by. */
const RULES: Record<Category, (url: string, at: Placing) => boolean> = {
  page: isPage,
  xml: isXml,
  bundle: (url, { side }) => isBundle(url, side),
  script: (url, { entries }) => isScriptFile(url, entries),
  passthrough: (url, { input }) => isPassthrough(url, input),
}

/** Every category whose rule takes the file at `url`: one, where it is placed. */
export const categoriesOf = (url: string, at: Placing): Category[] =>
  CATEGORIES.filter((category) => RULES[category](url, at))

/** Every file a build wrote, placed. */
export interface Inventory {
  /** How many files the build wrote. */
  files: number
  /** The url of each file one category alone takes, by its category, sorted. */
  placed: Record<Category, string[]>
  /** The url of each file no category takes. */
  unplaced: string[]
  /** Each file more than one category takes, with them. */
  ambiguous: { url: string; categories: Category[] }[]
}

/** Places each of `urls`, every file a build wrote, by the categories' rules. */
export function inventoryOf(urls: string[], at: Placing): Inventory {
  const inventory: Inventory = {
    files: urls.length,
    placed: { page: [], xml: [], bundle: [], script: [], passthrough: [] },
    unplaced: [],
    ambiguous: [],
  }
  for (const url of [...urls].sort()) {
    const categories = categoriesOf(url, at)
    const [only] = categories
    if (only === undefined) inventory.unplaced.push(url)
    else if (categories.length > 1) inventory.ambiguous.push({ url, categories })
    else inventory.placed[only].push(url)
  }
  return inventory
}

/** Whether a build wrote a file that is in no category, or in more than one. */
export const inventoryFailed = ({ unplaced, ambiguous }: Inventory): boolean =>
  unplaced.length + ambiguous.length > 0

/** The two builds' inventories as printed: a verdict, each side's counts, each misfit. */
export function inventoryLines(
  inventories: { ours: Inventory; theirs: Inventory },
  sides: { ours: string; theirs: string }
): string[] {
  const misfits = (['ours', 'theirs'] as const).flatMap((side) => [
    ...inventories[side].unplaced.map((url) => `  ${sides[side]}${url}: in no category`),
    ...inventories[side].ambiguous.map(
      ({ url, categories }) =>
        `  ${sides[side]}${url}: in ${categories.length} categories, ` +
        categories.join(' and ')
    ),
  ])
  const verdict =
    inventoryFailed(inventories.ours) || inventoryFailed(inventories.theirs)
      ? `FAIL, ${misfits.length} in no category or in several`
      : 'ok, each in one category'
  const counts = (side: 'ours' | 'theirs'): string => {
    const { files, placed } = inventories[side]
    const each = CATEGORIES.map((category) => `${placed[category].length} ${category}`)
    return `  ${sides[side]}, ${files} files: ${each.join(', ')}`
  }
  return [`files: ${verdict}`, counts('ours'), counts('theirs'), ...misfits]
}
