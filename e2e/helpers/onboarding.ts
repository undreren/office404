import type { Page } from '@playwright/test'

/** Dismiss any visible onboarding modal (story intro, tab intro, or tutorial step). */
export async function dismissOnboarding(page: Page): Promise<void> {
  const gotIt = page.getByTestId('onboarding-dismiss')
  for (let i = 0; i < 10; i++) {
    if (!(await gotIt.isVisible().catch(() => false))) return
    await gotIt.click()
  }
}
