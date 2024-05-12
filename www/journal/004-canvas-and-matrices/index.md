---
tags: journal
layout: penumbra-journal-entry
title: 'Chapters 2–4: Canvas and Matrices'
date: 2023-12-08 18:30:00 -07:00
image: pixel-clock.jpeg
teaser: >-
  An overdue and long update covering 3 chapters! The site has moved to its permanent home
  and the demo for these chapters is a neat little animated clock.
---

In the [previous post][003] I went a little further than the exercise at the end of the
chapter asked for and created a web component that exercised my tuple implementation and
included animation of the projectile. As it turns out, this wound up being very similar to
the exercise at the end of chapter 2, which is about implementing a canvas. So I decided to
skip that exercise and continue onto the next two chapters which walk you through
implementing various matrix math operations.

[003]: ../003-tuples/

## Implementing the Canvas Class

Implementing a canvas class when targeting a web runtime is perhaps unnecessary since
[`<canvas>`][canvas] provides a solid 2D canvas JavaScript API. However, the book has you
implement color functions for tuples containing floats so a canvas that stores colors with
floats instead of integer values seems like it might be a better bet going forward. So I
decided to implement my own [`Canvas` class][canvas class] backed by a `Float32Array`.

[canvas]: https://developer.mozilla.org/en-US/docs/Web/HTML/Element/canvas
[canvas class]: https://github.com/limulus/penumbra/blob/d32022d755967a75c3923a156490e18e4315bf17/src/lib/canvas.ts

I went with 32-bit floats over the JavaScript-native 64-bit floats since I am still planning
on porting this to [AssemblyScript] to take advantage of the [v128 SIMD operations] in
WebAssembly. The “128” in “v128” implies you can either have an SIMD instruction operate
either on 4 32-bit floats or 2 64-bit floats. Four-times-faster is better than
two-times-faster. And based on a bit of research the extra precision is usually not needed
or at least easy to avoid needing.

[assemblyscript]: https://www.assemblyscript.org
[v128 simd operations]: https://github.com/WebAssembly/simd/blob/a78b98a6899c9e91a13095e560767af6e99d98fd/proposals/simd/SIMD.md

Using a [`TypedArray`][typedarray] also opens the doors to backing a canvas with a
[`SharedArrayBuffer`][sharedarraybuffer] or something similar. I can imagine this being
useful by having the ray tracer running in many WebWorkers, all updating a shared canvas.

[typedarray]: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/TypedArray
[sharedarraybuffer]: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/SharedArrayBuffer

There’s a bit of a snag with `SharedArrayBuffer` however…

### A Side Quest to Move Away From GitHub Pages

In response to the [Spectre vulnerability], browser vendors updated the `SharedArrayBuffer`
constructor to throw so that it could not be abused until they had a fix. The fix they
ultimately adopted requires sending [two HTTP headers] with your HTML document. Well, you
can’t set HTTP headers on GitHub Pages, where I was previously hosting this site.

[spectre vulnerability]: https://en.wikipedia.org/wiki/Spectre_(security_vulnerability)
[two http headers]: https://hacks.mozilla.org/2020/07/safely-reviving-shared-memory/

I always planned on moving this site to my personal website, [limulus.net]. But my setup for
limulus.net is very out-of-date. I have a GitHub repository for it but deployment is no
longer automated. I just manually upload any changes to S3. None of the other infrastructure
for it like the CloudFront distribution has been turned into CloudFormation templates so
it’s all just sitting in AWS resources without any version control. I wanted to avoid adding
to that mess for now by publishing to GitHub Pages.

[limulus.net]: https://limulus.net/

Even though I know `SharedArrayBuffer` may not be how I ultimately choose to implement
things I also didn’t want to be in the situation where I am forced into switching away from
GitHub Pages in the middle of the project instead of early on. In the (ok, unlikely) event
that anyone was subscribed to the [RSS feed] setting up redirects on GitHub Pages for that
might be tricky. Better to just get it out of the way as soon as possible.

[rss feed]: /feed.xml

In a bid to get things done though I resisted the urge to write CloudFormation templates for
everything, so unfortunately I have added to my AWS technical debt. However I did spend the
time set things up in the new ways AWS recommends: I’m using [GitHub’s OIDC
provider][gh-oidc] to get temporary AWS credentials for the GitHub Action that publishes
this site and I avoided setting up the S3 bucket to use public website mode. I learned that
to get CloudFront to serve `index.html` files for directories served from a private S3
origin you need to write a [CloudFront Function] to rewrite the request. So unfortunately that
means I now have a tiny bit of code for hosting this site that is not version controlled.
But at least now I know how to set these things up in a more secure way.

[gh-oidc]: https://docs.github.com/en/actions/deployment/security-hardening-your-deployments/configuring-openid-connect-in-amazon-web-services
[cloudfront function]: https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/cloudfront-functions.html

## Implementing the Matrix Class

There’s only a few things particularly interesting about the implementation of my [`Matrix`
class][matrix class].

[matrix class]: https://github.com/limulus/penumbra/blob/d32022d755967a75c3923a156490e18e4315bf17/src/lib/matrix.ts

### A Surprise Subclass

It likely should not have come as a surprise that the `Tuple` implementation would need to
be treated as a matrix when doing matrix math operations. In fact, tuples need to be treated
as matrixes of four rows, which is not my intuition about how to conceptualize an array of
four items. It was seeming like I was going to need special handling in my `Matrix` class to
account for whenever it was passed a `Tuple` and that felt messy. The solution I landed on
was to create a `TwoDimensionalArray` class that would act as the base class for both the
`Tuple` and `Matrix` classes. This way, the Tuple class can construct itself with 1 column
and 4 rows and the `Matrix` class doesn’t have to treat `Tuple`s as special cases.

This kind of refactor is definitely where having a robust test suite (in this case provided
by the book) shines. I had confidence in a relatively substantial refactor without any added
effort.

### Chaining Matrix Transformations

While I won’t pretend to understand the reasons why (maybe I knew back when I took linear
algebra?) if you want a transformation matrix to have multiple transformations you have to
multiply them in reverse order. In other words, if you want a matrix that you can use to do
a translation, then a rotation, then a scaling up, you need to first multiply the scaling
matrix by the rotation matrix, and then the result by the translation matrix. The books
suggests that you implement a “fluent” API of chainable methods that takes care of this for
you. For example:

```typescript
const twoOClock = Matrix.transformation()
  .translate(0, 1, 0)
  .rotateZ(-(2 / 12) * 2 * Math.PI)
  .scale(clockRadius, -clockRadius, 0)
```

What I’ve seen frequently in JS APIs is that they often require something like a final
`.done()` method to perform the final calculations and produce the end result of the chain
of operations. However, there is a way around this if you can structure your class to have
the first attempt to read the values of the returned object do the finalization.

Here’s how that works with my `Matrix` class. The following is a selection of methods that
demonstrate it. The `.translate()`, `.rotateZ()`, and `scale()` methods in the example above
all call `.#pushOperation()` to push their operation onto the `#operationStack` array and
return `this`.

```typescript
export class Matrix extends TwoDimensionalArray {
  static transformation() {
    const chainable = Matrix.identity(4)
    chainable.#operationStack = []
    return chainable
  }

  #operationStack?: Matrix[]

  protected override get values() {
    if (this.#operationStack) {
      const operationStack = this.#operationStack
      this.#operationStack = undefined
      const result = operationStack.reduceRight(
        (result, operation) => result.mul(operation),
        this
      )
      super.values = result.values
    }
    return super.values
  }

  #pushOperation(operation: Matrix): this {
    if (!this.#operationStack) {
      throw new Error('Attempted to push operation to non-chainable matrix')
    }
    this.#operationStack.push(operation)
    return this
  }
}
```

## The Demo: <code>&lt;pixel-clock&gt;</code> {#demo}

The end-of-chapter exercise for chapter 5 is to use your matrix and canvas implementation to
color in a pixel for every hour of a 12 hour analog clock. I did two things I really didn’t
have to for this exercise: add animated “hands” and perform the rendering in a [Web Worker].

[web worker]: https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API

<figure>
  <figcaption>
    <a href="https://github.com/limulus/penumbra/blob/main/src/www/pixel-clock/">
      <code>&lt;pixel-clock&gt;</code>
    </a>
  </figcaption>
  <pixel-clock>
    <script>document.write('Loading…')</script>
    <noscript>Enable JavaScript to view the <code>&lt;pixel-clock&gt;</code> demo.</noscript>
  </pixel-clock>
</figure>

<script type="module" async>
  import { PixelClock } from '../../assets/js/pixel-clock/index.js'
  customElements.define('pixel-clock', PixelClock)
</script>

Now that I have some hands-on experience with Web Workers I expect to be able to offload the
work of the ray tracer off the main thread, and possibly even parallelize the work into
multiple workers.

## Up Next: Finally Casting Some Rays!

Now that these fundamentals are out of the way and I’ve got this site hosted where I want
it, there should be less of a delay until the next post. With any luck the next post will
also not be quite as long!
