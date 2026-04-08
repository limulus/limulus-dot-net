---
tags:
  - article
  - link
author: eric
linkTitle: Eight years of wanting, three months of building with AI
date: 2026-04-07 21:10:01 -07:00
linkUrl: https://lalitm.com/post/building-syntaqlite-ai/
viaUrl: https://simonwillison.net/2026/Apr/5/building-with-ai/
teaser: >-
  Lalit Maganti and I have a similar experience with the need to constantly refactor when
  building a project with a coding agent.
---

Lalit Maganti wrote a [remarkable account][link] of building [syntaqlite] using Claude Code:

> If you’re using AI to generate code at industrial scale, you _have_ to refactor constantly
> and continuously. If you don’t, things immediately get out of hand. This was the central
> lesson of the vibe-coding month: I didn’t refactor enough, the codebase became something I
> couldn’t reason about, and I had to throw it all away. In the rewrite, refactoring became
> the core of my workflow. After every large batch of generated code, I’d step back and ask
> “is this ugly?” Sometimes AI could clean it up. Other times there was a large-scale
> abstraction that AI couldn’t see but I could; I’d give it the direction and let it
> execute.

The whole post is worth reading. With the project I have been working on I have been having
similar experiences. Especially the need to always prioritize refactoring.

My current project recently reached the point where it was getting hard to reason about
areas of responsibility, so I decided it needed to be refactored into a monorepo. In non-AI
time, this is something I would have sat on for a while longer before begrudgingly taking it
on. But in AI-time, delaying this refactor would mean compounded deterioration of my
understanding of how the pieces of the codebase are interconnected.

Currently, I’m keeping a `BACKLOG.md` file in my project. It’s just a handful of sections
with bullet lists of to-dos. Right at the top is a section for refactors. If I think of a
refactor it becomes the very next thing to work on. I have yet to regret doing a refactor
before doing more feature work.

[syntaqlite]: https://lalitm.com/post/syntaqlite/
