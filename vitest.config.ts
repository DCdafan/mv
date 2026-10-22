import { resolve } from 'path'
import { defineConfig } from 'vitest/config'
export default defineConfig({
  resolve: { alias: { '@': resolve('src/renderer/src'), '@shared': resolve('src/shared') } },
  test: { include: ['tests/**/*.test.ts'] }
})
