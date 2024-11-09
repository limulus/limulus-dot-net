---
tags:
  - article
  - penumbra
layout: article
author: eric
title: 'The Twist You Possibly Expected: Rust'
date: 2024-06-04 13:20:00 -07:00
image: h9GqVnA8
imageAlt: >-
  Screenshot of the JavaScript and WebAssembly versions of the sphere-shadow components
  side-by-side. There is also a dropdown menu to select the resolution that the components
  will render.
teaser: >-
  Switching from JavaScript to Rust/WebAssembly has (unsurprisingly) significantly increased
  performance!
scripts: ./lib/index.js
---

I’ve [previously] [mentioned] my intention to eventually switch from targeting JavaScript to
targeting [WebAssembly]. Well, I’ve done it! I went through and reimplemented everything I
have done so far to target WebAssembly using [SIMD] instructions. Here’s the previous
[sphere’s shadow demo] alongside the new WebAssembly version:

[previously]: ../003-tuples/#looking-ahead
[mentioned]: ../004-canvas-and-matrices/#implementing-the-canvas-class
[webassembly]: https://webassembly.org/
[simd]: https://en.wikipedia.org/wiki/Single_instruction,_multiple_data
[sphere’s shadow demo]: ../005-ray-sphere-interactions/#demo

<div>
  <sphere-shadow-js-vs-wasm>
    {% include 'dynamic-content-fallback' %}
  </sphere-shadow-js-vs-wasm>
</div>

Click and drag (or touch and drag) to change the position of the light source, and thus
change the shape of the sphere’s shadow. Change the resolution via the dropdown to observe
the effect on render times.

## Eschewing AssemblyScript

I previously mentioned that my plan was to rewrite using [AssemblyScript], which is a
TypeScript based language that compiles directly to WebAssembly. This seemed really
promising to me. My goal with this project was not to learn a new programming language but
to learn about ray tracing and maybe do something fun with it.

[assemblyscript]: https://www.assemblyscript.org/

Unfortunately, as I began to look more seriously into AssemblyScript I started to have my
doubts about it. I briefly joined the AssemblyScript Discord server and it became apparent
that established WebAssembly features like threads were not going to be implemented any time
soon — seemingly because the authors have become disenchanted with one or more of the W3C
working groups of which they were once a part of. In a [long and somewhat inscrutable
manifesto] they list their objections, offenses, and demands. I can’t discount that they
were mistreated but I nevertheless found it an off-putting read. They may well have some
valid points — after all it is easy to be sympathetic about ensuring WebAssembly
interoperates well with the web — but I can’t shake the feeling that maybe the WebAssembly
standard will be better without their participation for a time.

[long and somewhat inscrutable manifesto]: https://www.assemblyscript.org/standards-objections.html

Once I took AssemblyScript off the top of the list of possibilities I looked for
alternatives, but ultimately [Rust] was the obvious choice. It’s a language I have wanted to
learn anyway.

[rust]: https://www.rust-lang.org/

## Adopting Rust

I have previously spent a little bit of time playing with Rust, but this was certainly a
more thorough experience. It was helpful to understand that since I was building something
that would solely target WebAssembly I could rely on [wasm-pack] to take care of a lot of
the build details.

[wasm-pack]: https://github.com/rustwasm/wasm-pack

### Tests

Getting tests working was also made pretty simple thanks to wasm-pack and [wasm-bindgen].
The standard way of writing tests in Rust is to put the tests in the same file as the code
under test, inside a `tests` module. Here’s an example from [`ray.rs`]:

[wasm-bindgen]: https://github.com/rustwasm/wasm-bindgen
[`ray.rs`]: https://github.com/limulus/penumbra/blob/3558cf6/wasm/src/ray.rs#L27-L40

```rust
#[cfg(test)]
mod tests {
  use super::*;
  use wasm_bindgen_test::*;

  #[wasm_bindgen_test]
  pub fn creating_and_querying_a_ray() {
    let origin = Tuple::point(1.0, 2.0, 3.0);
    let direction = Tuple::vector(4.0, 5.0, 6.0);
    let r = Ray::new(origin, direction);

    assert_eq!(r.origin, origin);
    assert_eq!(r.direction, direction);
  }
```

One downside to having all these tests in Rust means there is no obvious way to get them
running on this site. As a result, I’ve taken down the test page that allowed you to run the
JavaScript tests in your browser. I might explore that at some point, but its not a priority
for me right now.

### Using SIMD Instructions

If you’re not familiar with “Single Instruction, Multiple Data,” it is a category of
instruction sets CPUs implement to speed up calculations where you need to perform the same
series of operations over different sets of variables. This comes in handy for things like
matrix math. If you are old enough, you may even remember when SIMD instruction sets began
to be added to processors: [MMX] on Intel and [AltiVec] for PowerPC. These days the common
SIMD instruction sets are [AVX] on Intel or AMD processors and [Neon] on ARM processors.

[mmx]: https://en.wikipedia.org/wiki/MMX_(instruction_set)
[altivec]: https://en.wikipedia.org/wiki/AltiVec
[avx]: https://en.wikipedia.org/wiki/Advanced_Vector_Extensions
[neon]: https://en.wikipedia.org/wiki/ARM_architecture_family#Advanced_SIMD_(Neon)

Of course, WebAssembly is a virtual machine. You can’t just throw AVX and Neon instructions
in the WASM file. Instead, WebAssembly has defined SIMD instructions that get compiled into
the SIMD instructions for whatever architecture the browser is running on. In Rust these are
exposed as compiler intrinsics in the [`std::arch::wasm32`] module.

[`std::arch::wasm32`]: https://doc.rust-lang.org/core/arch/wasm32/index.html

WebAssembly’s SIMD instructions are all fixed-width, operating on 128-bit wide operands. So
for example there’s `u8x16` instructions for addition, subtraction, multiplication,
division, comparisons, etc. that operate on 16 8-bit unsigned integers packed into 128-bit
wide registers. Likewise, there are instructions for `i8x16` for signed 8-bit integers and
`f32x4` for 32-bit floating point values.[^simd-instructions]

[^simd-instructions]:
    In addition to `u8x16`, `i8x16`, `f32x4`, and `f64x2` there are also instructions for
    `u16x8`, `i16x8`, `u32x4`, `i32x4`, `u64x2`, and `i64x2`. With all the ways you might
    want to slice 128-bit wide operands and all the different operations you want to do for
    each way of slicing, this makes for a lot of instructions!

Here’s an [excerpt from `matrix.rs`] showing the multiplication operator implementation for
`Tuple` and `Matrix4`.

[excerpt from `matrix.rs`]: https://github.com/limulus/penumbra/blob/3558cf6/wasm/src/matrix.rs#L222-L238

```rust
impl Mul<Tuple> for &Matrix4 {
  type Output = Tuple;

  fn mul(self, other: Tuple) -> Tuple {
    let mut sum = f32x4_splat(0.0);
    for i in 0..4 {
      sum = f32x4_add(
        sum,
        f32x4_mul(
          f32x4_splat(other.get(i)),
          self.col_v128(i),
        )
      );
    }
    Tuple::from_v128(sum)
  }
}
```

Now that I have implemented everything using explicit WebAssembly SIMD intrinsics, I am
wondering if I should have looked more closely at the still-experimental [portable SIMD]
module. The main benefit is that I could also target non-SIMD WebAssembly and compare the
performance. I could probably also more easily make use of WebAssembly’s [relaxed SIMD]
which includes instructions like [`f32x4_relaxed_madd`] that would likely speed up matrix
multiplication noticeably.

[portable simd]: https://doc.rust-lang.org/std/simd/
[relaxed simd]: https://github.com/WebAssembly/relaxed-simd/blob/95dc80e/proposals/relaxed-simd/Overview.md
[`f32x4_relaxed_madd`]: https://doc.rust-lang.org/stable/core/arch/wasm32/fn.f32x4_relaxed_madd.html

#### Speaking of `f32x4_relaxed_madd`… {#f32x4_relaxed_madd}

…I’m curious how switching the above `Tuple * Matrix4` implementation to it would perform.
So I spent around two hours trying to get it to work, to no avail. I think the problem
is that [walrus], which is used by `wasm-bindgen`, does not yet seem to support the relaxed
SIMD instructions. It throws this error when it hits the `f32x4_relaxed_madd` instruction:

[walrus]: https://github.com/rustwasm/walrus

```txt
Error: failed to deserialize wasm module

Caused by:
    0: failed to parse code section
    1: Unknown 0xfd subopcode: 0x105 (at offset 312376)
```

Maybe this should not be too much of a surprise, considering Relaxed SIMD doesn’t quite yet
have wide support. It’s shipping in Chrome currently and behind a feature flag in Firefox.
It looks like Safari may be getting it soon based on [this WebKit commit] from 2023,
although it’s not a feature flag in [Safari Technology Preview].

[this WebKit commit]: https://commits.webkit.org/265324@main
[Safari Technology Preview]: https://developer.apple.com/safari/technology-preview/

## Wait, What’s That Weird Artifact in the Top Left of &lt;sphere-shadow-wasm&gt;?

I’m actually not sure! There’s 8 or pixels that are transparent, so if you are viewing the
site in dark mode they will look black, and if in light mode they will look white. I haven’t
spent too much time trying to figure it out, but I must be doing something wrong when
copying the image data from WASM world to JS world, or thereabouts.

## Detours

This entry took a while to get completed thanks to various detours I took. The bulk of the
Rust work was actually done pretty quickly. It maybe took a month or less. But I took a
number of detours to work on this site, including adding support for serving videos and
breaking apart the repository into three repositories. There’s now the [penumbra] repo for
the core library, [penumbra-www] for this website, and [touch-pad] which is now available as
an independent [npm package].

[penumbra]: https://github.com/limulus/penumbra
[penumbra-www]: https://github.com/limulus/penumbra
[touch-pad]: https://github.com/limulus/touch-pad
[npm package]: https://www.npmjs.com/package/touch-pad

## What’s Next?

With so much time spent on the above detours I’m looking forward to finally starting the
next chapter of the book, which is “Light and Shading”. I’ll be screen recording as I work
on it, so I might also produce some kind of video, likely focused on whatever demo I create.
