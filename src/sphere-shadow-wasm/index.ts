import { TouchPadMoveEvent } from 'touch-pad'

import {
  SphereShadowInitMessage,
  SphereShadowFrameMessage,
  SphereShadowMessageType,
  SphereShadowLightTranslateMessage,
} from './messages.js'

const template = document.createElement('template')
template.innerHTML = /* HTML */ `
  <style>
    canvas {
      border: 1px solid black;
    }

    #hud ul {
      list-style: none;
      padding: 0;
    }

    @media (prefers-color-scheme: dark) {
      canvas {
        border-color: white;
      }
    }

    touch-pad {
      display: flex;
    }
  </style>
  <touch-pad>
    <canvas width="300" height="300"></canvas>
  </touch-pad>
  <div id="hud">
    <ul>
      <li>
        <span part="hud-label">Render time:</span>
        <code part="hud-value" id="render-time"></code>
      </li>
    </ul>
  </div>
`

export class SphereShadowWasm extends HTMLElement {
  worker: Worker | null = null

  connectedCallback() {
    const shadow = this.attachShadow({ mode: 'open' })
    shadow.appendChild(template.content.cloneNode(true))

    const canvas = shadow.querySelector('canvas')
    if (!canvas) throw new Error('Could not find canvas')

    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('Could not get canvas context')
    ctx.imageSmoothingEnabled = false

    const renderTimeEl = shadow.querySelector('#render-time')
    if (!renderTimeEl) throw new Error('Could not find render time element')

    const resolution = 100

    this.addEventListener('touchpadmove', (event) => {
      const {
        detail: { x, y },
      } = event as TouchPadMoveEvent
      const message: SphereShadowLightTranslateMessage = {
        type: SphereShadowMessageType.LightTranslate,
        x: x * resolution,
        y: y * resolution,
        z: 0,
      }
      this.worker?.postMessage(message)
    })

    this.worker = new Worker(new URL('./worker.js', import.meta.url))
    this.worker.addEventListener(
      'message',
      (event: MessageEvent<SphereShadowFrameMessage>) => {
        switch (event.data.type) {
          case SphereShadowMessageType.Frame:
            ctx.drawImage(event.data.bitmap, 0, 0, canvas.width, canvas.height)
            renderTimeEl.textContent = `${event.data.renderTime
              .toFixed(2)
              .padStart(6, ' ')} ms`
            break
          default:
            throw new Error(`Unhandled message type: ${event.data.type}`)
        }
      }
    )
    const message: SphereShadowInitMessage = {
      type: SphereShadowMessageType.Init,
      width: resolution,
      height: resolution,
    }
    this.worker.postMessage(message)
  }

  disconnectedCallback() {
    this.worker?.terminate()
  }
}
