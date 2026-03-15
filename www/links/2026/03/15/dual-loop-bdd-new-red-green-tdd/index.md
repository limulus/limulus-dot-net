---
tags:
  - article
  - link
author: eric
linkTitle: Dual-loop BDD is the new Red-green TDD
date: 2026-03-15 10:47:46 -07:00
linkUrl: https://justin.searls.co/posts/dual-loop-bdd-is-the-new-red-green-tdd/
teaser: >-
  Agents prompted with “red-green TDD” write most of the tests first, then all the code —
  skipping the part of TDD that actually matters. Dual-loop BDD might be a better prompt
  strategy.
---

[Justin Searls][link]:

> My initial prompt simply told the agent to practice “red-green TDD” (a phrase I had never
> heard of until it was discovered that LLMs apparently interpret it as “real TDD”). This
> approach turned out to be woefully insufficient. Why? Because agents follow the path of
> least resistance and will invariably write a shitload of unit tests chasing the local
> maximum of code coverage without any regard for the global maximum of making sure shit
> actually works.

While I haven’t had _bad_ results from the `red-green TDD` prompt trick, Claude Code has not
been doing what I expected with this instruction. What I see is that it:

1. Writes most, if not all, of the tests first.
2. Runs the tests to see them fail.
3. Writes the implementation.
4. Runs tests again, and if they don’t pass, fixes the implementation and/or the tests in a
   single step. (Opus 4.6 will often say something along the lines of “I’ll fix the tests
   and the code simultaneously.”)

This is not TDD! At least not as I know it and use it. What I expect the agent to do when
told to TDD is something more like this:

1. Write a single test.
2. Run the tests to make sure it fails in a _nontrivial and expected way_.
3. Write a minimal amount of code to make the test pass (and run the test again to make sure
   it passes).
4. Refactor the code, and run the tests to make sure they still pass.
5. Repeat until the planned change is complete.

This is why it has been puzzling to me to see folks say that the `red-green TDD` prompt is
actually getting agents to do TDD. You’re not doing TDD if you are writing all the tests at
once and seeing them all fail for trivial reasons like nonexistent
symbols/methods/properties. You actually need to see the expectations of the tests fail for
you to be sure that they are justifying their existence.

I suspect part of the confusion here is that TDD is a buzzword that has lost its original
meaning, so when people say their agents are doing TDD they don’t know that they’re not.

Apparently though, Justin has gotten Opus 4.6 to do something a lot closer to what I have
been expecting:

> So yesterday I updated the prompt with the more sophisticated dual-loop approach developed
> by folks like [Dan North] and other adherents of [behavior-driven development] in the late
> aughts. It is best illustrated by two concentric circles: you begin each feature with a
> failing integration test, then dive into an inner loop for numerous red-green-refactor
> iterations of unit tests, then pop back out again once the outer loop’s integration test
> passes.

[Dan North]: https://dannorth.net/
[behavior-driven development]: https://en.wikipedia.org/wiki/Behavior-driven_development

I was [expecting] that we’d need a mode or custom agent workflow to pull this off. I’m still
doubtful that strictly adhering to a prompted workflow like this is a strength of agents,
but I’ll have to give this a try.

On a related note, I’ve started wondering if agents really need such a fine-grained TDD
loop. Maybe we just need to ask them to present the tests they plan to write during the
planning phase, in BDD style.

[expecting]: /links/2026/02/03/where-are-the-test-driven-agentic-workflows-anyway/
