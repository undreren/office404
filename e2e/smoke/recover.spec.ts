import { test, expect } from '@playwright/test'

test('recover page exports save without loading the game', async ({ page }) => {
  await page.goto('/recover.html')

  await expect(page.getByRole('heading', { name: /Save recovery/i })).toBeVisible()
  await expect(page.getByRole('button', { name: /Export save from this device/i })).toBeVisible()

  await page.evaluate(() => {
    localStorage.setItem(
      'office404-save-v8',
      JSON.stringify({
        version: 15,
        meta: { retirementCount: 0, singularityCount: 0, hallucinationLevels: {} },
        state: { cash: 1234, phase: 'playing' },
      }),
    )
  })

  await page.reload()
  await page.getByRole('button', { name: /Export save from this device/i }).click()

  const code = page.locator('#export-code')
  await expect(code).not.toHaveValue('')
  await expect(code).toHaveValue(/^o404:v15:/)
})
