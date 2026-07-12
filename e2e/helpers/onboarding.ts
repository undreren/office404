import type { Page } from '@playwright/test'

/** Dismiss any visible onboarding modal (tab intro or tutorial step). */
export async function dismissOnboarding(page: Page): Promise<void> {
  const gotIt = page.getByRole('button', { name: 'Got it' })
  for (let i = 0; i < 10; i++) {
    if (!(await gotIt.isVisible().catch(() => false))) return
    await gotIt.click()
  }
}
