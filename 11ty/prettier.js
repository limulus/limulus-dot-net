import { format } from 'prettier'

/** @param {import("@11ty/eleventy").UserConfig} eleventyConfig */
export default function prettierPlugin(eleventyConfig) {
  eleventyConfig.addTransform('prettier', async function (content) {
    try {
      if (this.page.outputPath.endsWith('.html')) {
        content = await format(content, { parser: 'html' })
      }
    } catch (error) {
      console.warn(`Error formatting ${this.page.inputPath}: ${error.message}`)
    }
    return content
  })
}
