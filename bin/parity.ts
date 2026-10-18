// `npm run parity`: builds the site both ways — Eleventy to dist/www, `lem build` to
// dist/lemmon — and compares every page either build wrote, each `index.html` under
// either dist, as rendered HTML (lemmon's D28), through the forgiveness classes in
// bin/parity/, with both builds' CSS bundles read beside the global stylesheets for
// css-bundle and the photos' titles from www/_lemmon/photos.json for photo-list-heading.
// Each page reports every difference no class explains, why a class refused one where it
// says, how often each class fired, and what matched. Then the client scripts both
// builds bundled — every file esbuild writes for an `index.ts` or `worker.ts` under
// www/, and its assets — are compared byte for byte, Eleventy's unhashed stubs set aside
// and counted (bin/parity/scripts.ts). The run exits 1 on any unexplained difference,
// any class firing other than its count in EXPECTED, a row there for a url no page
// compared has, an `.html` file in either dist that is no `index.html`, a page one build
// lacks, or a script file one build lacks or writes differently.
//
//   npm run parity [-- --no-build]     --no-build compares the dists already there
//
// npm runs it as `node --conditions=source`: @limulus/lemmon-shell is a file: link to
// the lemmon checkout, and the `source` export condition loads its src/ (and core's)
// directly, as the `lem` bin does, so the comparator needs no `npm run build` there.

import { spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { rm } from 'node:fs/promises'
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
  photoTitlesIn,
  reportLines,
  rosterOf,
  staleRows,
} = await import('./parity/check.ts')
const { compareScripts, entriesIn, scriptLines, scriptsFailed, scriptsIn } = await import(
  './parity/scripts.ts'
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
const titles = await photoTitlesIn(join(ROOT, INPUT))

const stale = staleRows(EXPECTED, urls)
let failures = 0
console.log()
for (const url of urls) {
  const report = comparePage({
    url,
    ours: await pageAt(ours, url),
    theirs: await pageAt(theirs, url),
    css,
    titles,
    expected: EXPECTED[url] ?? {},
  })
  for (const line of reportLines(report, { ours: OURS, theirs: THEIRS })) console.log(line)
  if (failed(report)) failures += 1
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
if (scriptsFailed(scripts)) {
  console.error('FAIL: the client scripts differ, listed above')
}
if (
  stale.length > 0 ||
  written.ours.strays.length + written.theirs.strays.length > 0 ||
  urls.length === 0 ||
  failures > 0 ||
  scriptsFailed(scripts)
) {
  process.exitCode = 1
} else {
  console.log(
    `PASS: ${urls.length} pages, every difference in a named class at its count, ` +
      `and ${scripts.identical} script files byte for byte`
  )
}
