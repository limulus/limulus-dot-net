/// <reference lib="webworker" />

import '../raf-polyfill.js'

import { SphereShadowRenderer } from '@limulus/penumbra/wasm/simd'

import {
  SphereShadowInitMessage,
  SphereShadowFrameMessage,
  SphereShadowMessageType,
  SphereShadowLightTranslateMessage,
} from './messages.js'

let renderer: SphereShadowRenderer
let dirty = true

self.postMessage({ type: SphereShadowMessageType.Ready })

self.onmessage = (event) => {
  switch (event.data.type) {
    case SphereShadowMessageType.Init:
      handleInitMessage(event.data)
      break
    case SphereShadowMessageType.LightTranslate:
      handleLightTranslateMessage(event.data)
      break
    default:
      throw new Error(`Unhandled message type: ${event.data.type}`)
  }
}

async function handleInitMessage(message: SphereShadowInitMessage) {
  renderer = new SphereShadowRenderer(message.width, message.height, 7)
  dirty = true
  self.requestAnimationFrame(handleRequestAnimationFrame)
}

function handleLightTranslateMessage(message: SphereShadowLightTranslateMessage) {
  renderer.translate_light_relative_to_canvas_pos(message.x, message.y)
  dirty = true
}

async function handleRequestAnimationFrame(_time: number) {
  if (dirty) {
    const t0 = performance.now()
    renderer.render()
    await sendCanvas(performance.now() - t0)
    dirty = false
  }
  self.requestAnimationFrame(handleRequestAnimationFrame)
}

async function sendCanvas(renderTime: number) {
  const bitmap = await createImageBitmap(renderer.to_image_data())
  const response: SphereShadowFrameMessage = {
    type: SphereShadowMessageType.Frame,
    bitmap,
    renderTime,
  }
  self.postMessage(response, [bitmap])
}
