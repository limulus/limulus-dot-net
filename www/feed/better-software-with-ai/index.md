---
tags:
  - article
layout: article
author: eric
title: Choosing to Make Better Software With AI
date: 2026-04-04 10:30:00 -07:00
hero: all-in-all-by-beth-lipman
subhead: >-
  It feels like software quality has been on the decline. It’s understandable to think AI
  will make it all worse. Yet agentic engineering gives us a real opportunity to do better.
---

With some notable exceptions[^except], there’s something important missing from what I read
about AI and how it’s affecting software engineering: the enormous opportunity that [agentic
engineering] is giving us to significantly improve software quality.

If this sounds completely bonkers to you — keep reading. My goal with this piece is to help
you understand why I think this is true.

If this makes you say “well of course” — keep reading. My goal is to help you communicate
this idea to our rightfully skeptical peers. I think we may be intuiting something that is
not obvious to everyone.

If you have other reservations about AI — I’m not addressing them here.[^out-of-scope] But
reading this may help you understand why so many software engineers are adopting agentic
engineering despite qualms they may share with you.

[^except]:
    Except of course Simon Willison [wrote something along these lines][better-code]
    as I was sitting on a first draft. Go read that too!

    It looks like Gergely Orosz, [writing for Substack], may have also [posted about
    this][slowing-us-down]. I have not read the full post, since I cancelled my paid
    Substack subscriptions back in 2023, due to their insistence on [hosting
    white-supremacist content][nazi-bar].

[^out-of-scope]:
    This is not to say that I have not given a great deal of thought to
    environmental and ethical concerns around generative AI. I have. But a lot of the
    anti-AI discourse feels to me like moral panic where many claims do not hold up to
    scrutiny and a fair assessment does not result in a slam dunk case against it. Maybe I
    will write about this some day, but my bandwidth to write long-form is not as wide as I
    wish it was.

[agentic engineering]: https://simonwillison.net/guides/agentic-engineering-patterns/what-is-agentic-engineering/
[better-code]: https://simonwillison.net/guides/agentic-engineering-patterns/better-code/
[writing for Substack]: https://www.anildash.com/2024/11/19/dont-call-it-a-substack/
[slowing-us-down]: https://newsletter.pragmaticengineer.com/p/are-ai-agents-actually-slowing-us
[nazi-bar]: https://arstechnica.com/tech-policy/2025/07/substacks-nazi-problem-wont-go-away-after-push-notification-apology/

## The Contradiction

It seems impossible: how can generative AI — so well known for generating low quality output
that everyone agrees to call it “slop” — actually produce quality software? Even when coding
agents iterate on writing code, surely the end result would only get worse with each pass.

And it can be like this. In the hands of someone who is ignorant to what quality software
looks like, the end result will be slop. Like a house where the owner adds room after room
with no architect, no structural engineer, further changes become increasingly dangerous.

{% renderTemplate 'webc' %}
<article-photo id="through-the-cone-by-jaroslava-brychtova-and-stanislav-libensky" placement="right"></article-photo>
{% endrenderTemplate %}

But in the hands of someone who cares about quality and knows what it looks like, things can
play out differently.

## A Baseline Workflow For Quality

Let me set a baseline for what I think reflects the current state of how a software engineer
that cares about quality typically works with agents to make a code change. At least, this
is what I have found myself doing.

1. Plan the changes with the agent, using the agent’s planning mode.
2. Refine the plan with the agent by asking for clarifications, pushing back on assumptions,
   resolving ambiguities, discussing rationales, but also being open to approaches the model
   suggests.
3. Once the plan is acceptable, let the agent loose to edit files and iteratively run
   validation until it thinks the change is complete.
4. Review the changes, asking for either clarifications or refactors as potential issues
   are found. Repeat until it’s good to commit the changes.

A common lament is that reviewing changes to AI-generated code is tiresome. I think this
manifests in two main ways: lots of changes that superficially look fine but may have subtle
issues; and code that is very wrong and requires a frustrating number of changes. However,
this can be mitigated:

- Using the best (larger/slower) model. Today, that’s Claude Opus 4.6. Sure, some kinds of
  straightforward refactors a smaller/faster model will perform fine. But my experience is I
  typically regret being stingy with model choice. I find that Opus 4.6 avoids things like
  making meaningless test assertions that make review tricky.
- Avoiding AI providers like GitHub Copilot that do per-prompt pricing, which punishes
  conversational approaches towards refinement and understanding.
- Iterating on the plan before letting the agent make changes helps prevent too many things
  being wrong.
- Demanding 100% test coverage as part of the validation in step 3 ensures every branch gets
  a test, which further reduces the chance for the agent to introduce non-functional code.

What I’m finding with this process is that the refactors I ask for as part of step 4 are
largely about simplification, organization, addressing code smells, or discovering there’s
some unwanted consequence of the implementation I didn’t foresee during planning. These
kinds of problems are far more interesting to find and tackle, making code review less
tiresome and more engaging.

## Going Beyond the Baseline

If we stopped here I’d say we are getting about the same level of quality software as we’d
get with doing proper Test Driven Development, but with the speed advantage of not having to
type everything out manually. I would argue this alone justifies adopting agentic
engineering, so long as we are keeping our changes small and incremental enough to avoid
accumulating [cognitive debt].

{% renderTemplate 'webc' %}
<article-photo id="lynx-after-duerer-by-marta-klonowska" placement="left"></article-photo>
{% endrenderTemplate %}

But we don’t have to stop here! There’s a whole lot more we can now do to improve the
quality of our software with a coding agent’s help.

[cognitive debt]: https://margaretstorey.com/blog/2026/02/09/cognitive-debt/

### Testing Infrastructure

Have you ever felt like you had no choice but to put a timeout or sleep in a test? You know
it’s bad because this makes tests slow and flaky, but you do it anyway because the
alternative is creating some kind of event system.

Or have you ever avoided writing integration tests and smoke tests, because staging an
environment they can run in is high effort?

Have you avoided things like performance tests, automated mutation testing, fuzz testing,
fault injection, static analyzers, and accessibility scanners?

Well, now you’re probably only a prompt or two away from integrating these things in your
codebase. All of these things got dramatically more accessible with coding agents and they
can have a marked effect on both quality and security.

Of course, this testing infrastructure is code too, so we do need to consider its quality as
well. It needs to be understandable, fast, and deterministic.

### Documentation

Something I have started doing is creating [Architecture Decision Records][adr]. These are
documents that detail various decisions about how the software works or is written, and the
rationale for the decisions. These documents come out of either planning sessions or
refactors. Writing these things by hand would be a bore, so I have the agent write them, and
give them a quick proofread.

This is something I would never bother with if it weren’t for coding agents. Not just
because writing them is a chore, but because I know that no one is going to bother reading
them. But the trick here is that during planning an agent will read the ones relevant to
their prompt! This is the sort of thing that is incredibly helpful to keep a codebase on the
rails.

Commit messages are another place where I typically let the agent with context for the
changes do the writing for me. It does a good enough job for the value that commit messages
provide. (I find that few people read my commit messages, despite the effort I put into
them.) If your commit messages read like `updated reticulator.ts`, leveraging the agent’s
context is an easy win for better communication around your changes.

[adr]: https://adr.github.io

### Refactors

If you’ve got an older codebase, chances are there are lots of large refactors you want to do
but don‘t have the time for. If you have good test coverage, agents can reduce the effort
required and let you refactor sooner.

{% renderTemplate 'webc' %}
<article-photo id="forest-glass-by-katherine-gray" placement="right"></article-photo>
{% endrenderTemplate %}

Alas, if it’s an active codebase with more than a few contributors, this won’t help avoid a
large refactor being disruptive. Still, agents can reduce the effort of splitting out
inactive areas of the code into microservices or micro-frontends to allow a refactor to a
portion of the code.

### Mitigating the Maintenance Burden

A high quality codebase feels heavy. It’s got _lots_ of tests — probably an order of
magnitude more test code than production code. It’s also got lots of tools to format, lint,
type check, and otherwise validate code. It makes judicious use of libraries to avoid
repeating the mistakes of others. Keeping these tools and libraries up-to-date has
significant maintenance cost. Attempts to automate this work have not been that successful,
but I suspect that this is going to start to change as we find ways to safely integrate
agents into automation, with things like [agentic workflows].

[agentic workflows]: https://github.github.com/gh-aw/

## Where This Is Heading

Having been experimenting with agentic engineering for a while now[^tcx2webvtt], I’ve come
to the conclusion that it gives us the ability to do more to ensure quality — whether that’s
creating tests we would have otherwise skipped or planning changes with a model that can
suggest approaches we may not have otherwise considered. As more people get familiar with
this workflow, I think the common wisdom of using AI in the process of creating software is
likely to flip from “it will result in lower quality software” to “not using it results in
lower quality software.”

I think that will happen even if LLM capability has already plateaued.

As the common wisdom changes, more and more folks who have been resistant to adopting this
practice are going to get pushed to adopt it, in spite of their reservations. Being forced
through this kind of change stinks, which is why I’m glad that I’ve been exposing myself to
it.

For better or for worse, it seems likely that AI is going to happen to all of us. We’ll need
to find a way to be resilient in the face of that change. Using agentic engineering as an
opportunity to allocate more of my energy to improving the reliability, user experience, and
security of my software is how I am trying to do that.

[^tcx2webvtt]:
    Last year I built [tcx2webvtt] using Claude Code and what was an early form
    of a plan/code/review/refactor loop, using Sonnet 3.7 and 4.0.

[tcx2webvtt]: https://github.com/limulus/tcx2webvtt
