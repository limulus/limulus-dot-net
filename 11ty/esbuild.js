import { build } from 'esbuild'
import { wasmLoader } from 'esbuild-plugin-wasm'
import { globby } from 'globby'
import { writeFile, readFile } from 'node:fs/promises'
import { resolve } from 'node:url'

/** @param {import("@11ty/eleventy").UserConfig} eleventyConfig */
export default async function (eleventyConfig) {
  eleventyConfig.addWatchTarget('www/**/*.ts')

  let hashes

  eleventyConfig.on('eleventy.before', async function () {
    hashes = await bundle(await globby(['www/**/index.ts', 'www/**/worker.ts']))
  })

  eleventyConfig.addTransform('esbuild-translate-hashes', function (content) {
    return translateHashes(this.page.inputPath, this.page.url, hashes, content) ?? content
  })

  async function bundle(entryPoints) {
    const { metafile } = await build({
      assetNames: 'assets/immutable/11ty/esbuild/[name].[hash]',
      bundle: true,
      define: {
        'process.env.MAPBOX_PUBLIC_TOKEN': JSON.stringify(process.env.MAPBOX_PUBLIC_TOKEN),
      },
      entryNames: '[dir]/[name].[hash]',
      entryPoints,
      external: ['/lib/*'],
      format: 'esm',
      metafile: true,
      minify: true,
      outbase: 'www',
      outdir: 'dist/www',
      plugins: [wasmLoader()],
      sourcemap: true,
    })

    const hashes = Object.entries(metafile.outputs).reduce(
      (acc, [outputPath, outputInfo]) => {
        if (outputInfo.entryPoint) {
          acc[outputInfo.entryPoint.replace(/^www/, '').replace(/\.ts$/, '.js')] =
            outputPath.match(/\.([^.]+)\.js$/)[1]
        }
        return acc
      },
      {}
    )

    await Promise.all([
      ...Object.entries(hashes).map(async ([path, hash]) => {
        const content = `export * from '${path.replace(/\.js$/, `.${hash}.js`)}'`
        await writeFile(`dist/www${path}`, content)
      }),

      ...Object.entries(hashes).map(async ([base, hash]) => {
        const filePath = `dist/www${base.replace(/\.js$/, `.${hash}.js`)}`
        let content = await readFile(filePath, 'utf-8')
        content = translateHashes(filePath, base, hashes, content)
        if (content) {
          await writeFile(filePath, content)
        }
      }),
    ])

    return hashes
  }

  function translateHashes(inputPath, base, hashes, content) {
    let matched = false

    content = content.replace(/(["'])([^"']+\.X{8}\.js)\1/g, (match, del, path) => {
      path = path.replace(/\.X{8}\.js$/, '.js')
      const hash = hashes[resolve(base, path)]
      if (hash) {
        matched = true
        return `${del}${path.replace(/\.js$/, `.${hash}.js`)}${del}`
      } else {
        throw new Error(`Could not find hash for ${match} found in ${inputPath}`)
      }
    })

    if (matched) {
      return content
    }
  }
}
