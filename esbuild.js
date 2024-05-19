import { build } from 'esbuild'
import { wasmLoader } from 'esbuild-plugin-wasm'
import { globby } from 'globby'
import { basename, join, sep, parse } from 'node:path'

const outdir = 'dist/www/assets/js'
const entryPoints = await globby(['src/**/index.ts', 'src/**/worker.ts'])

await Promise.all(
  entryPoints.map(async (entryPoint) => {
    const dir = parse(entryPoint).dir.split(sep).pop()
    const outfile = join(outdir, dir, `${basename(entryPoint, '.ts')}.js`)

    await build({
      entryPoints: [entryPoint],
      outfile,
      bundle: true,
      format: 'esm',
      minify: true,
      sourcemap: true,
      plugins: [wasmLoader()],
    })
  })
)
