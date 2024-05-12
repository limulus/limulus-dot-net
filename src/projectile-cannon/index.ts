import { Tuple } from '@limulus/penumbra'

export class ProjectileCannon extends HTMLElement {
  private sceneAnimator: ProjectileCannonSceneAnimator | null = null

  connectedCallback() {
    this.attachShadow({ mode: 'open' })
    if (!this.shadowRoot) throw new Error('Shadow root not found')

    this.shadowRoot.innerHTML = /* HTML */ `
      <canvas width="1600" height="900"></canvas>
      <label>X: <input name="x" type="range" min="0" max="25" value="6" /></label>
      <label>Y: <input name="y" type="range" min="0" max="25" value="8" /></label>
      <label>Z: <input name="z" type="range" min="0" max="25" value="5" /></label>
      <button name="fire">Fire</button>
      <button name="clear">Clear</button>
    `

    const style = document.createElement('style')
    style.textContent = /* CSS */ `
      label {
        display: block;
      }

      canvas {
        border: 1px solid black;
        width: 100%;
        height: auto;
      }

      @media (prefers-color-scheme: dark) {
        canvas {
          border-color: white;
        }

        input[type="range"] {
          filter: invert(.92);
        }
      }
    `
    this.shadowRoot.appendChild(style)

    const canvas = this.shadowRoot.querySelector('canvas') as HTMLCanvasElement
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('Could not get canvas context')

    this.sceneAnimator = new ProjectileCannonSceneAnimator(ctx)

    const fireButton = this.shadowRoot.querySelector('button') as HTMLButtonElement
    fireButton.addEventListener('click', () => {
      const x = Number(
        (this.shadowRoot!.querySelector('input[name="x"]') as HTMLInputElement).value
      )
      const y = Number(
        (this.shadowRoot!.querySelector('input[name="y"]') as HTMLInputElement).value
      )
      const z = Number(
        (this.shadowRoot!.querySelector('input[name="z"]') as HTMLInputElement).value
      )
      this.sceneAnimator!.fireProjectile(
        new Projectile(Tuple.point(0, 3, 0), Tuple.vector(x, y, z))
      )
    })

    const clearButton = this.shadowRoot.querySelector(
      'button[name="clear"]'
    ) as HTMLButtonElement
    clearButton.addEventListener('click', () => {
      this.sceneAnimator!.reset()
    })
  }

  disconnectedCallback() {
    this.sceneAnimator!.stop()
  }
}

class SceneAnimator {
  private lastRenderTime = -Infinity
  private rafHandle = 0
  private renderer: Renderer
  protected scene: Scene

  constructor(ctx: CanvasRenderingContext2D) {
    this.scene = new Scene()
    this.renderer = new Renderer(ctx)
  }

  onAnimationFrameRequest(time: number) {
    const deltaTime = this.lastRenderTime === -Infinity ? 0 : time - this.lastRenderTime
    this.lastRenderTime = time
    this.scene = this.scene.advance(deltaTime)
    this.renderer.render(this.scene)
    this.requestAnimationFrame()
  }

  requestAnimationFrame() {
    this.rafHandle = requestAnimationFrame((time) => {
      this.onAnimationFrameRequest(time)
    })
  }

  reset() {
    this.scene = new Scene()
    this.lastRenderTime = -Infinity
  }

  start() {
    if (this.rafHandle !== 0) return
    this.requestAnimationFrame()
  }

  stop() {
    if (this.rafHandle === 0) return
    cancelAnimationFrame(this.rafHandle)
    this.rafHandle = 0
  }
}

class ProjectileCannonSceneAnimator extends SceneAnimator {
  fireProjectile(projectile: Projectile) {
    this.scene.addObject(projectile)
    this.start()
  }
}

class SceneObject {
  position: Tuple
  velocity: Tuple

  constructor(position: Tuple, velocity: Tuple) {
    this.position = position
    this.velocity = velocity
  }
}

class Projectile extends SceneObject {}

class Scene {
  static readonly environment = {
    gravity: Tuple.vector(0, -0.1, 0),
    wind: Tuple.vector(-0.01, -0.01, -0.01),
  }

  readonly objects: SceneObject[] = []

  addObject(projectile: SceneObject) {
    this.objects.push(projectile)
  }

  advance(deltaTime: number): Scene | this {
    if (this.objects.length === 0) return this
    if (this.objects.every((projectile) => projectile.position.y <= 0)) return this

    deltaTime /= 10

    const scene = new Scene()
    this.objects.forEach((projectile) => {
      if (projectile.position.y > 0) {
        projectile = new Projectile(
          projectile.position.add(projectile.velocity.mul(deltaTime)),
          projectile.velocity
            .add(Scene.environment.gravity.mul(deltaTime))
            .add(Scene.environment.wind.mul(deltaTime))
        )
      }
      scene.addObject(projectile)
    })

    return scene
  }
}

class Renderer {
  private darkModeMediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
  private renderDependencyCache: any[] = []

  constructor(private ctx: CanvasRenderingContext2D) {}

  render(scene: Scene) {
    const deps = [this.primaryColor, scene]
    if (!deps.every((dep, index) => dep === this.renderDependencyCache[index])) {
      this.clear()
      this.drawObjects(scene.objects)
      this.drawSceneInfo(scene)
      this.renderDependencyCache = deps
    }
  }

  private clear() {
    this.ctx.clearRect(0, 0, this.ctx.canvas.width, this.ctx.canvas.height)
  }

  private get primaryColor() {
    return this.darkModeMediaQuery.matches ? 'white' : 'black'
  }

  private drawSceneInfo(scene: Scene) {
    this.ctx.fillStyle = this.primaryColor
    this.ctx.font = '24px "SF Mono", "Roboto Mono", monospace'
    scene.objects.forEach((projectile, index) => {
      this.ctx.fillText(projectile.position.toString(), 10, 10 + 28 * (index + 1))
    })
  }

  private drawObjects(projectiles: Projectile[]) {
    this.ctx.fillStyle = this.primaryColor
    projectiles.forEach((projectile) => {
      const distanceAdjustedSize = 10 * (1 - projectile.position.z / 100)
      this.ctx.fillRect(
        projectile.position.x,
        this.ctx.canvas.height - projectile.position.y,
        distanceAdjustedSize,
        distanceAdjustedSize
      )
    })
  }
}
