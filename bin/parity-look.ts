// `npm run parity:look`: whether the pages look the same in both builds. Run it after
// `npm run parity`, whose dists it reads as they stand: it builds nothing. It serves
// dist/www and dist/lemmon over HTTP, shoots every page parity compares in the installed
// Google Chrome (headless, rasterizing in software) at 1280 px light, 390 px light and
// 1280 px dark, and compares each pair of full-page screenshots pixel for pixel, writing
// both and their difference to dist/look/<url>/. Any difference fails the run: there is
// no allowance.
//
// So that none is needed, what the pages fetch is pinned, the order it arrives in is
// fixed, what a script draws from a clock or a worker is masked, and what parity forgives
// is evened out. Every request to another host (the photos and the video's poster and
// stream, on pho. and vod.limulus.net) is answered with one fixed PNG. The client scripts
// run on both sides, each build's own bundles, which parity compares byte for byte, in
// one order (Gate): held until the page is parsed, so that each runs against the whole
// document, and the photos held until every blur-hash placeholder is painted. Left to
// race, as on the live site, a placeholder the parser adds after its script has run finds
// no photo inside it and throws, and one painted after its photo has loaded stays behind
// it, showing in the photo's rounded corners, and which happens changes from run to run.
// In this order each placeholder is painted, then cleared by its photo, as the script
// means. What the scripts draw that can still differ between two shots of one build is
// masked, both sides alike, its box still compared (MASKED): what is drawn there is
// checked not by pixels but by `npm run parity`, which compares the scripts byte for
// byte, and by the page errors each tab collects, any of which fails its shot. The photo
// pages' map is kept from loading instead (MAP_BUNDLE): its style and tiles come from a
// host the stand-in answers with a PNG, so its placeholder is what is compared. Each
// page is served neutralized: parsed with parse5, every visible difference a parity
// class forgives undone by a neutralizer named for that class
// (bin/parity/neutralizers.ts), and serialized again, both sides alike. A page is shot
// only where parity's own comparison of it passes, since every match here stands on
// what parity explained.
//
//   npm run parity:look [-- --serve]
//
// --serve serves both dists as built instead, Eleventy's on SERVE_PORTS.theirs and
// Lemmon's on SERVE_PORTS.ours, and prints each page's two URLs to open side by side,
// until interrupted. Nothing is neutralized, held or masked there.

import esMain from 'es-main'
import { readFile, mkdir, rm, writeFile } from 'node:fs/promises'
import { createServer, type Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import { extname, join, normalize, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { Page } from 'playwright-core'
import sharp from 'sharp'

import {
  bundlesIn,
  comparePage,
  failed,
  pageAt,
  pagesIn,
  reportLines,
  rosterOf,
} from './parity/check.ts'
import { EXPECTED } from './parity/expected.ts'
import { neutralize } from './parity/neutralizers.ts'
import { entriesIn, isScriptFile } from './parity/scripts.ts'

const ROOT = fileURLToPath(new URL('..', import.meta.url))
const INPUT = 'www'
const OURS = 'dist/lemmon'
const THEIRS = 'dist/www'
const LOOK = 'dist/look'

/** The ports `--serve` listens on, fixed so the URLs it prints stay open across runs. */
const SERVE_PORTS = { theirs: 8081, ours: 8082 }

/** Each screenshot taken of a page: its viewport width and color scheme. */
const VARIANTS = [
  { name: '1280-light', width: 1280, scheme: 'light' },
  { name: '390-light', width: 390, scheme: 'light' },
  { name: '1280-dark', width: 1280, scheme: 'dark' },
] as const

// --- Comparing screenshots ----------------------------------------------------------

/** A decoded image: RGBA, four bytes a pixel, row by row. */
export interface Bitmap {
  data: Uint8Array
  width: number
  height: number
}

/** A run of rows, first and last inclusive. */
export type Band = [first: number, last: number]

/** How two screenshots differ: how many pixels, in which rows, and a picture of it. */
export interface PixelDiff {
  pixels: number
  bands: Band[]
  /** Theirs faded, each differing pixel red, and what only one image covers magenta. */
  image: Bitmap
}

const DIFFERS = [255, 0, 0, 255]
const UNCOVERED = [255, 0, 255, 255]

/** Rows, ascending, as runs of consecutive rows. */
export function rowBands(rows: number[]): Band[] {
  const bands: Band[] = []
  for (const row of rows) {
    const last = bands.at(-1)
    if (last !== undefined && row === last[1] + 1) last[1] = row
    else bands.push([row, row])
  }
  return bands
}

/**
 * Compares two screenshots pixel for pixel, all four channels. Where one is wider or
 * taller, what only the other covers counts as differing.
 */
export function pixelDiff(ours: Bitmap, theirs: Bitmap): PixelDiff {
  const width = Math.max(ours.width, theirs.width)
  const height = Math.max(ours.height, theirs.height)
  const data = new Uint8Array(width * height * 4)
  const rows: number[] = []
  let pixels = 0
  for (let y = 0; y < height; y += 1) {
    let differs = false
    for (let x = 0; x < width; x += 1) {
      const at = (y * width + x) * 4
      const covered =
        x < ours.width && y < ours.height && x < theirs.width && y < theirs.height
      const o = (y * ours.width + x) * 4
      const t = (y * theirs.width + x) * 4
      const same =
        covered &&
        ours.data[o] === theirs.data[t] &&
        ours.data[o + 1] === theirs.data[t + 1] &&
        ours.data[o + 2] === theirs.data[t + 2] &&
        ours.data[o + 3] === theirs.data[t + 3]
      if (same) {
        const [r, g, b] = theirs.data.subarray(t, t + 3)
        const faded = 255 - Math.round((255 - (r * 0.299 + g * 0.587 + b * 0.114)) / 4)
        data.set([faded, faded, faded, 255], at)
      } else {
        data.set(covered ? DIFFERS : UNCOVERED, at)
        pixels += 1
        differs = true
      }
    }
    if (differs) rows.push(y)
  }
  return { pixels, bands: rowBands(rows), image: { data, width, height } }
}

/** Bands as a report reads them: the first `shown`, then how many more. */
export function bandsText(bands: Band[], shown = 6): string {
  const runs = bands
    .slice(0, shown)
    .map(([first, last]) => (first === last ? `${first}` : `${first}–${last}`))
  const more = bands.length > shown ? ` and ${bands.length - shown} more` : ''
  return `rows ${runs.join(', ')}${more}`
}

// --- Serving a dist -----------------------------------------------------------------

const TYPES: Record<string, string> = {
  '.avif': 'image/avif',
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.ico': 'image/x-icon',
  '.jpeg': 'image/jpeg',
  '.jpg': 'image/jpeg',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.txt': 'text/plain; charset=utf-8',
  '.wasm': 'application/wasm',
  '.webmanifest': 'application/manifest+json',
  '.webp': 'image/webp',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.xml': 'application/xml',
}

/** The file under `root` a request's path names, a directory's being its index.html. */
export function fileFor(root: string, path: string): string | null {
  let decoded: string
  try {
    decoded = decodeURIComponent(path)
  } catch {
    return null
  }
  const file = normalize(
    join(root, decoded.endsWith('/') ? `${decoded}index.html` : decoded)
  )
  return file.startsWith(root + sep) ? file : null
}

/**
 * Serves the files under `root` on 127.0.0.1, port 0 for any free one, with `pages`
 * served in place of the file at each url they name.
 */
async function serve(root: string, port: number, pages = new Map<string, string>()) {
  const server = createServer((request, response) => {
    const path = new URL(request.url ?? '/', 'http://localhost').pathname
    const page = pages.get(path)
    if (page !== undefined) {
      response.writeHead(200, { 'content-type': TYPES['.html'] }).end(page)
      return
    }
    const file = fileFor(root, path)
    const missing = (): void => {
      response.writeHead(404).end()
    }
    if (file === null) {
      missing()
      return
    }
    readFile(file).then(
      (body) =>
        response
          .writeHead(200, {
            'content-type': TYPES[extname(file)] ?? 'application/octet-stream',
          })
          .end(body),
      missing
    )
  })
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject)
    server.listen(port, '127.0.0.1', resolve)
  })
  return server
}

const origin = (server: Server): string =>
  `http://127.0.0.1:${(server.address() as AddressInfo).port}`

// --- What the scripts change -------------------------------------------------------

/**
 * What every screenshot masks, on both sides alike, and why: each is drawn by a client
 * script, from bundles parity compares byte for byte, and changes with the clock, or
 * arrives from a worker or the stand-in host at a moment nothing here waits for, so that
 * two shots of one build can differ.
 * Playwright paints the mask over the element's box, so a box placed or sized otherwise
 * still shows. Each selector starts at an element a script under www/lib defines (a spec
 * checks), and one that no page matched fails the run, so a renamed element cannot leave
 * its mask standing over nothing. Not here: `projectile-cannon` draws its canvas once
 * and again only when its Fire button is pressed, and a `blur-hash` is put in one order
 * by Gate instead, so that its photo is compared.
 */
export const MASKED = [
  {
    selector: 'pixel-clock canvas',
    why: 'the clock, which a worker draws with the time ten times a second',
  },
  {
    selector: 'sphere-shadow canvas, sphere-shadow-wasm canvas',
    why: 'the shadow, which a worker draws when it is ready',
  },
  {
    selector: 'sphere-shadow #hud, sphere-shadow-wasm #hud',
    why: 'how long the worker took to draw it',
  },
  {
    selector: 'video-on-demand',
    why: 'the player: its controls, then the poster when the stand-in host answers',
  },
] as const

/**
 * Requests a tab holds while the gate is shut and lets through when it opens, so that the
 * look check chooses when they arrive: each tab has one for its scripts and one for its
 * photos. Open until shut.
 */
export class Gate {
  #shut = false
  #held: (() => void)[] = []

  /** Settles once the gate is open: at once, where it is. */
  passed(): Promise<void> {
    if (!this.#shut) return Promise.resolve()
    return new Promise((resolve) => this.#held.push(resolve))
  }

  shut(): void {
    this.#shut = true
  }

  /** Lets through everything held, in the order it came, and all that comes after. */
  open(): void {
    this.#shut = false
    for (const release of this.#held.splice(0)) release()
  }
}

// --- The look check -----------------------------------------------------------------

const LOCAL = new Set(['127.0.0.1', 'localhost'])

/**
 * The map's bundle, which map-box's loader imports once two thirds of a photo page's map
 * are in view, and which each tab is answered with an empty module, both sides alike,
 * so that no map loads: mapbox-gl reads its style and tiles from api.mapbox.com, which
 * the stand-in answers with a PNG, so a map that loaded would log that it cannot parse
 * one and draw nothing over its placeholder. None loads as the pages stand, since no page
 * shows two thirds of its map in a 900-pixel viewport; this keeps it so on one that
 * would. Parity compares the bundle itself byte for byte.
 */
export const MAP_BUNDLE = /^\/lib\/map-box\/index\.[A-Z0-9]{8}\.js$/

/** A screenshot, whether the page had settled, and how many images failed to decode. */
interface Shot {
  png: Buffer
  settled: boolean
  broken: number
  /** What kept the page from the state it is shot in. */
  problems: string[]
  /** How many elements each of MASKED masked, by selector. */
  masked: Map<string, number>
}

/**
 * Takes screenshots until two running agree, byte for byte, and gives the last one taken
 * and whether it was such a pair, after at most `tries`. The pair is the check that the
 * renderer has settled, as in Playwright's own screenshot assertion: rasterized on the
 * GPU, two shots of one page differed by a few pixels of antialiasing often enough to
 * fail most runs, so the browser rasterizes in software (look, below), where the first
 * pair has agreed every time; a page that still never agrees is a failure of its own,
 * not a difference between the builds.
 */
export async function settle(
  take: () => Promise<Buffer>,
  tries = 5
): Promise<{ png: Buffer; settled: boolean }> {
  let png = await take()
  for (let taken = 1; taken < tries; taken += 1) {
    const next = await take()
    if (next.equals(png)) return { png: next, settled: true }
    png = next
  }
  return { png, settled: false }
}

/**
 * Shoots one page full length in `tab`, MASKED masked, once it has been parsed with its
 * scripts held, every blur-hash placeholder has then been painted with its photos held,
 * every image has then loaded and decoded and cleared its placeholder, the fonts are
 * ready, and two screenshots agree. A lazy image is made eager first, or one below the
 * fold would be shot as its placeholder.
 */
async function shoot({ page, scripts, photos, errors }: Tab, url: string): Promise<Shot> {
  const problems: string[] = []
  errors.length = 0
  scripts.shut()
  photos.shut()
  try {
    // Every script on these pages is `async`, which DOMContentLoaded does not wait for,
    // so the page is parsed whole while they are held; `load` would wait for them.
    await page.goto(url, { waitUntil: 'domcontentloaded' })
    scripts.open()
    const painted = await holds(page, () =>
      [...document.querySelectorAll<HTMLImageElement>('blur-hash[blurhash] img')].every(
        (image) => image.style.backgroundImage !== ''
      )
    )
    if (!painted) {
      const unpainted = await page.evaluate(() =>
        [...document.querySelectorAll<HTMLImageElement>('blur-hash[blurhash] img')]
          .filter((image) => image.style.backgroundImage === '')
          .map((image) => `${image.complete ? 'loaded' : 'held'} ${image.currentSrc}`)
      )
      problems.push(`blur-hash placeholders never painted: ${unpainted.join('; ')}`)
    }
  } finally {
    scripts.open()
    photos.open()
  }
  await page.waitForLoadState('load')
  const broken = await page.evaluate(async () => {
    const images = [...document.images]
    for (const image of images) image.loading = 'eager'
    const decoded = await Promise.all(
      images.map((image) =>
        image.decode().then(
          () => true,
          () => false
        )
      )
    )
    await document.fonts.ready
    return decoded.filter((ok) => !ok).length
  })
  // A photo's `load` clears its placeholder a frame later; one that failed keeps it.
  const cleared = await holds(page, () =>
    [...document.querySelectorAll<HTMLImageElement>('blur-hash[blurhash] img')].every(
      (image) => image.naturalWidth === 0 || image.style.backgroundImage === ''
    )
  )
  if (!cleared) problems.push('a photo never cleared its blur-hash placeholder')
  const mask = MASKED.map(({ selector }) => page.locator(selector))
  const masked = new Map<string, number>()
  for (const [n, { selector }] of MASKED.entries()) {
    masked.set(selector, await mask[n].count())
  }
  const shot = await settle(() =>
    page.screenshot({ fullPage: true, animations: 'disabled', mask })
  )
  problems.push(...errors.map((error) => `the page threw: ${error}`))
  return { ...shot, broken, problems, masked }
}

/**
 * Whether `predicate` comes to hold in `page` within ten seconds, checked every 100 ms
 * rather than every frame, which a busy renderer can hold back.
 */
const holds = (page: Page, predicate: () => boolean): Promise<boolean> =>
  page.waitForFunction(predicate, undefined, { polling: 100, timeout: 10_000 }).then(
    () => true,
    () => false
  )

async function bitmapOf(png: Buffer): Promise<Bitmap> {
  const { data, info } = await sharp(png)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })
  return { data, width: info.width, height: info.height }
}

/**
 * Pins what `tab` fetches from every other host to `image`, and holds each request at
 * its gate: a file esbuild writes for one of `entries`, as parity's scripts.ts tells one,
 * at its scripts', and each request to another host at its photos'. Answers the map's
 * bundle with an empty module (MAP_BUNDLE). Collects what its page throws.
 */
async function pin(
  { page, scripts, photos, errors }: Tab,
  image: Buffer,
  entries: ReadonlySet<string>
): Promise<void> {
  page.on('pageerror', (error) => errors.push(error.message))
  await page.route('**/*', async (route) => {
    const url = new URL(route.request().url())
    if (LOCAL.has(url.hostname)) {
      if (MAP_BUNDLE.test(url.pathname)) {
        return route.fulfill({ contentType: TYPES['.js'], body: '' })
      }
      if (isScriptFile(url.pathname, entries)) await scripts.passed()
      return route.continue()
    }
    await photos.passed()
    return route.fulfill({
      status: 200,
      contentType: 'image/png',
      // The photos load `crossorigin="anonymous"`, which a stand-in must allow.
      headers: { 'access-control-allow-origin': '*' },
      body: image,
    })
  })
}

/** A stand-in for every remote image: a 4×3 swatch, so a box cropped otherwise shows. */
async function standIn(): Promise<Buffer> {
  const rows = [
    [200, 60, 60, 60, 160, 60, 60, 60, 200, 230, 230, 230],
    [40, 40, 40, 240, 200, 40, 40, 200, 240, 200, 40, 240],
    [120, 120, 120, 250, 250, 250, 10, 10, 10, 160, 100, 40],
  ]
  return sharp(Buffer.from(rows.flat()), { raw: { width: 4, height: 3, channels: 3 } })
    .png()
    .toBuffer()
}

/**
 * A tab, pinned, the gates its scripts and its photos wait at, and the errors its page
 * has thrown since its last shot began.
 */
interface Tab {
  page: Page
  scripts: Gate
  photos: Gate
  errors: string[]
}

/** A variant and a tab for each side, in a browser context of its own. */
interface Shooter {
  variant: (typeof VARIANTS)[number]
  tabs: { ours: Tab; theirs: Tab }
}

/** Whether two counts of what MASKED masked agree, selector by selector. */
export const sameMasks = (a: Map<string, number>, b: Map<string, number>): boolean =>
  a.size === b.size && [...a].every(([selector, n]) => b.get(selector) === n)

/**
 * The selectors of `masks` that masked nothing on any page, given how many elements each
 * masked on each page shot, which fail the run: a mask standing over nothing is stale.
 */
export function maskedNothing(
  pages: Map<string, number>[],
  masks: readonly { selector: string }[] = MASKED
): string[] {
  return masks
    .map(({ selector }) => selector)
    .filter((selector) => pages.every((counts) => (counts.get(selector) ?? 0) === 0))
}

/**
 * Shoots both sides of one page in one variant, writes the pair and its difference
 * under dist/look/ at its url, and returns the report's lines, whether they matched, and
 * what MASKED masked on ours.
 */
async function compareShots(
  { variant, tabs }: Shooter,
  url: string,
  origins: { ours: string; theirs: string }
): Promise<{ lines: string[]; same: boolean; masked: Map<string, number> }> {
  const [o, t] = await Promise.all([
    shoot(tabs.ours, `${origins.ours}${url}`),
    shoot(tabs.theirs, `${origins.theirs}${url}`),
  ])
  const [ours, theirs] = await Promise.all([bitmapOf(o.png), bitmapOf(t.png)])
  const diff = pixelDiff(ours, theirs)
  const dir = join(LOOK, url)
  const file = (side: string): string => join(dir, `${variant.name}-${side}.png`)
  const { data, width, height } = diff.image
  await mkdir(join(ROOT, dir), { recursive: true })
  await Promise.all([
    writeFile(join(ROOT, file('ours')), o.png),
    writeFile(join(ROOT, file('theirs')), t.png),
    sharp(data, { raw: { width, height, channels: 4 } })
      .png()
      .toFile(join(ROOT, file('diff'))),
  ])
  const lines: string[] = []
  if (diff.pixels === 0) {
    lines.push(`  ${variant.name}: ok, identical at ${ours.width}×${ours.height}`)
  } else {
    const heights =
      ours.height === theirs.height
        ? ''
        : `; heights differ, ours ${ours.height} and theirs ${theirs.height}`
    lines.push(
      `  ${variant.name}: FAIL, ${diff.pixels} pixels differ in ` +
        `${bandsText(diff.bands)}${heights}`,
      `    ${file('diff')}`
    )
  }
  for (const [side, shot] of [
    ['ours', o],
    ['theirs', t],
  ] as const) {
    if (!shot.settled) lines.push(`  ${variant.name}: FAIL, ${side} never shot alike twice`)
    for (const problem of shot.problems) {
      lines.push(`  ${variant.name}: FAIL, on ${side} ${problem}`)
    }
    if (shot.broken > 0) {
      lines.push(`    note: ${shot.broken} images on ${side} did not decode`)
    }
  }
  const masks = sameMasks(o.masked, t.masked)
  if (!masks) {
    const counts = (masked: Map<string, number>) =>
      [...masked].map(([selector, n]) => `${selector} (${n})`).join('; ')
    lines.push(
      `  ${variant.name}: FAIL, the masks cover other elements — ours: ` +
        `${counts(o.masked)} — theirs: ${counts(t.masked)}`
    )
  }
  return {
    lines,
    same:
      diff.pixels === 0 &&
      o.settled &&
      t.settled &&
      o.problems.length + t.problems.length === 0 &&
      masks,
    masked: o.masked,
  }
}

/** The look check over every page: true where every screenshot matched. */
async function look(urls: string[]): Promise<boolean> {
  const started = Date.now()
  const css = await bundlesIn(join(ROOT, OURS), join(ROOT, THEIRS))
  const { chromium } = await import('playwright-core')
  // Software rasterizing: on the GPU, the same page shot twice differed (settle).
  const browser = await chromium
    .launch({ channel: 'chrome', headless: true, args: ['--disable-gpu'] })
    .catch((error: Error) => {
      console.error(`parity:look needs Google Chrome installed. ${error.message}`)
      process.exit(1)
    })
  const pages = { ours: new Map<string, string>(), theirs: new Map<string, string>() }
  const servers = {
    ours: await serve(join(ROOT, OURS), 0, pages.ours),
    theirs: await serve(join(ROOT, THEIRS), 0, pages.theirs),
  }
  const origins = { ours: origin(servers.ours), theirs: origin(servers.theirs) }
  const stand = await standIn()
  const entries = await entriesIn(join(ROOT, INPUT))
  const shooters: Shooter[] = []
  for (const variant of VARIANTS) {
    const context = await browser.newContext({
      viewport: { width: variant.width, height: 900 },
      colorScheme: variant.scheme,
      deviceScaleFactor: 1,
    })
    const tab = async (): Promise<Tab> => {
      const made = {
        page: await context.newPage(),
        scripts: new Gate(),
        photos: new Gate(),
        errors: [],
      }
      await pin(made, stand, entries)
      return made
    }
    shooters.push({ variant, tabs: { ours: await tab(), theirs: await tab() } })
  }
  await rm(join(ROOT, LOOK), { recursive: true, force: true })
  console.log(`parity:look: ${urls.length} pages, Chrome ${browser.version()} headless`)
  console.log()

  let failures = 0
  const maskedOnPages: Map<string, number>[] = []
  try {
    for (const url of urls) {
      const ours = await pageAt(join(ROOT, OURS), url)
      const theirs = await pageAt(join(ROOT, THEIRS), url)
      const parity = comparePage({
        url,
        ours,
        theirs,
        css,
        expected: EXPECTED[url] ?? {},
      })
      if (ours === null || theirs === null || failed(parity)) {
        console.log(`${url}: FAIL, parity fails here, so it is not shot:`)
        for (const line of reportLines(parity, { ours: OURS, theirs: THEIRS })) {
          console.log(`  ${line}`)
        }
        failures += 1
        continue
      }
      const neutralized = neutralize(ours, theirs)
      pages.ours.set(url, neutralized.ours)
      pages.theirs.set(url, neutralized.theirs)
      const counts = [...neutralized.edits].map(([name, n]) => `${name} ${n}`)
      console.log(
        `${url}: parity ok; neutralized ` +
          `${counts.length > 0 ? counts.join(', ') : 'nothing'}`
      )
      for (const problem of neutralized.problems) console.log(`  FAIL, ${problem}`)
      let same = neutralized.problems.length === 0
      let masked = new Map<string, number>()
      for (const shooter of shooters) {
        const result = await compareShots(shooter, url, origins)
        for (const line of result.lines) console.log(line)
        same &&= result.same
        masked = result.masked
      }
      const shown = [...masked].filter(([, n]) => n > 0)
      if (shown.length > 0) {
        console.log(
          `  masked ${shown.map(([selector, n]) => `${selector} (${n})`).join('; ')}`
        )
      }
      maskedOnPages.push(masked)
      if (!same) failures += 1
    }
  } finally {
    await browser.close()
    servers.ours.close()
    servers.theirs.close()
  }

  const seconds = ((Date.now() - started) / 1000).toFixed(1)
  const shots = urls.length * VARIANTS.length
  const unused = maskedNothing(maskedOnPages)
  console.log()
  for (const selector of unused) {
    console.error(`FAIL: MASKED's \`${selector}\` masked nothing on any page`)
  }
  if (failures === 0 && unused.length === 0) {
    console.log(`PASS: ${shots} screenshots identical, pixel for pixel (${seconds} s)`)
  } else {
    console.error(
      `FAIL: ${failures} of ${urls.length} pages differ, listed above; ` +
        `the screenshots are in ${LOOK}/ (${seconds} s)`
    )
  }
  return failures === 0 && unused.length === 0
}

/** Serves both dists as built on SERVE_PORTS, listing each page's pair, until Ctrl-C. */
async function serveBoth(urls: string[]): Promise<void> {
  const listen = (dist: string, port: number): Promise<Server> =>
    serve(join(ROOT, dist), port).catch((error: NodeJS.ErrnoException) => {
      const why = error.code === 'EADDRINUSE' ? 'is in use' : `failed: ${error.message}`
      console.error(`parity:look: port ${port} for ${dist} ${why}`)
      process.exit(1)
    })
  const servers = {
    theirs: await listen(THEIRS, SERVE_PORTS.theirs),
    ours: await listen(OURS, SERVE_PORTS.ours),
  }
  const rows = [
    ['Eleventy, dist/www', 'Lemmon, dist/lemmon'],
    ...urls.map((url) => [
      `${origin(servers.theirs)}${url}`,
      `${origin(servers.ours)}${url}`,
    ]),
  ]
  const width = Math.max(...rows.map(([theirs]) => theirs.length))
  for (const [theirs, ours] of rows) console.log(`${theirs.padEnd(width)}  ${ours}`)
  console.log()
  console.log(
    'Both are served as built, each running its own /lib bundles, so the differences ' +
      'parity\nforgives show here (footnote markup, a reading-time minute, the photo ' +
      "figures' gaps),\nwhich `npm run parity:look` neutralizes before it compares. " +
      'Ctrl-C stops the servers.'
  )
  await new Promise<void>((resolve) => process.once('SIGINT', resolve))
  servers.theirs.close()
  servers.ours.close()
}

if (esMain(import.meta)) {
  const args = process.argv.slice(2)
  const unknown = args.filter((arg) => arg !== '--serve')
  if (unknown.length > 0) {
    console.error(`unknown argument: ${unknown.join(' ')}`)
    console.error('usage: npm run parity:look [-- --serve]')
    process.exit(2)
  }
  // The pages parity compares; what is wrong with the dists' other HTML is parity's to
  // say.
  const urls = rosterOf(
    (await pagesIn(join(ROOT, OURS))).pages,
    (await pagesIn(join(ROOT, THEIRS))).pages
  )
  if (urls.length === 0) {
    console.error(`parity:look: no page in ${OURS} or ${THEIRS}`)
    process.exit(1)
  }
  if (args.includes('--serve')) await serveBoth(urls)
  else if (!(await look(urls))) process.exitCode = 1
}
