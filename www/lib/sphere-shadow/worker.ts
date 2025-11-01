/// <reference lib="webworker" />

import '../raf-polyfill.js'

import { Canvas, Sphere, Matrix, Ray, Tuple } from '@limulus/penumbra'

import {
  SphereShadowMessageType,
  type SphereShadowInitMessage,
  type SphereShadowFrameMessage,
  type SphereShadowLightTranslateMessage,
} from './messages.js'

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

let canvas: Canvas
let lightTransform: Matrix

async function handleInitMessage(message: SphereShadowInitMessage) {
  canvas = new Canvas(message.width, message.height)
  lightTransform = Matrix.identity(4)
  precomputeSensorPoints()
  precomputeBackgroundGradient()
  self.requestAnimationFrame(handleRequestAnimationFrame)
}

const light = Tuple.point(-5, 0, 0)
function handleLightTranslateMessage(message: SphereShadowLightTranslateMessage) {
  const newLightTransform = Matrix.transformation()
    .translate(0, message.y, message.x)
    .scale(1, sensorSize / canvas.height, sensorSize / canvas.width)
    .translate(0, -sensorSize / 2, -sensorSize / 2)
    .scale(1, 1.5, 1.5)
    .rotateZ((2 * Math.PI) / 2)
    .rotateY((2 * Math.PI) / 2)

  if (!lightTransform.equals(newLightTransform)) {
    lightTransform = newLightTransform
  }
}

let depsCache: any[] = []
async function handleRequestAnimationFrame(_time: number) {
  const deps = [lightTransform, canvas.width, canvas.height]
  if (!deps.every((dep, index) => dep === depsCache[index])) {
    const t0 = performance.now()
    renderSphereShadow(lightTransform.mul(light))
    await sendCanvas(performance.now() - t0)
    depsCache = deps
  }
  self.requestAnimationFrame(handleRequestAnimationFrame)
}

const sphere = new Sphere()
sphere.transform = Matrix.transformation().scale(2, 2, 2)
const sensorSize = 7
const sensorTransform = Matrix.transformation()
  .translate(-sensorSize / 2, -sensorSize / 2, 0) // Center the sensor
  .rotateX((2 * Math.PI) / 2) // Rotate 180 degrees around the x-axis to account for the canvas being upside-down
  .rotateY((1 * Math.PI) / 2) // Rotate 90 degrees around the y-axis so it faces the light

let sensorPoints: Tuple[]
function precomputeSensorPoints() {
  sensorPoints = []
  for (let i = 0; i < canvas.width; i++) {
    for (let j = 0; j < canvas.height; j++) {
      const x = (i / canvas.width) * sensorSize
      const y = (j / canvas.height) * sensorSize
      const sensorPoint = sensorTransform.mul(Tuple.point(x, y, 0))
      sensorPoints.push(sensorPoint)
    }
  }
}

let backgroundGradientCanvas: Canvas
function precomputeBackgroundGradient() {
  backgroundGradientCanvas = new Canvas(canvas.width, canvas.height)
  for (let y = 0; y < canvas.height; y++) {
    const yRatio = (canvas.height - y) / canvas.height / 1.3333
    for (let x = 0; x < canvas.width; x++) {
      const xRatio = (canvas.width - x) / canvas.width / 1.3333
      backgroundGradientCanvas.writePixel(x, y, xRatio, yRatio, 0.6666)
    }
  }
}

function renderSphereShadow(light: Tuple) {
  for (let i = 0; i < canvas.width; i++) {
    for (let j = 0; j < canvas.height; j++) {
      const sensorPoint = sensorPoints[i * canvas.height + j]
      const ray = new Ray(light, sensorPoint.sub(light).normalize())
      const intersections = sphere.intersect(ray)
      if (intersections.length > 0) {
        canvas.writePixel(i, j, 0, 0, 0)
      } else {
        canvas.writePixel(i, j, backgroundGradientCanvas.pixelAt(i, j))
      }
    }
  }
}

async function sendCanvas(renderTime: number) {
  const bitmap = await createImageBitmap(canvas.toImageData())
  const response: SphereShadowFrameMessage = {
    type: SphereShadowMessageType.Frame,
    bitmap,
    renderTime,
  }
  self.postMessage(response, [bitmap])
}
