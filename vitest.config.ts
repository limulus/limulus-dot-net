import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['infra/test/**/*.spec.ts'],
    exclude: ['node_modules/**', 'dist/**'],
    environment: 'node',
  },
})
