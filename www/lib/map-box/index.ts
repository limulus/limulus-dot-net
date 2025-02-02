import mapboxgl from 'mapbox-gl'

export class MapBox extends HTMLElement {
  private container = document.createElement('div')
  private map: mapboxgl.Map | null = null

  constructor() {
    super()
    this.container.style.width = '100%'
    this.container.style.height = '100%'
    this.container.style.transition = 'opacity 0.5s'
    this.container.style.opacity = '0'
  }

  connectedCallback() {
    this.appendChild(this.container)

    this.map = new mapboxgl.Map({
      accessToken: process.env.MAPBOX_PUBLIC_TOKEN,
      container: this.container,
      style: 'mapbox://styles/mapbox/streets-v12',
      center: JSON.parse(this.getAttribute('center') ?? '[-74.5, 40]'),
      zoom: parseInt(this.getAttribute('zoom') ?? '9', 10),
    })

    this.map.on('load', () => {
      this.container.style.opacity = '1'
    })

    const markerCoords = this.getAttribute('marker')
    if (markerCoords) {
      new mapboxgl.Marker().setLngLat(JSON.parse(markerCoords)).addTo(this.map)
    }

    this.map.addControl(new mapboxgl.NavigationControl())
    this.map.addControl(new mapboxgl.ScaleControl())
  }

  disconnectedCallback() {
    this.map?.remove()
  }
}

if (!customElements.get('map-box')) {
  customElements.define('map-box', MapBox)
}
