---
tags: journal
layout: penumbra-journal-entry
title: 'How I Am Using GitHub Copilot'
date: 2024-03-23 15:15:00 -07:00
image: poster.jpeg
teaser: >-
  A six minute video I produced to show how I am using GitHub Copilot as I work on
  my ray tracer, Penumbra. Includes a preview of the upcoming switch to Rust/WebAssembly!
---

<video-on-demand vod="github-copilot-demo/01HTWVCE0J15PDF91C8969JXHH"></video-on-demand>

<script type="module" src="../../assets/js/video-on-demand/index.js"></script>

Above is a video I produced to demo [GitHub Copilot] to my coworkers. If you haven’t yet
explored using a Large Language Model to you help you code, it is worth a watch. I
screen-recorded myself developing an optimization for [Penumbra](/) (this project) and
edited it down to about 6 minutes.

[github copilot]: https://copilot.github.com

I use Copilot in other ways not covered in the video. It’s clearly been trained on other
[Ray Tracer Challenge] implementations so it very quickly autocompletes tests with all the
exact values. This has saved me a bunch of mindless typing. It also autocompletes production
code that satisfies the tests, which is often less helpful for this project since I usually
want to spend some time thinking about how to implement these things. But sometimes I turn
it back on to get suggestions that prompt me to consider a different and potentially better
solution.

[ray tracer challenge]: https://pragprog.com/titles/jbtracer/the-ray-tracer-challenge/

If you’ve read my previous posts you’ll notice that I’ve switched to [Rust] targeting
[WebAssembly]. There’s a story behind that! But it will have to wait for a future post.

[rust]: https://www.rust-lang.org
[webassembly]: https://webassembly.org

Making this video was a lot of fun! A little less fun was navigating how to host video on
this site without introducing a dependency on a third-party. There’s a good reason why just
about everyone uploads to YouTube — doing this reasonably well is not easy. This may wind up
needing to be a journal entry or even video of its own.
