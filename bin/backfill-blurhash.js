#!/usr/bin/env node

import { encode as encodeBlurHash } from 'blurhash'
import fs from 'fs/promises'
import path from 'path'
import sharp from 'sharp'

const photosJsonPath = path.resolve(process.cwd(), 'www/_data/photos.json')

async function generateBlurHash(imageBuffer) {
  // Get image data as RGB pixels
  const { data, info } = await sharp(imageBuffer)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })

  // Convert to format needed by blurhash
  const pixels = new Uint8ClampedArray(data)

  // Generate blurhash (5x4 components provides a good balance between size and quality)
  return encodeBlurHash(pixels, info.width, info.height, 4, 3)
}

async function main() {
  // Load photos.json
  console.log(`Loading ${photosJsonPath}...`)
  const photosJson = JSON.parse(await fs.readFile(photosJsonPath, 'utf8'))

  // Get all photo objects (filter out string values which are alias mappings)
  const photoObjects = Object.values(photosJson).filter(
    (photo) => typeof photo === 'object' && photo !== null
  )

  console.log(`Found ${photoObjects.length} photos to process`)

  // Process each photo
  for (const [index, photo] of photoObjects.entries()) {
    console.log(
      `Processing photo ${index + 1}/${photoObjects.length}: ${photo.id} (${photo.title})`
    )

    try {
      // Find the sm/avif rendition
      const rendition = photo.renditions.find((r) => r.name === 'sm' && r.format === 'avif')

      if (!rendition) {
        console.warn(`No lg/avif rendition found for photo ${photo.id} (${photo.title})`)
        continue
      }

      // Fetch the image
      console.log(`Fetching ${rendition.url}...`)
      const response = await fetch(rendition.url)
      if (!response.ok) {
        console.error(`Failed to fetch image: ${response.status} ${response.statusText}`)
        continue
      }

      const imageBuffer = Buffer.from(await response.arrayBuffer())

      // Generate blurhash
      console.log('Generating blurhash...')
      const blurhash = await generateBlurHash(imageBuffer)

      // Update photos.json
      photosJson[photo.id].blurhash = blurhash
      console.log(`Added/updated blurhash for ${photo.id}: ${blurhash}`)
    } catch (error) {
      console.error(`Error processing photo ${photo.id} (${photo.title}):`, error)
    }
  }

  // Write updated photos.json
  console.log('Writing updated photos.json...')
  await fs.writeFile(photosJsonPath, JSON.stringify(photosJson, null, 2) + '\n')

  console.log('Done!')
}

main().catch(console.error)
