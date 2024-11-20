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
    }
  }

  // TODO: Fallback to copying the URL to the clipboard
}

if (!customElements.get('share-button')) {
  customElements.define('share-button', ShareButton)
}
