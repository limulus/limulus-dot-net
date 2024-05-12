import 'media-chrome'
import Hls from 'hls.js'

import { VODEvent } from './VODEvent'
import { createHlsAndBindEvents } from './hls'

const template = document.createElement('template')
template.innerHTML = /* HTML */ `
  <media-controller style="aspect-ratio: 16/9; width: 100%">
    <video crossorigin preload="none" slot="media"></video>
    <media-settings-menu hidden anchor="auto">
      <media-settings-menu-item>
        Speed
        <media-playback-rate-menu slot="submenu" hidden>
          <div slot="title">Speed</div>
        </media-playback-rate-menu>
      </media-settings-menu-item>
      <media-settings-menu-item>
        Captions
        <media-captions-menu slot="submenu" hidden>
          <div slot="title">Captions</div>
        </media-captions-menu>
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

  constructor() {
    super()
    this.#hls = createHlsAndBindEvents(this)
    this.attachShadow({ mode: 'open' })
    this.shadowRoot!.appendChild(template.content.cloneNode(true))
  }

  connectedCallback() {
    const vod = this.getAttribute('vod')
    if (!vod) throw new Error('Attribute "vod" is required')
    const vodUrl = `https://vod.limulus.net/${vod}`

    const videoEl = this.shadowRoot!.querySelector<HTMLVideoElement>('video')!
    videoEl.setAttribute('poster', `${vodUrl}/poster.jpeg`)

    if (this.#hls) {
      const hlsSourceEl = document.createElement('source')
      hlsSourceEl.setAttribute('type', 'application/vnd.apple.mpegurl')
      hlsSourceEl.setAttribute('src', `${vodUrl}/index.m3u8`)
      videoEl.appendChild(hlsSourceEl)

      this.#hls.attachMedia(videoEl)
      this.#hls.loadSource(`${vodUrl}/index.m3u8`)
    } else if (videoEl.canPlayType('application/vnd.apple.mpegurl')) {
      videoEl.setAttribute('src', `${vodUrl}/index.m3u8`)
    }

    videoEl.addEventListener('error', (event) => {
      this.dispatchEvent(new VODEvent('error', vod, { event }))
    })

    let played = false
    videoEl.addEventListener('play', (event) => {
      if (played) return
      played = true
      this.dispatchEvent(new VODEvent('played', vod, { event }))
    })

    let viewed = false
    videoEl.addEventListener('timeupdate', () => {
      if (viewed) return
      if (videoEl.duration && videoEl.currentTime / videoEl.duration > 0.85) {
        viewed = true
        this.dispatchEvent(new VODEvent('viewed', vod))
      }
    })
  }
}

if (!customElements.get('video-on-demand')) {
  customElements.define('video-on-demand', VideoOnDemand)
}
