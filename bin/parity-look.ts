// `npm run parity:look`: whether the feed posts look the same in both builds. Run it after
// `npm run parity`, whose dists it reads as they stand: it builds nothing. It serves
// dist/www and dist/lemmon over HTTP, shoots every post in the installed Google Chrome
// (headless, rasterizing in software) at 1280 px light, 390 px light and 1280 px dark,
// and compares each pair of full-page screenshots pixel for pixel, writing both and their
// difference to dist/look/<slug>/. Any difference fails the run: there is no allowance.
//
// So that none is needed, what the pages fetch is pinned and what parity forgives is
// evened out. Every request to another host (the photos and video posters, on pho. and
// vod.limulus.net) is answered with one fixed PNG, and `/lib/**` is refused on both sides,
// since Lemmon's build has no client scripts until ∆d1N in the lemmon repo. Each post is
// served neutralized: parsed with parse5, every visible difference a parity class forgives
// undone by a neutralizer named for that class (bin/parity/neutralizers.ts), and
// serialized again, both sides alike. A post is shot only where parity's own comparison
// of it passes, since every match here stands on what parity explained.
//
//   npm run parity:look [-- --serve]
//
// --serve serves both dists as built instead, Eleventy's on SERVE_PORTS.theirs and
// Lemmon's on SERVE_PORTS.ours, and prints each post's two URLs to open side by side,
// until interrupted. Nothing is neutralized or refused there, so Eleventy's pages run
// their scripts, which Lemmon's do not have.

import esMain from 'es-main'
import { readFile, mkdir, rm, writeFile } from 'node:fs/promises'
import { createServer, type Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import { extname, join, normalize, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { BrowserContext, Page } from 'playwright-core'
import sharp from 'sharp'

import {
  comparePost,
  failed,
  pageAt,
  postsIn,
  reportLines,
  siteInputs,
} from './parity/check.ts'
import { EXPECTED } from './parity/expected.ts'
import { neutralize } from './parity/neutralizers.ts'

const ROOT = fileURLToPath(new URL('..', import.meta.url))
const OURS = 'dist/lemmon'
const THEIRS = 'dist/www'
const LOOK = 'dist/look'

/** The ports `--serve` listens on, fixed so the URLs it prints stay open across runs. */
const SERVE_PORTS = { theirs: 8081, ours: 8082 }

/** Each screenshot taken of a post: its viewport width and color scheme. */
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

// --- The look check -----------------------------------------------------------------

const LOCAL = new Set(['127.0.0.1', 'localhost'])

/** A screenshot, whether the page had settled, and how many images failed to decode. */
interface Shot {
  png: Buffer
  settled: boolean
  broken: number
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
 * Shoots one page full length once every image has loaded and decoded, the fonts are
 * ready, and two screenshots agree. A lazy image is made eager first, or one below the
 * fold would be shot as its placeholder.
 */
async function shoot(page: Page, url: string): Promise<Shot> {
  await page.goto(url, { waitUntil: 'load' })
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
  const shot = await settle(() =>
    page.screenshot({ fullPage: true, animations: 'disabled' })
  )
  return { ...shot, broken }
}

async function bitmapOf(png: Buffer): Promise<Bitmap> {
  const { data, info } = await sharp(png)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })
  return { data, width: info.width, height: info.height }
}

/** Pins what a context's pages fetch: `image` from every other host, no `/lib`. */
async function pin(context: BrowserContext, image: Buffer): Promise<void> {
  await context.route('**/*', (route) => {
    const url = new URL(route.request().url())
    if (!LOCAL.has(url.hostname)) {
      return route.fulfill({
        status: 200,
        contentType: 'image/png',
        // The photos load `crossorigin="anonymous"`, which a stand-in must allow.
        headers: { 'access-control-allow-origin': '*' },
        body: image,
      })
    }
    return url.pathname.startsWith('/lib/') ? route.abort() : route.continue()
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

/** A variant and a tab for each side, in a browser context of its own, pinned. */
interface Shooter {
  variant: (typeof VARIANTS)[number]
  tabs: { ours: Page; theirs: Page }
}

/**
 * Shoots both sides of one post in one variant, writes the pair and its difference
 * under dist/look/, and returns the report's lines and whether they matched.
 */
async function compareShots(
  { variant, tabs }: Shooter,
  url: string,
  origins: { ours: string; theirs: string }
): Promise<{ lines: string[]; same: boolean }> {
  const [o, t] = await Promise.all([
    shoot(tabs.ours, `${origins.ours}${url}`),
    shoot(tabs.theirs, `${origins.theirs}${url}`),
  ])
  const [ours, theirs] = await Promise.all([bitmapOf(o.png), bitmapOf(t.png)])
  const diff = pixelDiff(ours, theirs)
  const dir = join(LOOK, url.split('/').at(-2) ?? '')
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
    if (shot.broken > 0) {
      lines.push(`    note: ${shot.broken} images on ${side} did not decode`)
    }
  }
  return { lines, same: diff.pixels === 0 && o.settled && t.settled }
}

/** The look check over every post: true where every screenshot matched. */
async function look(urls: string[]): Promise<boolean> {
  const started = Date.now()
  const { feed, css } = await siteInputs(join(ROOT, OURS), join(ROOT, THEIRS))
  if (feed === null) {
    console.error(`parity:look: no feed index in ${THEIRS}; run \`npm run parity\``)
    process.exit(1)
  }
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
  const shooters: Shooter[] = []
  for (const variant of VARIANTS) {
    const context = await browser.newContext({
      viewport: { width: variant.width, height: 900 },
      colorScheme: variant.scheme,
      deviceScaleFactor: 1,
    })
    await pin(context, stand)
    shooters.push({
      variant,
      tabs: { ours: await context.newPage(), theirs: await context.newPage() },
    })
  }
  await rm(join(ROOT, LOOK), { recursive: true, force: true })
  console.log(`parity:look: ${urls.length} posts, Chrome ${browser.version()} headless`)
  console.log()

  let failures = 0
  try {
    for (const url of urls) {
      const ours = await pageAt(join(ROOT, OURS), url)
      const theirs = await pageAt(join(ROOT, THEIRS), url)
      const parity = comparePost({
        url,
        ours,
        theirs,
        feed,
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
      const cards =
        neutralized.sharedCards === null
          ? 'no recommended cards'
          : `${neutralized.sharedCards} recommended ` +
            `${neutralized.sharedCards === 1 ? 'card' : 'cards'} both list`
      console.log(
        `${url}: parity ok; ${cards}; neutralized ` +
          `${counts.length > 0 ? counts.join(', ') : 'nothing'}`
      )
      for (const problem of neutralized.problems) console.log(`  FAIL, ${problem}`)
      let same = neutralized.problems.length === 0
      for (const shooter of shooters) {
        const result = await compareShots(shooter, url, origins)
        for (const line of result.lines) console.log(line)
        same &&= result.same
      }
      if (!same) failures += 1
    }
  } finally {
    await browser.close()
    servers.ours.close()
    servers.theirs.close()
  }

  const seconds = ((Date.now() - started) / 1000).toFixed(1)
  const shots = urls.length * VARIANTS.length
  console.log()
  if (failures === 0) {
    console.log(`PASS: ${shots} screenshots identical, pixel for pixel (${seconds} s)`)
  } else {
    console.error(
      `FAIL: ${failures} of ${urls.length} posts differ, listed above; ` +
        `the screenshots are in ${LOOK}/ (${seconds} s)`
    )
  }
  return failures === 0
}

/** Serves both dists as built on SERVE_PORTS, listing each post's pair, until Ctrl-C. */
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
    "Both are served as built. Eleventy's pages run their /lib scripts (the video " +
      "player,\nthe share buttons, the blur-hash placeholders); Lemmon's build has none " +
      'until ∆d1N,\nso those parts differ here, as do the differences parity forgives ' +
      '(footnote markup,\na reading-time minute, the recommended cards, the photo ' +
      "figures' gaps), which\n`npm run parity:look` neutralizes before it compares. " +
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
  const urls = [
    ...new Set([
      ...(await postsIn(join(ROOT, OURS))),
      ...(await postsIn(join(ROOT, THEIRS))),
    ]),
  ].sort()
  if (urls.length === 0) {
    console.error(
      `parity:look: no post under feed/ in ${OURS} or ${THEIRS}; run \`npm run parity\``
    )
    process.exit(1)
  }
  if (args.includes('--serve')) await serveBoth(urls)
  else if (!(await look(urls))) process.exitCode = 1
}
