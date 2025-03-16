---
tags:
  - article
layout: article
author: eric
title: Workout Exporter
subhead: >-
  I finally made an iOS app.
date: 2025-03-15 23:10:00 -07:00
hero: workout-exporter-development
---

Last year, I got a GoPro HERO12 Black, which I have been using to record my bike rides.
Naturally, I also track these as workouts using my Apple Watch. I’ve been thinking it might
be neat to synchronize a map, heart rate, and other data from HealthKit with the video. It
probably won’t make for a particularly compelling watch, but it’s something I’d like to
have.

The rough plan to make this work is to do the following:

1. Make a little iOS app for exporting workouts into a machine readable format, preferably a
   standardized format so it can be used for other purposes.
2. Write a program that reads both the workout data and an XML export for a Final Cut Pro
   project and generates a WebVTT file with the workout data in JSON. This [WebVTT] file
   would then be included as a track alongside the video.
3. Create web components that overlay or go alongside the video to display the data.

[webvtt]: https://en.wikipedia.org/wiki/WebVTT

One of these components is a map, something I’ve already worked on for [my photos]. For
example, scroll down on [One Long Cut] to see a map of where it was taken.

[my photos]: /photos/
[one long cut]: /photos/one-long-cut/

Anyway, I’ve been working on the first step of this plan and now have something to show for
it! I’m calling it simply [Workout Exporter]. It’s a SwiftUI app that lets you choose a
recent workout, writes a [TCX] file with the workout data, and lets you export it using a
share sheet where you can AirDrop it or save it to Files.

[workout exporter]: https://github.com/limulus/workout-exporter
[tcx]: https://en.wikipedia.org/wiki/Training_Center_XML

There are still some rough edges, particularly with export naming and the fact that it
shares is a `.txt` instead of a `.xml` or `.tcx` file. I’ll refine this over time, as I’ll
undoubtedly need to tweak the export at some point.

This was also my first time doing assisted coding with Claude as an LLM and also with
[Claude Code] — or any coding agent for that matter. Since my experience with SwiftUI is
limited, this is a case where LLM assistance was helpful in learning idioms that Apple’s
documentation alone rarely conveys. I’ll be trying it out more with the next step of this
project to get a better feel what working with an agent is like when it comes to a language
I am considerably more familiar with.

[claude code]: https://github.com/anthropics/claude-code
