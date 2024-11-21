export class ShareButton extends HTMLElement {
  connectedCallback() {
    this.addEventListener('click', this.#onClick)
  }

  async #onClick(e: Event) {
    e.preventDefault()
    if (navigator.share) {
      const title =
        document.querySelector('meta[property="og:title"]')?.getAttribute('content') ?? ''
      await navigator.share({
        title,
        url: location.href,
      })
    } else {
      await navigator.clipboard.writeText(location.href)
    }
  }
}

if (!customElements.get('share-button')) {
  customElements.define('share-button', ShareButton)
}
