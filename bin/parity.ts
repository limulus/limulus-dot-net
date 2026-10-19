// `npm run parity`: builds the site both ways — Eleventy to dist/www, under `TZ=UTC` as
// CD builds it, and `lem build` to dist/lemmon — and compares the whole of each dist.
// Every file either build wrote falls in exactly one category, each compared by its own
// rule (bin/parity/inventory.ts), and a file in none, or in several, fails the run, named.
// Every page, each `index.html`, is compared as rendered HTML (lemmon's D28), through the
// forgiveness classes in bin/parity/, with both builds' CSS bundles read beside the global
// stylesheets for css-bundle. Each page reports every difference no class explains, why a
// class refused one where it says, how often each class fired, and what matched. Every
// `.xml` file — the feeds and the sitemap — is reported the same way, compared as XML,
// each feed entry's content through the page classes (bin/parity/xml.ts). Each build's
// CSS bundles must each be linked by a page compared, where css-bundle compares them.
// The client scripts both builds bundled — every file esbuild writes for an `index.ts`
// or `worker.ts` under www/, and its assets — are compared byte for byte, Eleventy's
// unhashed stubs set aside and counted, one beside each entry bundle it wrote
// (bin/parity/scripts.ts), and so are the passthrough files, each a copy of the input's
// file at its path. A side wrote a file where its own listing holds the url exactly, not
// where this machine's file system finds it. The run exits 1 on a file in no category or
// several, any unexplained difference, any class firing other than its count in
// EXPECTED, a row there for a url no page or XML file compared has, a page or an XML
// file one build lacks, a bundle no page links, a script or passthrough file one build
// lacks or writes differently, or an entry bundle of Eleventy's without its stub.
//
//   npm run parity [-- --no-build]     --no-build compares the dists already there
//
// npm runs it as `node --conditions=source`: @limulus/lemmon-shell is a file: link to
// the lemmon checkout, and the `source` export condition loads its src/ (and core's)
// directly, as the `lem` bin does, so the comparator needs no `npm run build` there.

import { spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { readFile, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { EXPECTED } from './parity/expected.ts'

const ROOT = fileURLToPath(new URL('..', import.meta.url))
const INPUT = 'www'
const OURS = 'dist/lemmon'
const THEIRS = 'dist/www'
const LEM = join(ROOT, 'node_modules/.bin/lem')

// Without the lemmon checkout the file: link dangles, and so does the `lem` bin. Say so
// before importing the shell, and never reach for `npx lem`: with no TTY npx would take
// the unrelated `lem` package from the registry and run its install scripts.
if (!existsSync(LEM)) {
  console.error(
    'parity: node_modules/.bin/lem is missing. The port needs the lemmon repo checked ' +
      'out at ../lemmon, with `npm install` and `npm run rust:wasm` run there, and then ' +
      '`npm install` here (CLAUDE.md, "Lemmon port").'
  )
  process.exit(1)
}

const {
  bundleLines,
  bundlesIn,
  comparePage,
  failed,
  pageAt,
  pagesIn,
  reportLines,
  rosterOf,
  staleRows,
  unlinked,
} = await import('./parity/check.ts')
const { bytesFailed, bytesLines, compareBytes, everyFile } = await import(
  './parity/files.ts'
)
const { inventoryFailed, inventoryLines, inventoryOf, passthroughIn } = await import(
  './parity/inventory.ts'
)
const { compareScripts, entriesIn, scriptLines, scriptsFailed, scriptsIn } = await import(
  './parity/scripts.ts'
)
const { compareXml, feedsOf, isDated, xmlAt, xmlIn, xmlReportLines } = await import(
  './parity/xml.ts'
)

const args = process.argv.slice(2)
const unknown = args.filter((arg) => arg !== '--no-build')
if (unknown.length > 0) {
  console.error(`unknown argument: ${unknown.join(' ')}`)
  console.error('usage: npm run parity [-- --no-build]')
  process.exit(2)
}

/** Runs a build step with `env` added, printing its output only if it fails. */
function build(
  what: string,
  command: string,
  commandArgs: string[],
  env: Record<string, string> = {}
): void {
  console.log(`building ${what}…`)
  const result = spawnSync(command, commandArgs, {
    cwd: ROOT,
    encoding: 'utf8',
    env: { ...process.env, ...env },
  })
  if (result.error) throw result.error
  if (result.status !== 0) {
    process.stdout.write(result.stdout)
    process.stderr.write(result.stderr)
    console.error(`parity: \`${[command, ...commandArgs].join(' ')}\` failed`)
    process.exit(1)
  }
}

if (!args.includes('--no-build')) {
  // CD's runner is in UTC, and Eleventy writes an RSS `pubDate` in the build machine's
  // zone: the same instant, spelled as production spells it.
  build(`${THEIRS} with Eleventy`, 'npm', ['run', 'build'], { TZ: 'UTC' })
  // `lem build` removes nothing from its output, so a page this build no longer writes
  // would linger there and be compared as the last build left it.
  await rm(join(ROOT, OURS), { recursive: true, force: true })
  build(`${OURS} with lem build`, LEM, ['build'])
}

const ours = join(ROOT, OURS)
const theirs = join(ROOT, THEIRS)
const sides = { ours: OURS, theirs: THEIRS }
const input = new Set(await everyFile(join(ROOT, INPUT)))
const entries = await entriesIn(join(ROOT, INPUT))
const inventory = {
  ours: inventoryOf(await everyFile(ours), { side: 'ours', entries, input }),
  theirs: inventoryOf(await everyFile(theirs), { side: 'theirs', entries, input }),
}

const pages = { ours: await pagesIn(ours), theirs: await pagesIn(theirs) }
const urls = rosterOf(pages.ours, pages.theirs)
const css = await bundlesIn(ours, theirs)
const xml = { ours: await xmlIn(ours), theirs: await xmlIn(theirs) }
const xmlUrls = rosterOf(xml.ours, xml.theirs)
const stale = staleRows(EXPECTED, [...urls, ...xmlUrls])
let failures = 0
// The pages Eleventy dated, which the sitemap's classes read.
const dated = new Set<string>()
console.log()
for (const url of urls) {
  const page = {
    ours: await pageAt(ours, url, pages.ours),
    theirs: await pageAt(theirs, url, pages.theirs),
  }
  if (page.theirs !== null && isDated(page.theirs)) dated.add(url)
  const report = comparePage({ url, ...page, css, expected: EXPECTED[url] ?? {} })
  for (const line of reportLines(report, sides)) console.log(line)
  if (failed(report)) failures += 1
}

const site = JSON.parse(await readFile(join(ROOT, INPUT, '_data/site.json'), 'utf8')) as {
  url: string
}
const theirsXml = new Map<string, Uint8Array>()
for (const url of xmlUrls) {
  const bytes = await xmlAt(theirs, url, xml.theirs)
  if (bytes !== null) theirsXml.set(url, bytes)
}
const context = {
  origin: new URL(site.url).origin,
  css,
  pages: new Set(pages.theirs),
  dated,
  feeds: feedsOf(theirsXml),
}
let xmlFailures = 0
console.log()
for (const url of xmlUrls) {
  const report = compareXml({
    url,
    ours: await xmlAt(ours, url, xml.ours),
    theirs: theirsXml.get(url) ?? null,
    context,
    expected: EXPECTED[url] ?? {},
  })
  for (const line of xmlReportLines(report, sides)) console.log(line)
  if (failed(report)) xmlFailures += 1
}

const scripts = compareScripts(
  await scriptsIn(ours, entries),
  await scriptsIn(theirs, entries),
  entries
)
const passthrough = compareBytes(
  await passthroughIn(ours, input),
  await passthroughIn(theirs, input)
)
console.log()
for (const line of bundleLines(css, sides)) console.log(line)
for (const line of scriptLines(scripts, sides)) console.log(line)
for (const line of bytesLines('passthrough', passthrough, sides)) console.log(line)
console.log()
for (const line of inventoryLines(inventory, sides)) console.log(line)

console.log()
for (const url of stale) {
  console.error(
    `FAIL: bin/parity/expected.ts has a row for ${url}, where neither build wrote a page`
  )
}
const misplaced = inventoryFailed(inventory.ours) || inventoryFailed(inventory.theirs)
if (misplaced) {
  console.error('FAIL: a build wrote a file in no category, or in several, listed above')
}
if (urls.length === 0) {
  console.error(`FAIL: no page in ${OURS} or ${THEIRS}`)
}
if (failures > 0) {
  console.error(`FAIL: ${failures} of ${urls.length} pages differ, listed above`)
}
if (xmlUrls.length === 0) {
  console.error(`FAIL: no .xml file in ${OURS} or ${THEIRS}`)
}
if (xmlFailures > 0) {
  console.error(`FAIL: ${xmlFailures} of ${xmlUrls.length} XML files differ, listed above`)
}
if (unlinked(css).length > 0) {
  console.error('FAIL: a CSS bundle is linked by no page, listed above')
}
if (scriptsFailed(scripts)) {
  console.error('FAIL: the client scripts differ, listed above')
}
if (bytesFailed(passthrough)) {
  console.error('FAIL: the passthrough files differ, listed above')
}
if (
  stale.length > 0 ||
  misplaced ||
  urls.length === 0 ||
  failures > 0 ||
  xmlUrls.length === 0 ||
  xmlFailures > 0 ||
  unlinked(css).length > 0 ||
  scriptsFailed(scripts) ||
  bytesFailed(passthrough)
) {
  process.exitCode = 1
} else {
  console.log(
    `PASS: every file each build wrote, ${inventory.ours.files} in ${OURS} and ` +
      `${inventory.theirs.files} in ${THEIRS}, in one category and compared: ` +
      `${urls.length} pages and ${xmlUrls.length} XML files, every difference in a ` +
      `named class at its count; ${css.ours.size} and ${css.theirs.size} CSS bundles, ` +
      `each through the pages that link it; ${scripts.identical} script files and ` +
      `${passthrough.identical} passthrough files byte for byte; and ` +
      `${scripts.setAside.length} of Eleventy's unhashed stubs set aside, one per ` +
      'entry bundle it wrote'
  )
}
