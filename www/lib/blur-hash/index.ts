import {
  BlurHashDecodeMessage,
  BlurHashDecodeResultMessage,
  BlurHashMessageType,
} from './messages.js'

const cache = new Map<string, Promise<string>>()

const worker = new Worker('/lib/blur-hash/worker.XXXXXXXX.js', {
  type: 'module',
})

export class BlurHash extends HTMLElement {
  static observedAttributes = ['blurhash', 'width', 'height']

  async connectedCallback() {
    const imgEl = this.querySelector('img')
    if (!imgEl) {
      throw new Error('BlurHash: No image element found')
    }

    const blurhash = this.getAttribute('blurhash')
    // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
    const width = parseInt(this.getAttribute('width') || '0', 10)
    // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
    const height = parseInt(this.getAttribute('height') || '0', 10)

    if (!blurhash) {
      throw new Error('BlurHash: No blurhash attribute found')
    }

    if (!width || !height) {
      throw new Error('BlurHash: Missing width or height attributes')
    }

    const blobUrl = await this.createBlurhashBlobUrl(blurhash, width, height)
    imgEl.style.backgroundImage = `url(${blobUrl})`
  }

  private async createBlurhashBlobUrl(
    blurhash: string,
    width: number,
    height: number
  ): Promise<string | null> {
    const aspectRatio = width / height
    let scaledWidth, scaledHeight

    if (width < height) {
      scaledWidth = 32
      scaledHeight = Math.round(32 / aspectRatio)
    } else {
      scaledHeight = 32
      scaledWidth = Math.round(32 * aspectRatio)
    }

    const cacheKey = `${blurhash}-${scaledWidth}-${scaledHeight}`

    if (!cache.has(cacheKey)) {
      cache.set(
        cacheKey,
        new Promise((resolve) => {
          const message: BlurHashDecodeMessage = {
            type: BlurHashMessageType.decode,
            id: cacheKey,
            blurhash,
            width: scaledWidth,
            height: scaledHeight,
          }
          worker.postMessage(message)

          const handleDecodeResult = (event: MessageEvent<BlurHashDecodeResultMessage>) => {
            if (event.data.id !== cacheKey) return
            worker.removeEventListener('message', handleDecodeResult)
            resolve(event.data.blobUrl)
          }
          worker.addEventListener('message', handleDecodeResult)
        })
      )
    }

    return cache.get(cacheKey)!
  }
}

if (!customElements.get('blur-hash')) {
  customElements.define('blur-hash', BlurHash)
}
