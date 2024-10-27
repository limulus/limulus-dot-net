import '/lib/sphere-shadow/index.XXXXXXXX.js'

const template = document.createElement('template')
template.innerHTML = /* HTML */ `
  <figure>
    <figcaption>
      <a
        href="https://github.com/limulus/penumbra-www/tree/bb3fc6bc3a35db3e7abe249f3838152e116e79f7/src/sphere-shadow"
      >
        <code>&lt;sphere-shadow&gt;</code>
      </a>
    </figcaption>
    <sphere-shadow></sphere-shadow>
  </figure>
`

class SphereShadowDemo extends HTMLElement {
  constructor() {
    super()
    this.replaceChildren(template.content.cloneNode(true))
  }
}

if (!customElements.get('sphere-shadow-demo')) {
  customElements.define('sphere-shadow-demo', SphereShadowDemo)
}
