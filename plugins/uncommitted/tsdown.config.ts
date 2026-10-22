import { defineConfig } from 'tsdown'

export const config = defineConfig({
  entry: ['src/index.ts'],
  platform: 'node',
  format: 'esm',
})

export default config
