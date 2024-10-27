import '/lib/sphere-shadow/index.XXXXXXXX.js'
import '/lib/sphere-shadow-wasm/index.XXXXXXXX.js'

const template = document.createElement('template')
template.innerHTML = /* HTML */ `
  <div class="figures">
    <figure>
      <figcaption>
        <a href="https://github.com/limulus/penumbra-www/tree/542b248/src/sphere-shadow">
          <code>&lt;sphere-shadow&gt;</code>
        </a>
      </figcaption>
      <sphere-shadow resolution="100"></sphere-shadow>
    </figure>

    <figure>
      <figcaption>
        <a
          href="https://github.com/limulus/penumbra-www/tree/542b248/src/sphere-shadow-wasm"
        >
          <code>&lt;sphere-shadow-wasm&gt;</code>
        </a>
      </figcaption>
      <sphere-shadow-wasm resolution="100"></sphere-shadow-wasm>
    </figure>
  </div>

  <form class="resolution-selector">
    <label>
      Resolution:
      <select name="resolution" list>
        <option value="10">10x10</option>
        <option value="20">20x20</option>
        <option value="50">50x50</option>
        <option value="100" selected>100x100</option>
        <option value="200">200x200</option>
        <option value="300">300x300</option>
        <option value="400">400x400</option>
        <option value="500">500x500</option>
      </select>
    </label>
  </form>

  <style>
    sphere-shadow-js-vs-wasm .figures {
      display: flex;
      flex-wrap: wrap;
      justify-content: space-evenly;
      gap: 20px;
    }

    sphere-shadow-js-vs-wasm .figures figure {
      width: max-content;
    }

    sphere-shadow-js-vs-wasm form.resolution-selector {
      text-align: center;
    }
  </style>
`

export class SphereShadowJSWASMCompare extends HTMLElement {
  constructor() {
    super()
    this.replaceChildren(template.content.cloneNode(true))
  }

  connectedCallback() {
    const components = [
      this.querySelector('sphere-shadow') as HTMLElement,
      this.querySelector('sphere-shadow-wasm') as HTMLElement,
    ]
    const formEl = this.querySelector('form.resolution-selector') as HTMLFormElement
    formEl!.addEventListener('change', () => {
      const data = new FormData(formEl)
      components.forEach((component) => {
        component.setAttribute('resolution', data.get('resolution')!.toString())
      })
    })
  }
}

if (!customElements.get('sphere-shadow-js-vs-wasm')) {
  customElements.define('sphere-shadow-js-vs-wasm', SphereShadowJSWASMCompare)
}
