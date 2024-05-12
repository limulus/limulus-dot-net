---
tags: journal
layout: penumbra-journal-entry
date: 2023-10-31 15:52:00 -07:00
title: Getting Nerd Sniped
teaser: >-
  I just want to start this challenge, but there’s a bunch of things I need to figure out
  first.
---

The way [The Ray Tracer Challenge] starts is refreshing. The “Getting Started” section
doesn’t spend time on any development environment setup. Instead it is a simple introduction
to the [Gherkin] syntax then a notes on some typical pitfalls. Then the first chapter gives
a brief introduction to points and vectors and throws its first test at you. It doesn’t even
remind you that you need to choose a language.

[the ray tracer challenge]: https://pragprog.com/titles/jbtracer/the-ray-tracer-challenge/
[gherkin]: https://cucumber.io/docs/gherkin/

I thought about what I wanted to use for my implementation. I could have chosen this as a
way to introduce myself to a new language, but I decided to initially go with something I
was familiar with: TypeScript compiled to JavaScript running in the browser. This way I
could focus on the ray tracer itself and demos would be easy to share. After some research I
also concluded that there is runway for performance enhancements like WebAssembly, WebGL and
WebGPU.

Unfortunately this raises lots of questions that all have to get addressed before I even get
started!

- What would I name the project?
- Where will I publish the site?
- What will I use to build the site?
- What test runner will I use? (My usual choice, Jest is great for a JSDOM environment, but
  that won’t work for advanced web features.)
- How do I hook up the Gherkin tests from the book to my test runner?

For the name after some poking around on Wikipedia I settled on “Penumbra”. There’s probably
some better names I could have chosen, but I couldn’t find any other ray tracers with that
name already.

Deciding on where to publish the site was pretty straightforward. My [personal site] would
make sense, but it’s all tied up with its own repository. I also don’t have any static site
generator for it. My [professional site] does have a static site generator ([Hugo]) but I
couldn’t convince myself it was an appropriate place for this project. So I decided to
create a new repository for the project and use [GitHub Pages] to publish it.

[personal site]: https://limulus.net/
[professional site]: https://unallocated.com/
[hugo]: https://gohugo.io/
[github pages]: https://pages.github.com/

My past experience with Hugo was alright, but Go template syntax kinda irks me. So I decided
to give [Jekyll] a try, seeing as how it is the default for GitHub Pages. This was the first
real [nerd snipe].[^1] Jekyll is written in Ruby, and I figured I could just install the gem
in my project. Unfortunately by default Ruby’s `bundle` tool does not by default install
gems in the project directory like I expect a package manager to work in this decade. It’s
possible to get it to work like this, but after frustration with current documentation on
how to do it not matching the version of Ruby that macOS ships with I decided to try to do
my development in a devcontainer. I got that working but wasn’t really happy with having to
run Docker locally just for this project.

[jekyll]: https://jekyllrb.com/
[nerd snipe]: https://xkcd.com/356/

After going back to the drawing board I started researching other static site generators.
That’s when I came across [Eleventy], which is a fast Node.js based site generator. I
actually had known about it for a number of months, but had completely forgotten about it.
So now that is what I am setting up and is what this site is using.

[eleventy]: https://www.11ty.dev/

Now of course I am getting nerd sniped trying to figure out how to use Eleventy and general
web design things:

- Why are [WebC] templates not working like I expect?
- How do I get a list of blog posts to show up on the home page?
- How do I get footnotes in a Markdown file to get rendered?

[webc]: https://www.11ty.dev/docs/languages/webc/

I’ve managed to work through these now, but I’ve run into issues with Eleventy’s dev server
not updating when it should and mysterious issues with the `webc:keep` attribute in bundling
mode. This has me wondering if my plan for using Eleventy’s dev server for development will
work out. But that will have to be the next entry…

[^1]:
    Because I have a an overly complicated project creation utility for personal
    TypeScript projects I always wind up starting a project by refreshing the dependencies
    for that utility. This time that led me to discovering that [node-git] has stagnated and
    is no longer providing up-to-date pre-compiled binaries for the latest versions of Node.
    This results in 3-6 minutes of compile time when installing node-git. Yikes! That’s a
    lot for a CLI utility that is supposed to be run via `npm create`. So I decided to spend
    the time to switch it over to [simple-git] which is pure JavaScript and doesn’t require
    any compilation. Thankfully I had written tests for the git functionality which did not
    mock out [node-git] and so swapping out the library was straightforward.

[node-git]: https://www.nodegit.org
[simple-git]: https://github.com/steveukx/git-js
