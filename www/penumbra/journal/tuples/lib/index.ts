import '/lib/projectile-cannon/index.XXXXXXXX.js'

const template = document.createElement('template')
template.innerHTML = /* HTML */ `
  <figure>
    <figcaption>
      <a
        href="https://github.com/limulus/penumbra-www/blob/bb3fc6bc3a35db3e7abe249f3838152e116e79f7/src/projectile-cannon/index.ts"
        ><code>&lt;projectile-cannon&gt;</code></a
      >
    </figcaption>
    <projectile-cannon></projectile-cannon>
  </figure>
`

class ProjectileCannonDemo extends HTMLElement {
  constructor() {
    super()
    this.replaceChildren(template.content.cloneNode(true))
  }
}

if (!customElements.get('projectile-cannon-demo')) {
  customElements.define('projectile-cannon-demo', ProjectileCannonDemo)
}
