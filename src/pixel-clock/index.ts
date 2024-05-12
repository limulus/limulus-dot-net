import { PixelClockMessage, PixelClockMessageType } from './messages.js'

export class PixelClock extends HTMLElement {
  worker: Worker | null = null

  connectedCallback() {
    this.attachShadow({ mode: 'open' })
    if (!this.shadowRoot) throw new Error('Shadow root not found')

    this.shadowRoot.innerHTML = /* HTML */ `
      <style>
        canvas {
          border: 1px solid black;
        }

        @media (prefers-color-scheme: dark) {
          canvas {
            border-color: white;
          }
        }
      </style>
      <canvas width="300" height="300"></canvas>
    `

    const canvas = this.shadowRoot.querySelector('canvas') as HTMLCanvasElement
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('Could not get canvas context')
    ctx.imageSmoothingEnabled = false

    this.worker = new Worker(new URL('./worker.js', import.meta.url))
    this.worker.addEventListener('message', (event: MessageEvent<PixelClockMessage>) => {
      switch (event.data.type) {
        case PixelClockMessageType.Frame:
          ctx.drawImage(event.data.bitmap, 0, 0, canvas.width, canvas.height)
          break
        default:
          throw new Error(`Unhandled message type: ${event.data.type}`)
      }
    })
    this.worker.postMessage({ type: 'init', width: 100, height: 100 })
  }

  disconnectedCallback() {
    this.worker?.terminate()
  }
}
