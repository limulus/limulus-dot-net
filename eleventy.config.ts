import 'dotenv/config'

import { EleventyRenderPlugin } from '@11ty/eleventy'
import type { UserConfig } from '@11ty/eleventy'
import { feedPlugin } from '@11ty/eleventy-plugin-rss'
import pluginWebc from '@11ty/eleventy-plugin-webc'
import svgSprite from 'eleventy-plugin-svg-sprite'
import hljs from 'highlight.js'
import markdownIt from 'markdown-it'
import markdownItAnchor from 'markdown-it-anchor'
import markdownItAttrs from 'markdown-it-attrs'
import markdownItFootnote from 'markdown-it-footnote'
import markdownItTaskLists from 'markdown-it-task-lists'

import dprintPlugin from './11ty/dprint.ts'
import esbuild from './11ty/esbuild.ts'

export default function (eleventyConfig: UserConfig) {
  const input = 'www'
  const output = 'dist/www'
  const layouts = '_includes/layouts'
  const components = [`${input}/_includes/components/**/*.webc`]

  eleventyConfig.addPassthroughCopy(
    `{${input}/assets/**/*,${input}/**/*.{png,svg,jpg,jpeg,xsd,xsl,txt,pdf}}`,
    { expand: true }
  )

  eleventyConfig.addPlugin(svgSprite, [
    {
      path: `${input}/assets/svg/common`,
      svgSpriteShortcode: 'svgspriteCommon',
    },
    {
      path: `${input}/assets/svg/photos`,
      svgSpriteShortcode: 'svgspritePhotos',
    },
  ])

  eleventyConfig.addPlugin(EleventyRenderPlugin, { accessGlobalData: true })
  eleventyConfig.addPlugin(pluginWebc, {
    bundlePluginOptions: { toFileDirectory: 'assets/immutable/11ty/bundle/' },
    components,
  })

  const addFeed = (
    type: string,
    outputPath: string,
    collection: string,
    metadata: {
      title: string
      subtitle: string
      base: string
    },
    options: Record<string, unknown> = {}
  ): void => {
    eleventyConfig.addPlugin(feedPlugin, {
      type,
      outputPath,
      collection: { name: collection, limit: 0 },
      metadata: {
        language: 'en',
        author: { name: 'Eric McCarthy', email: 'eric@limulus.net' },
        ...metadata,
      },
      ...options,
    })
  }

  addFeed(
    'rss',
    '/feed.xml',
    'article',
    {
      title: 'limulus.net',
      subtitle: 'Every article on limulus.net.',
      base: 'https://limulus.net',
    },
    { stylesheet: '/feed.xsl' }
  )

  addFeed('atom', '/penumbra/feed.xml', 'penumbra', {
    title: 'Penumbra Development Journal',
    subtitle: 'Tracking the development of Penumbra, a web-centric ray tracer.',
    base: 'https://limulus.net/penumbra',
  })

  addFeed('atom', '/tils/feed.xml', 'til', {
    title: "Eric's TILs",
    subtitle: 'Short notes on things I learn day to day.',
    base: 'https://limulus.net/tils',
  })

  // Get all unique TIL topics for pagination
  eleventyConfig.addCollection('tilTopics', (collectionApi) => {
    const topics = new Set<string>()
    collectionApi.getFilteredByTag('til').forEach((item) => {
      if (item.data.tilTopic) {
        topics.add(item.data.tilTopic)
      }
    })
    return Array.from(topics).sort()
  })

  const md = markdownIt({
    html: true,
    highlight: (str: string, language: string) => {
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
  const config = eleventyConfig as UserConfig & {
    addPreprocessor(
      name: string,
      ext: string,
      fn: (data: Record<string, any>, content: string) => string | void
    ): void
  }

  config.addPreprocessor(
    'linkPostContent',
    'md',
    (data: Record<string, any>, content: string) => {
      if (!data.linkUrl) return

      content += `\n\n[link]: ${data.linkUrl}`

      if (data.viaUrl) {
        content += `\n[via]: ${data.viaUrl}`
        const viaDomain = new URL(data.viaUrl as string).hostname.replace(/^www\./, '')
        content += `\n\n<p class="via">Via <a href="${data.viaUrl}">${viaDomain}</a>.</p>`
      }

      return content
    }
  )

  eleventyConfig.addPlugin(esbuild)
  eleventyConfig.addPlugin(dprintPlugin)

  eleventyConfig.addShortcode(
    'getPhoto',
    function (this: { $data: { photos: Record<string, any> } }, id: string) {
      const { photos } = this.$data
      const photo = typeof photos[id] === 'string' ? photos[photos[id]] : photos[id]
      if (!photo) {
        throw new Error(`Photo with id "${id}" not found.`)
      }
      return photo
    }
  )

  eleventyConfig.setServerOptions({
    middleware: [
      (_req, res, next) => {
        res.setHeader('Cross-Origin-Opener-Policy', 'same-origin')
        res.setHeader('Cross-Origin-Embedder-Policy', 'require-corp')
        next()
      },
    ],
    port: process.env.PORT ?? 8080,
  })
  eleventyConfig.setServerPassthroughCopyBehavior('passthrough')

  return { dir: { input, output, layouts } }
}
