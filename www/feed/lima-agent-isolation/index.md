---
tags:
  - article
layout: article
author: eric
title: Using Lima for Coding Agent Isolation
date: 2026-06-19 15:28:00 -07:00
hero: saguaro-bouquet
teaser: >-
  With a bit of configuration, I started using Lima to contain Claude Code running in auto
  mode.
---

A number of months ago, before [auto mode] was made available, I had started using Claude
Code’s `--dangerously-skip-permissions` flag (YOLO mode). Up until then I had been using
`claude`’s [sandbox], but it has (or maybe had) a number of annoying issues with things like
`git` on macOS. So I decided I would try YOLO mode, but to mitigate the blast radius by only
running it in a [dev container].

[auto mode]: https://code.claude.com/docs/en/permission-modes#eliminate-prompts-with-auto-mode
[sandbox]: https://code.claude.com/docs/en/sandboxing
[dev container]: https://containers.dev/

I’d dabbled with dev containers previously, even using [GitHub Codespaces] until I
discovered a way to effectively have [private WIP branches]. Local dev containers are nicer
than having to pay for a slow cloud instance, but they are also annoying. I never
established a good mental model of what VS Code plugins ran in the host or container and why
some would not be automatically reinstalled after a container rebuild. One of the sillier
annoyances is how there seems to be no simple way to get a container to adopt the host’s
timezone. Then there’s the fact that the standard dev-container approach means having a
container for each project, which seems like an annoying amount of duplicate configuration.
And somehow containers running in Docker also just seemed slower than they ought to be.

[private WIP branches]: /tils/git/private-branches-in-public-repos/
[GitHub Codespaces]: https://github.com/features/codespaces

So eventually I just stopped using them, and started running `claude` as my user directly on
my Mac, relying on auto mode’s protections. Then a slightly unsettling thing happened with
Claude Opus 4.8.

I had an item in the project’s `BACKLOG.md` to enable branch protection on the `main` branch
to keep an agent in YOLO mode from pushing to `main` and triggering a release. I had
`claude` in auto mode start working on this. Even though the backlog item spelled out why
the protection should exist, `claude` nevertheless used the GitHub client `gh` command with
my credentials to get around the branch protection on `main` and merge its own commits!

The irony of this was too much for me to bear, so I decided I really needed to make sure
`claude` was properly isolated from commands that it can use with my credentials. Now, to be
fair, my git credentials in my dev containers are just as readily available as they are on
the host. And while I don’t think I have the `gh` command set up in any of my containers,
it’s not an unreasonable thing to have set up either. What I really needed was an
environment that — aside from Claude Code itself — does not have access to my
credentials for any service.

This led me to do a bit of research, where I learned about [Lima]. It manages and runs
Linux virtual machines that, on macOS, feel to me like a lightweight Docker. I’ve
started using a single Lima VM to run `claude` in, mounting my entire `~/Developer`
directory[^developer-dir] and `~/.agents/skills` directory. So long as I avoid putting
credentials into this VM, it’s considerably safer to use Claude Code in auto mode
from within it.

This setup addresses many of my gripes with using dev containers. It requires only one
VM and configuration for all my projects, inherits the timezone of the host, and
feels faster than Docker-based dev containers.

[Lima]: https://lima-vm.io/

[^developer-dir]:
    If you didn’t know, `~/Developer` has long been the canonical location for
    your software projects on macOS. It even gets its own special [icon] in the Finder.

[icon]: https://www.cocoadelica.co.uk/blog/default-folder-icon-in-macos

I’ve done a few things to the [Lima configuration][][^cochineal] that help make this
setup have as little friction as possible. First, I have the VM setup script install
[my dotfiles]. I also have two custom zsh commands in the VM that help with
`node_modules` isolation: `nmlocal` binds `node_modules` to VM-local storage and
`nmstatus` lists those active mounts. This avoids issues with sharing `node_modules` between
the host and guest platforms, though there’s some cognitive overhead with needing to
maintain this. Finally, on the host, I added a [zsh function] for `limactl shell` that, when
run inside a directory in `~/Developer`, puts me in the matching directory in the VM.

[my dotfiles]: https://github.com/limulus/dotfiles/tree/main

[^cochineal]:
    You might notice that the VM’s name is [cochineal]. My host naming
    scheme has been Sonoran Desert flora for quite some time, so it seems fitting to use the
    name of an insect that lives on prickly pears as a VM name.

[Lima configuration]: https://github.com/limulus/dotfiles/blob/ec7d68d8e4a2c1036e2f7a82fa9bf452c453bc3f/.config/lima/cochineal.yaml
[cochineal]: https://en.wikipedia.org/wiki/Cochineal

Lima auto-forwards ports onto the host, similar to dev containers. This can be convenient
for things like [difit], but there’s a rough edge for things like dev servers. If your dev
server watches files for changes, and you make edits using an editor running on the host,
you’ll realize that file system events are not propagated from the host to the VM.
However, this does work the other way around — a change to a file made in the VM does
trigger file system events on the host. You can configure file watchers like [Chokidar] to
poll the filesystem for changes, but just running dev servers from the host is probably a
reasonable solution.

[difit]: https://github.com/yoshiko-pg/difit
[Chokidar]: https://github.com/paulmillr/chokidar
[zsh function]: https://github.com/limulus/dotfiles/blob/ec7d68d8e4a2c1036e2f7a82fa9bf452c453bc3f/.zshrc#L71-L81

It won’t surprise me if Anthropic soon ships a feature to use a local VM built into Claude
Code itself. ([Claude Cowork] actually already uses one for executing commands.)
It’s ultimately still an awkward solution, but it’s what we have until macOS and other
desktop operating systems get better APIs to ensure that processes spawned by agents do not
automatically have the same access to the user’s credentials that user-spawned commands do.

[Claude Cowork]: https://claude.com/product/cowork
