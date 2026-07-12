import { test as base, expect } from '@playwright/test'
import type { GameState } from '../../src/game/types'

export const test = base.extend({
  loadFixture: async ({ page }, use) => {
    await use(async (fixture: GameState) => {
      await page.addInitScript((state) => {
        localStorage.setItem('office404-save-v7', JSON.stringify({ state, version: 4 }))
      }, fixture)
    })
  },
})

export { expect }
