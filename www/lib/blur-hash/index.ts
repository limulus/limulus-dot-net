import { BlurHash } from '@limulus/blur-hash'

// esbuild bundles no `new Worker(new URL(…, import.meta.url))`, so the site bundles the
// package's worker itself, as `worker.ts` beside this file, and the build puts its hashed
// name in for the placeholder. Set before the element is defined, since a defined
// `<blur-hash>` starts decoding at once.
BlurHash.workerUrl = '/lib/blur-hash/worker.XXXXXXXX.js'
BlurHash.define()
