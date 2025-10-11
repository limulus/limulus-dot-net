---
title: Private Branches in Public Repos
layout: article
author: eric
date: 2025-10-11 14:47:00 -07:00
tags: [article]
teaser: >-
  Today I learned that you can approximate the ability to have private branches in a public
  GitHub repo by creating a private “fork” and making use of multiple remotes.
---

Something that’s semi-frequently bugged me about having this site be statically generated
from flat files in a [public GitHub repository] is how to deal with drafts of posts. I want
to be able to save my progress “in the cloud” so that I can pick it up on other machines
without making anything half-baked publicly accessible.

[public GitHub repository]: https://github.com/limulus/limulus-dot-net/

The way I have been dealing with this is to use a persistent GitHub Codespace where changes
can just sit untracked. But this means waiting for the Codespace to initialize when I start
working on something, dealing with it pausing after inactivity, or even paying a bit for it
if I go over GitHub’s free allotment. Without increasing the number of vCPUs on the
Codespace, it’s also significantly slower than any machine I would use.

So a few times I’ve gone looking for a better solution to this problem and I’ve come up
empty. But last night I decided to try again, and I gave [this prompt] to Claude:

[this prompt]: https://claude.ai/share/6c771cdd-77b1-4d6a-ba40-bba69f57d4b7

> I wish I could have encrypted WIP branches in public GitHub repos. Does such a thing
> exist?

The response told me a bit about encryption options, but the first two alternatives it gave
hints at something better:

> 1. Private branches - Just use a private repo for WIP, then move to public when ready
> 2. Fork workflow - Keep your fork private while the upstream is public

This made something click for me. If I created a private fork that only exists to store
branches of work-in-progress, then I could add it as a remote to clones of the public repo.
This would effectively let me have “private branches”! Finally!

I’ve implemented this by creating an empty private GitHub repo, added it as a remote named
`private`, pushed up everything from the original, and renamed the `origin` remote to
`public`. This rename makes sure I will need to explicitly specify a remote when pushing new
branches, preventing accident pushes to the public repo.

```bash
git remote add private https://github.com/limulus/limulus-dot-net-private.git
git push private --all
git remote rename origin public
git checkout -b my-wip
git push -u private my-wip
```

When it comes time to merge my work into the public `main` branch, I can do this easily with
plain old `git merge`. If there’s intermediate commits in the branch that I don’t want to be
public I can always rebase or squash.

GitHub unfortunately does not track this separate private repo as a fork. That (plus the
public/private dichotomy) means I can’t directly make PRs from the private repo. If I were
using a PR based workflow, I expect that would have to reset the upstream of the branch to
`public` and then make a PR. But that’s not something I’m planning on doing with this
project.

This is one of those things where I feel a little silly for not realizing this was possible.
It’s obvious in retrospect that the ability to have multiple remotes in a repository would
allow for this. But it’s a git feature I’ve used at most once before.
