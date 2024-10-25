import { build } from 'esbuild'
import { wasmLoader } from 'esbuild-plugin-wasm'
import { globby } from 'globby'
import { basename, join, sep, parse } from 'node:path'

const entryPoints = await globby(['src/**/index.ts', 'src/**/worker.ts', 'www/**/index.ts'])

await Promise.all(
  entryPoints.map(async (entryPoint) => {
    const lib = parse(entryPoint).dir.split(sep).pop()
    const outfile = entryPoint.startsWith('www')
      ? join('dist', parse(entryPoint).dir, `${basename(entryPoint, '.ts')}.js`)
      : join('dist/www/assets/js', lib, `${basename(entryPoint, '.ts')}.js`)

    await build({
      entryPoints: [entryPoint],
      external: ['/assets/js/*'],
      outfile,
      bundle: true,
      format: 'esm',
      minify: true,
      sourcemap: true,
      plugins: [wasmLoader()],
    })
  })
)
