import { EleventyRenderPlugin } from '@11ty/eleventy'
import { feedPlugin } from '@11ty/eleventy-plugin-rss'
import pluginWebc from '@11ty/eleventy-plugin-webc'
import svgSprite from 'eleventy-plugin-svg-sprite'
import hljs from 'highlight.js'
import markdownIt from 'markdown-it'
import markdownItAnchor from 'markdown-it-anchor'
import markdownItAttrs from 'markdown-it-attrs'
import markdownItFootnote from 'markdown-it-footnote'
import markdownItTaskLists from 'markdown-it-task-lists'

import esbuild from './11ty/esbuild.js'
import prettierPlugin from './11ty/prettier.js'

/** @param {import("@11ty/eleventy").UserConfig} eleventyConfig */
export default function (eleventyConfig) {
  const input = 'www'
  const output = 'dist/www'
  const layouts = '_includes/layouts'
  const components = [`${input}/_includes/components/**/*.webc`]

  eleventyConfig.addPassthroughCopy(`${input}/assets`, { expand: true })
  eleventyConfig.addPassthroughCopy(`${input}/**/*.{png,svg,jpg,jpeg,xsl}`)

  eleventyConfig.addPlugin(svgSprite, {
    path: `${input}/assets/svg/lib`,
  })

  eleventyConfig.addPlugin(EleventyRenderPlugin, { accessGlobalData: true })
  eleventyConfig.addPlugin(pluginWebc, {
    bundlePluginOptions: { toFileDirectory: 'assets/immutable/11ty/bundle/' },
    components,
  })

  eleventyConfig.addPlugin(feedPlugin, {
    type: 'rss',
    outputPath: '/feed.xml',
    collection: {
      name: 'article',
      limit: 0,
    },
    stylesheet: '/feed.xsl',
    metadata: {
      title: 'limulus.net',
      subtitle: 'Every article on limulus.net.',
      language: 'en',
      base: 'https://limulus.net',
      author: {
        name: 'Eric McCarthy',
        email: 'eric@limulus.net',
      },
    },
  })

  eleventyConfig.addPlugin(feedPlugin, {
    type: 'atom',
    outputPath: '/penumbra/feed.xml',
    collection: {
      name: 'penumbra',
      limit: 0,
    },
    metadata: {
      title: 'Penumbra Development Journal',
      subtitle: 'Tracking the development of Penumbra, a web-centric ray tracer.',
      language: 'en',
      base: 'https://limulus.net/penumbra',
      author: {
        name: 'Eric McCarthy',
        email: 'eric@limulus.net',
      },
    },
  })

  const md = markdownIt({
    html: true,
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

  eleventyConfig.addPlugin(esbuild)
  eleventyConfig.addPlugin(prettierPlugin)

  eleventyConfig.setServerOptions({
    middleware: [
      (_req, res, next) => {
        res.setHeader('Cross-Origin-Opener-Policy', 'same-origin')
        res.setHeader('Cross-Origin-Embedder-Policy', 'require-corp')
        next()
      },
    ],
    port: process.env.PORT || 8080,
  })
  eleventyConfig.setServerPassthroughCopyBehavior('passthrough')

  return { dir: { input, output, layouts } }
}
