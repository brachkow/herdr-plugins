import { defineConfig } from 'tsdown'

export const config = defineConfig({
  entry: ['src/index.ts', 'src/reset.ts'],
  platform: 'node',
  format: 'esm',
})

export default config
