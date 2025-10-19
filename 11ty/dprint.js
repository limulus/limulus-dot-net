import { createFromBuffer } from '@dprint/formatter'
import fs from 'node:fs'
import { fileURLToPath } from 'node:url'

let formatterPromise

/** @param {import("@11ty/eleventy").UserConfig} eleventyConfig */
export default function dprintPlugin(eleventyConfig) {
  // Initialize the Wasm formatter once (lazy load on first use)
  const getFormatter = async () => {
    if (!formatterPromise) {
      formatterPromise = (async () => {
        // Load the wasm file from the npm package using module resolution
        const wasmPath = fileURLToPath(
          import.meta.resolve('dprint-plugin-markup/plugin.wasm')
        )
        const buffer = fs.readFileSync(wasmPath)
        const formatter = createFromBuffer(buffer)
        formatter.setConfig({ lineWidth: 92 }, {})
        return formatter
      })()
    }
    return formatterPromise
  }

  eleventyConfig.addTransform('dprint', async function (content) {
    try {
      if (this.page.outputPath.endsWith('.html')) {
        try {
          const formatter = await getFormatter()
          content = formatter.formatText({
            filePath: 'index.html',
            fileText: content,
          })
        } catch (error) {
          // Log warning but return unformatted content to continue the build
          console.warn(
            `dprint formatting failed for ${this.page.inputPath}: ${error.message}`
          )
        }
      }
    } catch (error) {
      console.warn(`Error in dprint transform ${this.page.inputPath}: ${error.message}`)
    }
    return content
  })
}
