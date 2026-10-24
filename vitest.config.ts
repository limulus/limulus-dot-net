import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    resolveSnapshotPath: (testPath, snapExtension) => testPath + snapExtension,
    projects: [
      {
        // A spec importing @limulus/lemmon-shell gets the linked checkout's `src/`, as
        // `node --conditions=source` does. Specs run in Vite's server environment, which
        // reads `ssr.resolve`; the list is Vite's server defaults with `source` in front,
        // since setting it replaces them.
        ssr: {
          resolve: { conditions: ['source', 'module', 'node', 'development|production'] },
        },
        test: {
          name: 'unit',
          include: ['infra/test/**/*.spec.ts', 'bin/**/*.spec.ts', 'lemmon/**/*.spec.ts'],
          exclude: ['node_modules/**', 'dist/**'],
          environment: 'node',
        },
      },
      {
        test: {
          name: 'integration',
          include: ['infra/test/integration/**/*.test.ts'],
          exclude: ['node_modules/**', 'dist/**'],
          environment: 'node',
        },
      },
    ],
  },
})
