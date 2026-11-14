---
tags:
  - article
  - link
author: eric
linkTitle: Justin Searls Is a Meat Proxy
date: 2026-11-14 12:53:04 -07:00
linkUrl: https://justin.searls.co/posts/im-just-a-meat-proxy/
---

Justin Searls writing about his [agentic software factory][link] for Apple platform apps:

> Every one of my apps has a “Darn it!” button in its settings screen, thanks to an internal Swift package called `darn_it`. When I see anything I don’t like, a global keyboard shortcut or 4-finger gesture is all it takes to file a quick issue and keep moving.
> 
> Most of `darn_it`’s code is there to provide as much context and evidence as possible for the implementing agent:
> 
> - Each report includes a rolling recording of the last minute of screen activity and microphone audio, so the agent sees the bug and my narration of it (for the sake of token efficiency, the screencast is converted to a timestamped contact sheet of keyframes and the audio is transcribed and timestamped to match)
> - Build identity, device analytics, console logs, and network activity are all automatically attached to each report
> - Each app specifies an elaborate-by-human-standards internal URL routing scheme so that bug reports can include a URL that navigates directly to whatever state the app was in, saving the implementer from first clicking through a dozen screens to arrive at the relevant view
> - Attachments and telemetry are uploaded to S3 and a GitHub issue is filed against the relevant app’s repo
> 
> Then I put my phone down and forget about it. The backlog ebbs and flows based on how much I’m using each app in the suite. And because I’m filing every issue in the course of real-world use, none of it is speculative and none of it feels like work.

There’s a lot more to the process, including an app he cheekily calls “MeatProxy,” where agents flag work they need his actions to unblock. Instead of distributing this app and the `darn_it` package, he’s included a prompt that can be used to recreate a similar set of tools for yourself.

I’m going to be trying this out myself, as there’s at least one Apple platform app I’ve been wanting to have: a way to write posts for this site — which is tricky since its content is all in git. In fact, this will be the first post with this app! It’s already feeling great to be able to write in a native macOS text view instead of VS Code. With luck, this will let me post here much more frequently.

I haven’t used Justin’s prompt yet — I figure I should bootstrap a bit first with a long running session, and then have the agent use that context to determine how best to tailor the prompt to my idiosyncrasies.
