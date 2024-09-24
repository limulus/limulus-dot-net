---
tags: journal
layout: penumbra-journal-entry
title: One More Yak to Shave
date: 2023-11-11 15:20:00 -07:00
teaser: >-
  Just one more yak to shave before I can get started on the first test.
---

The site is getting published. The CSS needs work. Now it’s time to try and get an
in-browser test runner working. For this I have two goals:

- I should be able to take the Gherkin tests from the book and easily use them
- The tests should be a part of this site

Initially I was thinking that I would use the Gherkin tests directly from the book — by
using some existing tool to parse them and provide hooks for wiring up the steps. But I’m
not really finding anything like that out there. I found [this approach][mocha-gherkin]
which defines functions for each of the Gherkin prefixes, maps them to Mocha functions,
which seems like a better approach.

[mocha-gherkin]: https://github.com/hyperjump-io/json-schema/blob/0d9b0fec778dfd46e4136987f03b9fcf0147ea39/lib/mocha-gherkin.spec.ts

[Mocha] also seems like a good choice for the test runner. And after a decent amount of trial
and error I got it working how I want. I even got Eleventy’s dev server to reload the page
when the code changes, which will be nice for development.

[mocha]: https://mochajs.org/

Remaining yak shaving tasks:

- Set up an RSS feed for this blog
- Redo site styles

But at this point I would rather get started on the first test. This stuff has taken up way
too much time already.
