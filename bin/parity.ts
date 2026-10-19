// `npm run parity`: builds the site both ways — Eleventy to dist/www, `lem build` to
// dist/lemmon — and compares every page either build wrote, each `index.html` under
// either dist, as rendered HTML (lemmon's D28), through the forgiveness classes in
// bin/parity/, with both builds' CSS bundles read beside the global stylesheets for
// css-bundle. Each page reports every difference no class explains, why a class refused
// one where it says, how often each class fired, and what matched. Every `.xml` file
// either build wrote — the feeds and the sitemap — is reported the same way, compared as
// XML, each feed entry's content through the page classes (bin/parity/xml.ts). Then the
// client scripts both builds bundled — every file esbuild writes for an `index.ts` or
// `worker.ts` under www/, and its assets — are compared byte for byte, Eleventy's
// unhashed stubs set aside and counted (bin/parity/scripts.ts). The run exits 1 on any
// unexplained difference, any class firing other than its count in EXPECTED, a row there
// for a url no page or XML file compared has, an `.html` file in either dist that is no
// `index.html`, a page or an XML file one build lacks, or a script file one build lacks
// or writes differently.
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
  bundlesIn,
  comparePage,
  failed,
  pageAt,
  pagesIn,
  reportLines,
  rosterOf,
  staleRows,
} = await import('./parity/check.ts')
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

/** Runs a build step, printing its output only if it fails. */
function build(what: string, command: string, commandArgs: string[]): void {
  console.log(`building ${what}…`)
  const result = spawnSync(command, commandArgs, { cwd: ROOT, encoding: 'utf8' })
  if (result.error) throw result.error
  if (result.status !== 0) {
    process.stdout.write(result.stdout)
    process.stderr.write(result.stderr)
    console.error(`parity: \`${[command, ...commandArgs].join(' ')}\` failed`)
    process.exit(1)
  }
}

if (!args.includes('--no-build')) {
  build(`${THEIRS} with Eleventy`, 'npm', ['run', 'build'])
  // `lem build` removes nothing from its output, so a page this build no longer writes
  // would linger there and be compared as the last build left it.
  await rm(join(ROOT, OURS), { recursive: true, force: true })
  build(`${OURS} with lem build`, LEM, ['build'])
}

const ours = join(ROOT, OURS)
const theirs = join(ROOT, THEIRS)
const written = { ours: await pagesIn(ours), theirs: await pagesIn(theirs) }
const urls = rosterOf(written.ours.pages, written.theirs.pages)
const css = await bundlesIn(ours, theirs)

const xmlUrls = rosterOf(await xmlIn(ours), await xmlIn(theirs))
const stale = staleRows(EXPECTED, [...urls, ...xmlUrls])
let failures = 0
// The pages Eleventy dated, which the sitemap's classes read.
const dated = new Set<string>()
console.log()
for (const url of urls) {
  const page = { ours: await pageAt(ours, url), theirs: await pageAt(theirs, url) }
  if (page.theirs !== null && isDated(page.theirs)) dated.add(url)
  const report = comparePage({ url, ...page, css, expected: EXPECTED[url] ?? {} })
  for (const line of reportLines(report, { ours: OURS, theirs: THEIRS })) console.log(line)
  if (failed(report)) failures += 1
}

const site = JSON.parse(await readFile(join(ROOT, INPUT, '_data/site.json'), 'utf8')) as {
  url: string
}
const theirsXml = new Map<string, Uint8Array>()
for (const url of xmlUrls) {
  const bytes = await xmlAt(theirs, url)
  if (bytes !== null) theirsXml.set(url, bytes)
}
const context = {
  origin: new URL(site.url).origin,
  css,
  pages: new Set(written.theirs.pages),
  dated,
  feeds: feedsOf(theirsXml),
}
let xmlFailures = 0
console.log()
for (const url of xmlUrls) {
  const report = compareXml({
    url,
    ours: await xmlAt(ours, url),
    theirs: theirsXml.get(url) ?? null,
    context,
    expected: EXPECTED[url] ?? {},
  })
  for (const line of xmlReportLines(report, { ours: OURS, theirs: THEIRS }))
    console.log(line)
  if (failed(report)) xmlFailures += 1
}

const entries = await entriesIn(join(ROOT, INPUT))
const scripts = compareScripts(
  await scriptsIn(ours, entries),
  await scriptsIn(theirs, entries)
)
console.log()
for (const line of scriptLines(scripts, { ours: OURS, theirs: THEIRS })) console.log(line)

console.log()
for (const url of stale) {
  console.error(
    `FAIL: bin/parity/expected.ts has a row for ${url}, where neither build wrote a page`
  )
}
for (const [side, dist] of [
  ['ours', OURS],
  ['theirs', THEIRS],
] as const) {
  for (const path of written[side].strays) {
    console.error(`FAIL: ${dist} has ${path}, which is no page: only an index.html is one`)
  }
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
if (scriptsFailed(scripts)) {
  console.error('FAIL: the client scripts differ, listed above')
}
if (
  stale.length > 0 ||
  written.ours.strays.length + written.theirs.strays.length > 0 ||
  urls.length === 0 ||
  failures > 0 ||
  xmlUrls.length === 0 ||
  xmlFailures > 0 ||
  scriptsFailed(scripts)
) {
  process.exitCode = 1
} else {
  console.log(
    `PASS: ${urls.length} pages and ${xmlUrls.length} XML files, every difference in a ` +
      `named class at its count, and ${scripts.identical} script files byte for byte`
  )
}
