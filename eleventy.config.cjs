const { EleventyHtmlBasePlugin } = require('@11ty/eleventy')
const { eleventyImagePlugin } = require('@11ty/eleventy-img')
const pluginRss = require('@11ty/eleventy-plugin-rss')
const pluginWebc = require('@11ty/eleventy-plugin-webc')
const hljs = require('highlight.js')
const markdownIt = require('markdown-it')
const markdownItAnchor = require('markdown-it-anchor')
const markdownItAttrs = require('markdown-it-attrs')
const markdownItFootnote = require('markdown-it-footnote')
const markdownItTaskLists = require('markdown-it-task-lists')

/** @param {import("@11ty/eleventy").UserConfig} eleventyConfig */
module.exports = function (eleventyConfig) {
  const input = 'www'
  const output = 'dist/www'
  const layouts = '_includes/layouts'
  const components = [
    'npm:@11ty/eleventy-img/*.webc',
    `${input}/_includes/components/**/*.webc`,
  ]

  eleventyConfig.addGlobalData('site', { url: 'https://limulus.net/penumbra' })

  eleventyConfig.addPassthroughCopy(`${input}/assets`, { expand: true })
  eleventyConfig.addPassthroughCopy(`${input}/**/*.{png,svg,jpg,jpeg}`)

  eleventyConfig.addPlugin(EleventyHtmlBasePlugin)
  eleventyConfig.addPlugin(pluginRss)
  eleventyConfig.addPlugin(pluginWebc, { components })

  eleventyConfig.addPlugin(eleventyImagePlugin, {
    formats: ['avif', 'jpeg'],
    outputDir: `${output}/assets/images/`,
    urlPath: `/assets/images/`,
    defaultAttributes: {
      loading: 'lazy',
      decoding: 'async',
      sizes: '100vw',
    },
  })

  const md = markdownIt({
    html: true,
    linkify: true,
    highlight: (str, language) => {
      if (language && hljs.getLanguage(language)) {
        return (
          '<pre><code class="hljs">' +
          hljs.highlight(str, { language, ignoreIllegals: true }).value +
          '</code></pre>'
        )
      }
      return '' // use external default escaping
    },
  })
  md.use(markdownItFootnote)
  md.use(markdownItTaskLists)
  md.use(markdownItAttrs)
  md.use(markdownItAnchor)
  eleventyConfig.setLibrary('md', md)

  eleventyConfig.setServerOptions({
    domDiff: false,
    middleware: [
      (_req, res, next) => {
        res.setHeader('Cross-Origin-Opener-Policy', 'same-origin')
        res.setHeader('Cross-Origin-Embedder-Policy', 'require-corp')
        next()
      },
    ],
    watch: ['dist/assets/**/*.{css,js}'],
  })

  return { dir: { input, output, layouts }, pathPrefix: '/penumbra/' }
}
