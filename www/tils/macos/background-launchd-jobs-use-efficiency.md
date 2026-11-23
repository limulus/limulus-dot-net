---
title: “Background” launchd Jobs Only Use Efficiency Cores
layout: article
author: eric
date: 2026-11-22 16:08:19 -07:00
tags: [article]
teaser: >-
  Beware of launchd’s background process type sneaking into your Mac-based software factory.
---

As [previously noted], I am experimenting with running a software factory to create an Apple platforms app that I am using to post to this site. It runs on my Mac Studio with an M2 Max, which is hardly the most recent Mac hardware but still no slouch. I started noticing though that the factory was moving a lot slower than I would have expected it to.

As it turned out, there were two significant issues. The first was that builds were clearing the build outputs of the tests, [swift-markdown], and [SwiftSoup]. Rebuilds of these packages were taking up a third of the 47 minute build time.

The more interesting thing was that the `launchd` scheduled worker and shipping jobs had their `ProcessType` marked as `Background`. This was causing the builds to be confined to the M2 Max’s 4 efficiency cores, unable to use the 8 performance cores! That got builds down to 6.7 minutes (7x faster), and 5.2 minutes (9x faster) when package build output is retained.

[previously noted]: /links/2026/11/14/justin-searls-is-meat-proxy/
[swift-markdown]: https://github.com/swiftlang/swift-markdown
[SwiftSoup]: https://github.com/scinfu/SwiftSoup
