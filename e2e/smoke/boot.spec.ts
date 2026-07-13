import { test, expect } from '@playwright/test'
import { dismissOnboarding } from '../helpers/onboarding'

const UNCLE = "Your Uncle's Totally Legal Web Shop"

test('boots and shows title', async ({ page }) => {
  await page.goto('/')
  await expect(page.locator('.glitch')).toHaveText('OFFICE 404')
  await expect(page.getByText('Loading save')).toBeHidden({ timeout: 10_000 })
  await dismissOnboarding(page)
  await expect(page.locator('.glitch')).toHaveText('OFFICE 404')
})

test('fixture loader hydrates tutorial state', async ({ page }) => {
  await page.goto('/?fixture=fresh-tutorial')
  await expect(page.getByText('Loading save')).toBeHidden({ timeout: 10_000 })
  await dismissOnboarding(page)
  await expect(page.getByRole('heading', { name: UNCLE })).toBeVisible({
    timeout: 10_000,
  })
})

test('skipOnboarding hides story and tab intro modals', async ({ page }) => {
  await page.goto('/?fixture=fresh-tutorial&skipOnboarding=1')
  await expect(page.getByText('Loading save')).toBeHidden({ timeout: 10_000 })
  await expect(page.getByTestId('onboarding-dialog')).toBeHidden()
  await expect(page.getByRole('heading', { name: UNCLE })).toBeVisible({
    timeout: 10_000,
  })
})

test('hallucinations tab shows prestige shop', async ({ page }) => {
  await page.goto('/?fixture=post-tutorial&skipOnboarding=1')
  await expect(page.getByText('Loading save')).toBeHidden({ timeout: 10_000 })
  await page.getByRole('button', { name: 'Hallucinations' }).click()
  await expect(page.getByRole('heading', { name: 'Hallucinations' })).toBeVisible()
  await expect(page.getByText('2 unspent points')).toBeVisible()
})
