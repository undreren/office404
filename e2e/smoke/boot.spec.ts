import { test, expect } from '@playwright/test'
import { createInitialState } from '../src/game/simulation/gameLogic'

test('boots and shows title', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByText('OFFICE 404')).toBeVisible()
  await expect(page.getByText('Loading save')).toBeHidden({ timeout: 10_000 })
})

test('fixture loader hydrates tutorial state', async ({ page }) => {
  const fixture = createInitialState(Date.now(), 99)
  await page.addInitScript((state) => {
    localStorage.setItem('office404-save-v7', JSON.stringify({ state, version: 4 }))
  }, fixture)

  await page.goto('/')
  await expect(page.getByText('Friendly Neighbor App')).toBeVisible({ timeout: 10_000 })
})
