import process from 'node:process'
import { defineConfig, mergeConfig } from 'vitest/config'
import viteConfig from './vite.config'

// Node 25+ ships a broken global localStorage that shadows jsdom's Storage.
// Disable it in Vitest workers so jsdom can provide a working implementation.
// https://github.com/vitest-dev/vitest/issues/8757
const nodeMajor = Number.parseInt(process.versions.node.split('.')[0] ?? '0', 10)
const execArgv = nodeMajor >= 25 ? ['--no-webstorage'] : []

export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      environment: 'jsdom',
      setupFiles: ['./src/test/setup.ts'],
      include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
      execArgv,
    },
  }),
)
