/// <reference lib="webworker" />

import '../raf-polyfill.js'

import { Canvas, Matrix, Tuple } from '@limulus/penumbra'

import {
  PixelClockFrameMessage,
  PixelClockInitMessage,
  PixelClockMessage,
  PixelClockMessageType,
} from './messages.js'

self.onmessage = (event: MessageEvent<PixelClockMessage>) => {
  switch (event.data.type) {
    case PixelClockMessageType.Init:
      handleInitMessage(event.data)
      break
    default:
      throw new Error(`Unhandled message type: ${event.data.type}`)
  }
}

let canvas: Canvas

async function handleInitMessage(message: PixelClockInitMessage) {
  canvas = new Canvas(message.width, message.height)
  precalculateHourDots()
  self.requestAnimationFrame(handleRequestAnimationFrame)
}

let lastFrameTime = 0

async function handleRequestAnimationFrame(time: number) {
  // Cap the frame rate at 10 FPS
  if (time - lastFrameTime > 100) {
    lastFrameTime = time
    renderClock(performance.timeOrigin + time)
    const bitmap = await createImageBitmap(canvas.toImageData())
    const response: PixelClockFrameMessage = {
      type: PixelClockMessageType.Frame,
      bitmap,
    }
    self.postMessage(response, [bitmap])
  }
  self.requestAnimationFrame(handleRequestAnimationFrame)
}

const hourDots: Tuple[] = []

function precalculateHourDots() {
  const clockRadius = (canvas.width * 3) / 8
  for (let i = 0; i < 12; i++) {
    const hourDotTransform = Matrix.transformation()
      .translate(0, 1, 0)
      .rotateZ(-(i * 2 * Math.PI) / 12)
      .scale(clockRadius, -clockRadius, 0)
      .translate(canvas.width / 2, canvas.height / 2, 0)
    hourDots.push(hourDotTransform.mul(Tuple.point(0, 0, 0)))
  }
}

function renderClock(time: number) {
  const now = new Date(time)
  renderBackgroundGradient()
  renderHourDots()
  renderSecondHand(now)
  renderMinuteHand(now)
  renderHourHand(now)
}

function renderBackgroundGradient() {
  for (let y = 0; y < canvas.height; y++) {
    const yRatio = (canvas.height - y) / canvas.height / 1.3333
    for (let x = 0; x < canvas.width; x++) {
      const xRatio = (canvas.width - x) / canvas.width / 1.3333
      canvas.writePixel(x, y, xRatio, yRatio, 0.6666)
    }
  }
}

function renderHourDots() {
  for (const hourDot of hourDots) {
    canvas.writePixel(hourDot.x, hourDot.y, 1, 1, 1)
  }
}

function renderSecondHand(now: Date) {
  const millisecondsSinceStartOfMinute = now.getMilliseconds() + now.getSeconds() * 1000
  const secondHandLength = (canvas.width * 5) / 16
  const secondHandTransform = Matrix.transformation()
    .translate(0, 1, 0)
    .rotateZ(-(millisecondsSinceStartOfMinute * 2 * Math.PI) / 60000)
    .scale(secondHandLength, -secondHandLength, 0)
    .translate(canvas.width / 2, canvas.height / 2, 0)
  const secondHand = secondHandTransform.mul(Tuple.point(0, 0, 0))
  canvas.writePixel(secondHand.x, secondHand.y, 1, 1, 1)
}

function renderMinuteHand(now: Date) {
  const millisecondsSinceStartOfHour =
    now.getMilliseconds() + now.getSeconds() * 1000 + now.getMinutes() * 60 * 1000
  const minuteHandLength = (canvas.width * 4) / 16
  const minuteHandTransform = Matrix.transformation()
    .translate(0, 1, 0)
    .rotateZ(-(millisecondsSinceStartOfHour * 2 * Math.PI) / 3600000)
    .scale(minuteHandLength, -minuteHandLength, 0)
    .translate(canvas.width / 2, canvas.height / 2, 0)
  const minuteHand = minuteHandTransform.mul(Tuple.point(0, 0, 0))
  canvas.writePixel(minuteHand.x, minuteHand.y, 1, 1, 1)
}

function renderHourHand(now: Date) {
  const millisecondsSinceStartOfDay =
    now.getMilliseconds() +
    now.getSeconds() * 1000 +
    now.getMinutes() * 60 * 1000 +
    now.getHours() * 60 * 60 * 1000
  const hourHandLength = (canvas.width * 3) / 16
  const hourHandTransform = Matrix.transformation()
    .translate(0, 1, 0)
    .rotateZ(-(millisecondsSinceStartOfDay * 2 * Math.PI) / 43200000)
    .scale(hourHandLength, -hourHandLength, 0)
    .translate(canvas.width / 2, canvas.height / 2, 0)
  const hourHand = hourHandTransform.mul(Tuple.point(0, 0, 0))
  canvas.writePixel(hourHand.x, hourHand.y, 1, 1, 1)
}
