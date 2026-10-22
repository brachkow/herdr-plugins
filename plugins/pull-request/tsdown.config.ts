import { defineConfig } from 'tsdown'

export const config = defineConfig({
  entry: ['src/index.ts', 'src/open.ts'],
  platform: 'node',
  format: 'esm',
})

export default config
