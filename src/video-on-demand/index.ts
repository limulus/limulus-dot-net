import 'media-tracks/polyfill'
import 'media-chrome'
import 'media-chrome/menu'

import Hls, { Level } from 'hls.js'

import { VODEvent } from './VODEvent'
import { availableQualityLevels, createHlsAndBindEvents } from './hls'

const template = document.createElement('template')
template.innerHTML = /* HTML */ `
  <media-controller style="aspect-ratio: 16/9; width: 100%">
    <video
      crossorigin
      playsinline
      preload="none"
      slot="media"
      x-webkit-airplay="allow"
    ></video>
    <media-settings-menu hidden anchor="auto">
      <media-settings-menu-item>
        Captions
        <media-captions-menu slot="submenu" hidden>
          <div slot="title">Captions</div>
        </media-captions-menu>
      </media-settings-menu-item>
      <media-settings-menu-item>
        Quality
        <media-rendition-menu slot="submenu" hidden>
          <div slot="title">Quality</div>
        </media-rendition-menu>
      </media-settings-menu-item>
      <media-settings-menu-item>
        Speed
        <media-playback-rate-menu slot="submenu" hidden>
          <div slot="title">Speed</div>
        </media-playback-rate-menu>
      </media-settings-menu-item>
    </media-settings-menu>
    <media-control-bar>
      <media-play-button></media-play-button>
      <media-mute-button></media-mute-button>
      <media-volume-range></media-volume-range>
      <media-time-display showduration></media-time-display>
      <media-time-range></media-time-range>
      <media-settings-menu-button></media-settings-menu-button>
      <media-airplay-button></media-airplay-button>
      <media-fullscreen-button></media-fullscreen-button>
    </media-control-bar>
  </media-controller>

  <style>
    media-control-bar {
      backdrop-filter: blur(10px);
      -webkit-backdrop-filter: blur(10px);
    }

    media-mute-button + media-volume-range {
      width: 0;
      overflow: hidden;
      transition: width 0.2s ease-in;
    }

    /* Expand volume control in all relevant states */
    media-mute-button:hover + media-volume-range,
    media-mute-button:focus + media-volume-range,
    media-mute-button:focus-within + media-volume-range,
    media-volume-range:hover,
    media-volume-range:focus,
    media-volume-range:focus-within {
      width: 70px;
    }

    /* Do not show the airplay button unless AirPlay is available */
    media-airplay-button[mediaairplayunavailable] {
      display: none;
    }
  </style>
`

export class VideoOnDemand extends HTMLElement {
  #hls: Hls | null
  #videoEl: HTMLVideoElement

  constructor() {
    super()
    this.attachShadow({ mode: 'open' })
    this.shadowRoot!.appendChild(template.content.cloneNode(true))
    this.#videoEl = this.shadowRoot!.querySelector<HTMLVideoElement>('video')!
    this.#hls = createHlsAndBindEvents(this, this.#videoEl)
  }

  connectedCallback() {
    const vod = this.getAttribute('vod')
    if (!vod) throw new Error('Attribute "vod" is required')
    const vodUrl = `https://vod.limulus.net/${vod}`

    this.#videoEl.setAttribute('poster', `${vodUrl}/poster.jpeg`)

    if (this.#hls) {
      this.#hls.on(Hls.Events.MANIFEST_PARSED, async (_event, data) => {
        const levelIdMap = new Map<Level, number>(
          data.levels.map((level, index) => [level, index])
        )
        const qualityLevels = await availableQualityLevels(data.levels)
        this.shadowRoot!.querySelector('media-rendition-menu')!.setAttribute(
          'mediarenditionlist',
          qualityLevels
            .map((level) => `${levelIdMap.get(level)}:${level.width}:${level.height}`)
            .join(' ')
        )
      })

      this.addEventListener('mediarenditionrequest', (event: Event) => {
        const customEvent = event as CustomEvent<string>
        if (customEvent.detail === 'auto') {
          this.#hls!.nextLevel = -1
        } else {
          const levelId = parseInt(customEvent.detail, 10)
          this.#hls!.nextLevel = levelId
        }
      })

      this.#hls.loadSource(`${vodUrl}/index.m3u8`)
      this.#hls.attachMedia(this.#videoEl)

      // Stop loading the HLS stream when AirPlay is active.
      // https://github.com/video-dev/hls.js/issues/6482#issuecomment-2159399478
      if (this.#videoEl.webkitCurrentPlaybackTargetIsWireless) {
        this.#hls.stopLoad()
      }
      this.#videoEl.addEventListener(
        'webkitcurrentplaybacktargetiswirelesschanged',
        (_event) => {
          if (this.#videoEl.webkitCurrentPlaybackTargetIsWireless) {
            this.#hls!.stopLoad()
          } else {
            this.#hls!.startLoad()
          }
        }
      )

      // Add source attribute for AirPlay
      const hlsSourceEl = document.createElement('source')
      hlsSourceEl.setAttribute('type', 'application/x-mpegURL')
      hlsSourceEl.setAttribute('src', `${vodUrl}/index.m3u8`)
      this.#videoEl.disableRemotePlayback = false
      this.#videoEl.appendChild(hlsSourceEl)
    } else if (this.#videoEl.canPlayType('application/vnd.apple.mpegurl')) {
      this.#videoEl.setAttribute('src', `${vodUrl}/index.m3u8`)
    }

    this.#videoEl.addEventListener('error', (event) => {
      const payload = {
        event,
        videoElementLastError: {
          code: this.#videoEl.error?.code,
          message: this.#videoEl.error?.message,
        },
      }
      this.dispatchEvent(new VODEvent('error', vod, payload))
      console.error('video-on-demand error', payload)
    })

    let played = false
    this.#videoEl.addEventListener('play', (event) => {
      if (played) return
      played = true
      this.dispatchEvent(new VODEvent('played', vod, { event }))
    })

    let viewed = false
    this.#videoEl.addEventListener('timeupdate', () => {
      if (viewed) return
      if (
        this.#videoEl.duration &&
        this.#videoEl.currentTime / this.#videoEl.duration > 0.85
      ) {
        viewed = true
        this.dispatchEvent(new VODEvent('viewed', vod))
      }
    })
  }
}

if (!customElements.get('video-on-demand')) {
  customElements.define('video-on-demand', VideoOnDemand)
}
