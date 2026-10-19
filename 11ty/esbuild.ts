import type { UserConfig } from '@11ty/eleventy'
import { build } from 'esbuild'
import { wasmLoader } from 'esbuild-plugin-wasm'
import { globby } from 'globby'
import { createHash } from 'node:crypto'
import { mkdir, writeFile } from 'node:fs/promises'
import { basename, dirname, relative } from 'node:path'

const BASE32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'

export default async function (eleventyConfig: UserConfig): Promise<void> {
  eleventyConfig.addWatchTarget('www/**/*.ts')

  let hashes: Record<string, string> | undefined

  eleventyConfig.on(
    'eleventy.before',
    async function ({ outputMode }: { outputMode: string }) {
      if (outputMode === 'json') return
      hashes = await bundle(await globby(['www/**/index.ts', 'www/**/worker.ts']))
    }
  )

  eleventyConfig.addTransform('esbuild-translate-hashes', function (content) {
    const bundleHashes = hashes
    if (!bundleHashes) return content
    return (
      translateHashes(
        this.page.inputPath,
        this.page.url,
        (path) => bundleHashes[path],
        content
      ) ?? content
    )
  })

  async function bundle(entryPoints: string[]): Promise<Record<string, string>> {
    const { metafile, outputFiles } = await build({
      assetNames: 'assets/immutable/11ty/esbuild/[name].[hash]',
      bundle: true,
      define: {
        'process.env.MAPBOX_PUBLIC_TOKEN': JSON.stringify(process.env.MAPBOX_PUBLIC_TOKEN),
      },
      entryNames: '[dir]/[name].XXXXXXXX',
      entryPoints,
      external: ['/lib/*'],
      format: 'esm',
      metafile: true,
      minify: true,
      outbase: 'www',
      outdir: 'dist/www',
      plugins: [wasmLoader()],
      sourcemap: true,
      write: false,
    })

    const files = new Map(outputFiles.map((file) => [relative('.', file.path), file]))
    const entries = Object.entries(metafile.outputs).reduce(
      (acc: Record<string, string>, [outputPath, outputInfo]) => {
        if (outputInfo.entryPoint) {
          acc[outputInfo.entryPoint.replace(/^www/, '').replace(/\.ts$/, '.js')] =
            outputPath
        }
        return acc
      },
      {}
    )

    const output = new Map<string, string | Uint8Array>()
    const hashes: Record<string, string> = {}
    const naming: string[] = []

    // A bundle's name follows its final content: its JS, with the names of the bundles it
    // references filled in (so those are named first), and its source map.
    const hashBundle = (base: string): string => {
      if (hashes[base]) return hashes[base]
      if (naming.includes(base)) {
        throw new Error(`Circular bundle references: ${[...naming, base].join(' -> ')}`)
      }
      naming.push(base)

      const outputPath = entries[base]
      const sourceMappingURL = `//# sourceMappingURL=${basename(outputPath)}.map\n`
      let js = files.get(outputPath)!.text
      js =
        translateHashes(
          outputPath,
          base,
          (path) => (entries[path] ? hashBundle(path) : undefined),
          js
        ) ?? js
      if (!js.endsWith(sourceMappingURL)) {
        throw new Error(`Expected ${outputPath} to end with ${sourceMappingURL.trim()}`)
      }

      // esbuild-plugin-wasm names its modules by absolute path; make those relative to the
      // map, like its other sources, so the map is the same wherever the site is built
      const map = files
        .get(`${outputPath}.map`)!
        .text.replaceAll(`${process.cwd()}/`, `${relative(dirname(outputPath), '.')}/`)

      const hash = contentHash(js, map)
      const hashedPath = outputPath.replace(/\.X{8}\.js$/, `.${hash}.js`)
      output.set(
        hashedPath,
        js.slice(0, -sourceMappingURL.length) +
          `//# sourceMappingURL=${basename(hashedPath)}.map\n`
      )
      output.set(`${hashedPath}.map`, map)
      output.set(
        `dist/www${base}`,
        `export * from '${base.replace(/\.js$/, `.${hash}.js`)}'`
      )

      naming.pop()
      hashes[base] = hash
      return hash
    }

    Object.keys(entries).forEach(hashBundle)

    const entryOutputs = Object.values(entries).flatMap((path) => [path, `${path}.map`])
    for (const [path, file] of files) {
      if (!entryOutputs.includes(path)) output.set(path, file.contents)
    }

    await Promise.all(
      [...output].map(async ([path, content]) => {
        await mkdir(dirname(path), { recursive: true })
        await writeFile(path, content)
      })
    )

    return hashes
  }

  function translateHashes(
    inputPath: string,
    base: string,
    hashFor: (path: string) => string | undefined,
    content: string
  ): string | undefined {
    let matched = false

    content = content.replace(/(["'])([^"']+\.X{8}\.js)\1/g, (match, del, path) => {
      path = path.replace(/\.X{8}\.js$/, '.js')
      const hash = hashFor(new URL(path, `http://example.com${base}`).pathname)
      if (hash) {
        matched = true
        return `${del}${path.replace(/\.js$/, `.${hash}.js`)}${del}`
      } else {
        throw new Error(`Could not find hash for ${match} found in ${inputPath}`)
      }
    })

    return matched ? content : undefined
  }
}

// The first 8 characters of the RFC 4648 base32 encoding of the contents' SHA-256
function contentHash(...contents: string[]): string {
  const sha256 = createHash('sha256')
  contents.forEach((content) => sha256.update(content))
  const bits = sha256.digest().readUIntBE(0, 5)
  let hash = ''
  for (let i = 7; i >= 0; i--) hash += BASE32[Math.floor(bits / 32 ** i) % 32]
  return hash
}
