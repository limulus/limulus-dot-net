import { build } from 'esbuild'

const entryPoints = ['src/**/index.ts', 'src/**/worker.ts']
const outdir = 'dist/www/assets/js'

for (const entryPoint of entryPoints) {
  const format = entryPoint.includes('worker.ts') ? 'iife' : 'esm'

  await build({
    entryPoints: [entryPoint],
    outdir,
    bundle: true,
    format,
    minify: true,
    sourcemap: true,
  })
}
