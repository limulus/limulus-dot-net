/// <reference lib="webworker" />

import { decode } from 'blurhash'

import { BlurHashDecodeMessage, BlurHashMessage, BlurHashMessageType } from './messages.js'

self.onmessage = (event: MessageEvent<BlurHashMessage>) => {
  switch (event.data.type) {
    case BlurHashMessageType.decode:
      handleDecodeMessage(event.data)
      break
    default:
      throw new Error(`Unhandled message type: ${event.data.type}`)
  }
}

async function handleDecodeMessage(message: BlurHashDecodeMessage) {
  const canvas = new OffscreenCanvas(message.width, message.height)
  const ctx = canvas.getContext('2d')
  if (!ctx) {
    throw new Error('Failed to get canvas context')
  }

  const { blurhash, width, height } = message
  const pixels = decode(blurhash, width, height) as Uint8ClampedArray<ArrayBuffer>
  const imageData = new ImageData(pixels, width, height)

  canvas.width = width
  canvas.height = height
  ctx.putImageData(imageData, 0, 0)

  const blob = await canvas.convertToBlob({ type: 'image/png' })
  const blobUrl = URL.createObjectURL(blob)

  const response: BlurHashMessage = {
    type: BlurHashMessageType.decodeResult,
    id: message.id,
    blobUrl,
  }
  self.postMessage(response)
}
