import 'touch-pad/define'
import type { TouchPadMoveEvent } from 'touch-pad'

import {
  SphereShadowMessageType,
  type SphereShadowInitMessage,
  type SphereShadowFrameMessage,
  type SphereShadowLightTranslateMessage,
  type SphereShadowReadyMessage,
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
      display: inline-block;
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
  static get observedAttributes() {
    return ['resolution']
  }

  worker: Worker | null = null
  #resolution: number = 100

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

    this.#resolution =
      parseInt(this.getAttribute('resolution') ?? '', 10) || this.#resolution

    this.addEventListener('touchpadmove', (event) => {
      const {
        detail: { x, y },
      } = event as TouchPadMoveEvent
      const message: SphereShadowLightTranslateMessage = {
        type: SphereShadowMessageType.LightTranslate,
        x: x * this.#resolution,
        y: y * this.#resolution,
        z: 0,
      }
      this.worker?.postMessage(message)
    })

    this.worker = new Worker(new URL('./worker.XXXXXXXX.js', import.meta.url), {
      type: 'module',
    })
    this.worker.addEventListener(
      'message',
      (event: MessageEvent<SphereShadowFrameMessage | SphereShadowReadyMessage>) => {
        switch (event.data.type) {
          case SphereShadowMessageType.Ready:
            this.worker!.postMessage({
              type: SphereShadowMessageType.Init,
              width: this.#resolution,
              height: this.#resolution,
            } as SphereShadowInitMessage)
            break
          case SphereShadowMessageType.Frame:
            ctx.drawImage(event.data.bitmap, 0, 0, canvas.width, canvas.height)
            renderTimeEl.textContent = `${event.data.renderTime
              .toFixed(2)
              .padStart(6, ' ')} ms`
            break
          default:
            // @ts-expect-error
            throw new Error(`Unhandled message type: ${event.data.type}`)
        }
      }
    )
  }

  attributeChangedCallback(name: string, oldValue: string, newValue: string) {
    if (name === 'resolution' && oldValue !== newValue) {
      const resolution = parseInt(newValue, 10)
      if (!isNaN(resolution)) {
        this.#resolution = resolution
        const message: SphereShadowInitMessage = {
          type: SphereShadowMessageType.Init,
          width: this.#resolution,
          height: this.#resolution,
        }
        this.worker?.postMessage(message)
      }
    }
  }

  disconnectedCallback() {
    this.worker?.terminate()
  }
}

if (!customElements.get('sphere-shadow-wasm')) {
  customElements.define('sphere-shadow-wasm', SphereShadowWasm)
}
