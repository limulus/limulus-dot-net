import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    resolveSnapshotPath: (testPath, snapExtension) => testPath + snapExtension,
    projects: [
      {
        test: {
          name: 'unit',
          include: ['infra/test/**/*.spec.ts', '11ty/**/*.spec.ts', 'bin/**/*.spec.ts'],
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
