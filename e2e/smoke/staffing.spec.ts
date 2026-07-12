import { test, expect } from '@playwright/test'

test('tutorial-ready-for-code staffs coder via testid', async ({ page }) => {
  await page.goto('/?fixture=tutorial-ready-for-code&skipOnboarding=1')
  await expect(page.getByText('Loading save')).toBeHidden({ timeout: 10_000 })

  const roster = page.getByTestId('staffing-roster-summary')
  await expect(roster).toContainText('1 idle')

  const addCode = page.getByTestId('staffing-add-code-proj-1')
  await expect(addCode).toBeEnabled()
  await expect(page.getByTestId('staffing-add-refine-proj-1')).toBeEnabled()
  await expect(page.getByTestId('staffing-add-review-proj-1')).toBeEnabled()
  await expect(page.getByTestId('staffing-add-test-proj-1')).toBeEnabled()

  await addCode.click()

  await expect(page.getByLabel(/1 coding agent assigned/)).toBeVisible()
  await expect(page.getByTestId('staffing-add-code-proj-1')).toBeDisabled()
})
