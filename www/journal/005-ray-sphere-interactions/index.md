---
tags: journal
layout: penumbra-journal-entry
title: 'Chapter 5: Ray-Sphere Interactions'
date: 2023-12-29 14:00:00 -07:00
image: sphere-shadow.jpeg
teaser: >-
  Finally! Ray casting! Plus an interactive demo of a sphere’s shadow.
---

In chapter 5 of [The Ray Tracer Challenge] you finally get to implement something that
starts to resemble a ray tracer. You implement ray, sphere, and intersection related
functions and the exercise at the end ties it all together to create an image.

[the ray tracer challenge]: https://pragprog.com/titles/jbtracer/the-ray-tracer-challenge/

## Finding Intersections

The book does not go into the details of the math for how to determine the intersection
points of a ray and sphere. I’m glad for that, but it bugged me that I do not have an
intuitive understanding of _why_ [this intersect method] works.

[this intersect method]: https://github.com/limulus/penumbra/blob/1fee85dad2f656c6d028a74d957b2129c0476f34/src/lib/sphere.ts#L27-L51

```typescript
class Sphere {
  intersect(ray: Ray): IntersectionCollection {
    // Transform the ray into object space
    ray = ray.transform(this.transformInverse)

    // Vector from sphere origin to the ray origin
    const sphereToRayVec = ray.origin.sub(origin)

    // Supporting characters to determine the discriminant and intersection
    const a = ray.direction.dot(ray.direction)
    const b = 2 * ray.direction.dot(sphereToRayVec)
    const c = sphereToRayVec.dot(sphereToRayVec) - 1

    // Discriminant does not intersect sphere if it is negative
    const discriminant = b ** 2 - 4 * a * c
    if (discriminant < 0) return new IntersectionCollection()

    // Calculate the intersection points
    const sqrtDiscriminant = Math.sqrt(discriminant)
    const t1 = (-b - sqrtDiscriminant) / (2 * a)
    const t2 = (-b + sqrtDiscriminant) / (2 * a)
    return new IntersectionCollection(
      new Intersection(t1, this),
      new Intersection(t2, this)
    )
  }
}
```

The book does suggest some online resources for an explanation of the math at work. I took
some time to read through [this one]. It includes two solutions: a geometric solution and an
analytic solution. The geometric solution made sense to me but the analytic solution less
so. Still — despite an error[^1] in that explanation — it did make some sense. One thing
that helped was realizing that the `discriminant` being negative means there is no
intersection because that would require taking the square root of a negative number.

The solution the book provides and I implemented above is the analytic solution. I would
have a deeper understanding of it if it were the geometric solution, but at least I now have
a better-than-tenuous idea of why this code works.

[this one]: https://www.scratchapixel.com/lessons/3d-basic-rendering/minimal-ray-tracer-rendering-simple-shapes/ray-sphere-intersection.html

[^1]:
    At the time of writing this the issue with that page is that in the “Analytic Solution”
    section “equation 5” is a repeat of “equation 4”. It should actually be the
    [quadratic formula]:

    <math display="block">
      <mi>x</mi>
      <mo> = </mo>
      <mfrac>
        <mrow>
          <mo>−</mo><mi>b</mi>
          <mo>±</mo>
          <msqrt>
            <msup><mi>b</mi><mn>2</mn></msup>
            <mo>−</mo>
            <mn>4</mn><mi>a</mi><mi>c</mi>
          </msqrt>
        </mrow>
        <mrow>
          <mn>2</mn><mi>a</mi>
        </mrow>
      </mfrac>
    </math>

    Or, with the discriminant represented as
    <math display="inline"><mi mathvariant="normal">Δ</mi></math>:

    <math display="block">
      <mi>x</mi>
      <mo> = </mo>
      <mfrac>
        <mrow>
          <mo>−</mo><mi>b</mi>
          <mo>±</mo>
          <msqrt>
            <mi mathvariant="normal">Δ</mi>
          </msqrt>
        </mrow>
        <mrow>
          <mn>2</mn><mi>a</mi>
        </mrow>
      </mfrac>
    </math>

    If you decide to dig this deep hopefully the above can save you the intense head
    scratching that I went through.

[quadratic formula]: https://en.m.wikipedia.org/wiki/Quadratic_formula

## The Demo: <code>&lt;sphere-shadow&gt;</code> {#demo}

The exercise at the end of the chapter is to render the shadow of a sphere by casting rays
from a light source onto a “wall”. I’ve implemented that here, with the addition that you
can change the position of the light source by dragging from the element.

<figure>
  <figcaption>
    <a href="https://github.com/limulus/penumbra/blob/main/src/www/sphere-shadow/">
      <code>&lt;sphere-shadow&gt;</code>
    </a>
  </figcaption>
  <sphere-shadow>
    <script>document.write('Loading…')</script>
    <noscript>Enable JavaScript to view the <code>&lt;sphere-shadow&gt;</code> demo.</noscript>
  </sphere-shadow>
</figure>

<script type="module" async>
  import { SphereShadow } from '../../assets/js/sphere-shadow/index.js'
  customElements.define('sphere-shadow', SphereShadow)
</script>

I don’t normally test drive my demo code since it is more exploratory fun than writing code
I intend to reuse. But I figured I would want to make use of the dragging interaction again,
so I [test-drove the creation] of a [TouchPad class] to track all the mouse and touch events
on (and off) of the element and emit only the needed move events. At some point I should add
keyboard support to it as well.

[test-drove the creation]: https://github.com/limulus/penumbra/blob/93ee15212eb71ad186f072d8c38e3d8a1f3b8500/src/lib/ui/touch-pad.spec.ts
[touchpad class]: https://github.com/limulus/penumbra/blob/93ee15212eb71ad186f072d8c38e3d8a1f3b8500/src/lib/ui/touch-pad.ts

Other than that there is not much new from the web technology side compared to the [previous
demo]. Rendering of the canvas still happens in a single web worker.

[previous demo]: ../004-canvas-and-matrices/

## What’s Next

In the demo I included an output to show the render time of the last frame. I get around
5.5ms in Chrome on my Mac Studio with an M2 Max. Firefox gets around 18.5ms and Safari
around 9ms. I find this performance a little disappointing considering I feel like I have
optimized things as much as I reasonably can. It makes me wonder if I should skip to
targeting Web Assembly earlier than I was planning. I would like to keep the demos
interactive in a real-time sort of way. Parallelization will help, but only so much on older
devices with fewer CPU cores. Maybe now is the time…
