---
tags:
  - article
  - link
author: eric
title: Where Are the Test Driven Agentic Workflows, Anyway?
date: 2026-02-03 16:56:10 -07:00
linkUrl: https://blog.fsck.com/2026/02/03/managing-agents/
---

[Jesse Vincent][link]:

> By my very uncharitable math, agentic software engineering methodologies have gotten to
> somewhere around the 1970s. Like everything in AI, this is, of course, a speed run. We’re
> very quickly relearning why software engineering management and software engineering
> project management matter.
>
> So by next Tuesday, maybe folks will start thinking about what they can steal from XP.

I’ve been thinking that we’re probably not that far away from seeing a decent boost in
quality from coding agents that implement a Test Driven Development workflow.

Based on my experience, it’s not really possible to get a coding agent to follow TDD on its
own by instructing it to. Even with the rules of TDD spelled out in an `AGENTS.md` or
similar, I’ve found that they will write tests simultaneously with the production code. They
don’t bother ensuring they see a test fail for the expected reason. I don’t know if that is
because the models themselves have trouble following the instructions, or if the agent’s
system prompts are interfering.

I honestly wouldn’t be surprised if next Tuesday Claude Code _does_ ship a TDD mode.
