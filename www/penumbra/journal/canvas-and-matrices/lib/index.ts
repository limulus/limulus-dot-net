import '/lib/pixel-clock/index.XXXXXXXX.js'

const template = document.createElement('template')
template.innerHTML = /* HTML */ `
  <figure>
    <figcaption>
      <a
        href="https://github.com/limulus/penumbra-www/tree/bb3fc6bc3a35db3e7abe249f3838152e116e79f7/src/pixel-clock"
      >
        <code>&lt;pixel-clock&gt;</code>
      </a>
    </figcaption>
    <pixel-clock></pixel-clock>
  </figure>
`

class PixelClockDemo extends HTMLElement {
  constructor() {
    super()
    this.replaceChildren(template.content.cloneNode(true))
  }
}

if (!customElements.get('pixel-clock-demo')) {
  customElements.define('pixel-clock-demo', PixelClockDemo)
}
