---
title: Node.js Now Has TypeScript Type Stripping On By Default
layout: article
author: eric
date: 2025-11-01 13:45:00 -07:00
tags: [article]
teaser: >-
  Today I learned that Node.js has turned on TypeScript type stripping — even in recent
  releases of v22! Time to start running TS directly in Node! There's a bit of a catch
  though: you gotta drop enums.
---

Despite keeping up better with my RSS feed reader lately, I still missed that [Node.js
v22.18.0] enables TypeScript [type stripping] by default! Apparently it has also been
enabled in v24 since its initial release.

[Node.js v22.18.0]: https://nodejs.org/en/blog/release/v22.18.0
[type stripping]: https://nodejs.org/en/learn/typescript/run-natively

This is great news, because it means that with some important caveats, it is now possible to
run TypeScript natively in Node without needing to specify the `--experimental-strip-types`
flag. The caveats boil down to the fact that not every TypeScript language feature can be
cleanly stripped to create valid JavaScript — a small handful of features require the
TypeScript compiler to generate JavaScript code in order to fully function.

Luckily, in TypeScript v5.8 they introduced the [--erasableSyntaxOnly option]. This raises
errors when you use one of these features that would cause Node.js to throw a JS parse
error even after type stripping.

[--erasableSyntaxOnly option]: https://devblogs.microsoft.com/typescript/announcing-typescript-5-8/#the---erasablesyntaxonly-option

The full list of these non-erasable language features is thankfully small, and, in my usage
of TypeScript, quite manageable:

- `namespace`s and `module`s with runtime code
- `import =` aliases
- Parameter properties in class constructors (the shorthand where `class {
constructor(readonly foo: Bar) {} }` auto-creates a `foo` prop)
- `enum` declarations

I don’t think I’ve ever used executable code in a `namespace` or a `module` — the only time
I use those is if I need to extend global or package types. I don’t think I’ve ever used
`import =` aliases. And I can easily live without parameter properties.

Lack of enums is probably the toughest pill to swallow. But the TypeScript docs for enums
have a [good suggestion] — instead of creating an `enum` create an object with `as const`:

```typescript
export const Direction = {
  Up: 1,
  Right: 2,
  Down: 3,
  Left: 4,
} as const

export type DirectionEnum = (typeof Direction)[keyof typeof Direction]
```

Hopefully [this proposal] for an `as enum` assertion gets some traction, since it would be
nice to not need an extra `[Name]Enum` type.

[good suggestion]: https://www.typescriptlang.org/docs/handbook/enums.html#objects-vs-enums
[this proposal]: https://github.com/microsoft/TypeScript/issues/60790

There are two other TS options that are helpful for running type-stripped TS in Node:
`rewriteRelativeImportExtensions` and `verbatimModuleSyntax`. The former helps ensure you
can use `.ts` extensions in your `import` statements, and the latter avoids surprises from
top-level side-effects when `import`ing a TS module.
