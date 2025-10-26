import Eleventy from '@11ty/eleventy'
import { beforeAll, describe, test, expect } from 'vitest'

let renderedPages: Map<string, string> | null = null

async function prerenderPages(): Promise<Map<string, string>> {
  if (renderedPages !== null) {
    return renderedPages
  }

  const eleventy = new Eleventy('.', 'dist/www', { quietMode: true })
  const json = await eleventy.toJSON()

  renderedPages = new Map()
  for (const entry of json) {
    if (entry.outputPath?.endsWith('.html')) {
      renderedPages.set(entry.url, entry.content)
    }
  }

  return renderedPages
}

beforeAll(async () => {
  await prerenderPages()
})

describe('page snapshots', () => {
  const pages = [
    {
      name: 'home',
      url: '/',
      description: 'Home page with overview sections',
    },
    {
      name: 'eric',
      url: '/eric/',
      description: 'About page with bio and recent posts',
    },
    {
      name: 'feed-index',
      url: '/feed/',
      description: 'Article listing page',
    },
    {
      name: 'article-text',
      url: '/feed/write-to-your-rep/',
      description: 'Standard text article',
    },
    {
      name: 'article-the-rebound',
      url: '/feed/the-rebound/',
      description: 'Article with positional images',
    },
    {
      name: 'article-video',
      url: '/feed/new-york-2024/',
      description: 'Article with video player',
    },
    {
      name: 'penumbra-index',
      url: '/penumbra/',
      description: 'Penumbra development journal index',
    },
    {
      name: 'article-penumbra',
      url: '/penumbra/journal/tuples/',
      description: 'Penumbra article with interactive demo',
    },
    {
      name: 'tils-index',
      url: '/tils/',
      description: 'TILs listing and topic navigation',
    },
    {
      name: 'til-article',
      url: '/tils/git/private-branches-in-public-repos/',
      description: 'TIL article',
    },
    {
      name: 'til-topic',
      url: '/tils/git/',
      description: 'TIL topic page with filtered articles',
    },
    {
      name: 'photos-index',
      url: '/photos/',
      description: 'Photo gallery index',
    },
    {
      name: 'photo-detail',
      url: '/photos/eric-on-his-honeymoon-maui-hawaii/',
      description: 'Individual photo page',
    },
    {
      name: '404',
      url: '/404/',
      description: 'Error page',
    },
  ]

  test.each(pages)('$name: $description', async ({ url, name }) => {
    const pagesMap = await prerenderPages()
    const html = pagesMap.get(url)
    if (!html) {
      throw new Error(`Page not found: ${url}`)
    }
    await expect(html).toMatchFileSnapshot(`./${name}.html`)
  })
})
