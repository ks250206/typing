import { expect, type Page } from '@playwright/test'

/** Enter the practice session through the same Space/countdown flow as a player. */
export async function startPractice(page: Page, advanceClock = false) {
  const hint = page.locator(
    '.mission-face.is-active .practice-overlay[data-phase=ready]',
  )
  // Some callers focus an already-running or paused session again.
  if (!(await hint.isVisible())) return
  await page.getByRole('region', { name: /タイピング入力領域/ }).focus()
  await page.keyboard.press('Space')
  await expect(page.locator('.practice-countdown')).toBeVisible()
  if (advanceClock) await page.clock.runFor(3000)
  await expect(page.getByText('IN THE FLOW', { exact: true })).toBeVisible({
    timeout: 6000,
  })
}
