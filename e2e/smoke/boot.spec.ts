import { test, expect } from '@playwright/test'
import { dismissOnboarding } from '../helpers/onboarding'

test('boots and shows title', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByText('OFFICE 404')).toBeVisible()
  await expect(page.getByText('Loading save')).toBeHidden({ timeout: 10_000 })
  await dismissOnboarding(page)
  await expect(page.getByText('OFFICE 404')).toBeVisible()
})

test('fixture loader hydrates tutorial state', async ({ page }) => {
  await page.goto('/?fixture=fresh-tutorial')
  await expect(page.getByText('Loading save')).toBeHidden({ timeout: 10_000 })
  await dismissOnboarding(page)
  await page.getByRole('button', { name: 'Projects' }).click()
  await dismissOnboarding(page)
  await expect(page.getByRole('heading', { name: 'Friendly Neighbor App' })).toBeVisible({
    timeout: 10_000,
  })
})
