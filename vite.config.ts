import { defineConfig } from 'vite'

export default defineConfig({
  build: {
    lib: {
      entry: 'src/index.ts',
      name: 'DomWhiteboard',
      fileName: 'dom-whiteboard'
    }
  },
  test: {
    globals: true,
    environment: 'jsdom'
  }
})