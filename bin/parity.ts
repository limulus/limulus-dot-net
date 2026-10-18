// `npm run parity`: builds the site both ways — Eleventy to dist/www, `lem build` to
// dist/lemmon — and compares the page of every article, each markdown document under
// www/feed/, links/, penumbra/ and tils/, as rendered HTML (lemmon's D28), through the
// forgiveness classes in bin/parity/, with both builds' CSS bundles read beside the
// global stylesheets for css-bundle. Each page reports every difference no class
// explains, why a class refused one where it says, how often each class fired, and what
// matched; the run exits 1 on any unexplained difference, any class firing other than its
// count in bin/parity/expected.ts, a row there for a url no document has, or a page one
// build lacks.
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
  documentsIn,
  failed,
  pageAt,
  reportLines,
  SECTIONS,
  staleRows,
} = await import('./parity/check.ts')

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
const urls = await documentsIn(join(ROOT, INPUT))
const css = await bundlesIn(ours, theirs)

const stale = staleRows(EXPECTED, urls)
let failures = 0
console.log()
for (const url of urls) {
  const report = comparePage({
    url,
    ours: await pageAt(ours, url),
    theirs: await pageAt(theirs, url),
    css,
    expected: EXPECTED[url] ?? {},
  })
  for (const line of reportLines(report, { ours: OURS, theirs: THEIRS })) console.log(line)
  if (failed(report)) failures += 1
}

console.log()
for (const url of stale) {
  console.error(`FAIL: bin/parity/expected.ts has a row for ${url}, which no document has`)
}
if (urls.length === 0) {
  console.error(`FAIL: no document under ${INPUT}/{${SECTIONS.join(',')}}/`)
}
if (failures > 0) {
  console.error(`FAIL: ${failures} of ${urls.length} documents differ, listed above`)
}
if (stale.length > 0 || urls.length === 0 || failures > 0) {
  process.exitCode = 1
} else {
  console.log(
    `PASS: ${urls.length} documents, every difference in a named class at its count`
  )
}
