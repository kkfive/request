import { defineConfig } from 'tsdown'

export default defineConfig({
  dts: true,
  exports: true,
  format: ['cjs', 'esm'],
  entry: ['src/index.ts'],
})
