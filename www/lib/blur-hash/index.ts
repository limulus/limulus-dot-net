import {
  BlurHashMessageType,
  type BlurHashDecodeMessage,
  type BlurHashDecodeResultMessage,
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

    // Don't apply blurhash if the image is already loaded
    if (imgEl.complete && imgEl.naturalWidth > 0) {
      return
    }

    // Safari seems to sometimes calculate object-fit images differently than the background
    // image, which can lead to the background image peeking through on the edges. We don't
    // need to keep these blur hash images around if they are not being displayed, so we may
    // as well remove them.
    imgEl.addEventListener('load', () => {
      // Attempt to prevent flash caused by removing the background image before the image
      // is rendered
      requestAnimationFrame(() => {
        imgEl.style.backgroundImage = ''
      })
    })

    const blobUrl = await this.createBlurhashBlobUrl(blurhash, width, height)
    imgEl.style.backgroundImage = `url(${blobUrl})`

    // Hide alt text that Firefox displays while loading images because we can't know if the
    // text will be legible atop the blurhash background.
    imgEl.style.color = 'transparent'
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
