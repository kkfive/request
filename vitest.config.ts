import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    setupFiles: ['./test/setup.ts'],
    server: {
      deps: {
        inline: ['vitest-package-exports'],
      },
    },
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.d.ts', 'src/type.ts'],
      reporter: ['text', 'html'],
    },
  },
})
