import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: 'unit',
          include: ['infra/test/**/*.spec.ts'],
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
