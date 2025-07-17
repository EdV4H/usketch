import { defineConfig } from 'tsup'

export default defineConfig({
  entry: [
    'src/index.ts',
    'src/setup.ts',
    'src/dom-helpers.ts',
    'src/async-helpers.ts',
    'src/canvas-helpers.ts',
    'src/storage-mocks.ts',
  ],
  format: ['esm', 'cjs'],
  dts: false, // We'll generate declarations with tsc separately
  clean: true,
  sourcemap: true,
  splitting: false,
  treeshake: true,
  external: ['vitest', '@testing-library/jest-dom'],
  esbuildOptions(options) {
    options.platform = 'node'
  },
})