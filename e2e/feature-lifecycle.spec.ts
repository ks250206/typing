import { test, expect } from '@playwright/test'

test('dialogs preserve practice progress and focus; leaving the page cancels the game', async ({
  page,
}) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  await page.clock.install()
  await page.addInitScript(() =>
    localStorage.setItem(
      'yohaku.settings.v1',
      JSON.stringify({ background: false, navigationMotion: 'off' }),
    ),
  )
  await page.goto('/')
  await page.clock.pauseAt(
    new Date(await page.evaluate(() => Date.now() + 10000)),
  )
  await page.getByRole('button', { name: '入力へ進む', exact: true }).click()
  const input = page.getByRole('region', { name: /タイピング入力領域/ })
  await input.focus()
  await page.keyboard.press('Space')
  await page.clock.runFor(3000)
  for (let index = 0; index < 2; index++) {
    await page.keyboard.type(
      (await page.locator('.roman-current').textContent())!,
    )
  }
  await page.clock.runFor(1500)
  const progress = await page.locator('.typed-roman').textContent()
  const keys = page.locator('.miss-stat strong').nth(1)
  await expect(keys).toHaveText('2')
  const settings = page.getByRole('button', { name: '環境設定', exact: true })
  await settings.click()
  await page.clock.runFor(120000)
  const dialog = page.getByRole('dialog')
  const first = dialog.getByRole('button', { name: '閉じる', exact: true })
  const last = dialog.getByRole('button', { name: '設定を閉じる', exact: true })
  await expect(first).toBeFocused()
  await page.keyboard.press('Shift+Tab')
  await expect(last).toBeFocused()
  await page.keyboard.press('Tab')
  await expect(first).toBeFocused()
  await page.keyboard.press('Escape')
  await expect(dialog).toHaveCount(0)
  await expect(settings).toBeFocused()
  await expect(
    page.locator('.practice-overlay[data-phase=paused]'),
  ).toBeVisible()
  await expect(keys).toHaveText('2')
  await expect(page.locator('.typed-roman')).toHaveText(progress!)
  await expect(
    page
      .locator('.stat-grid > div')
      .filter({ hasText: '経過時間' })
      .locator('strong'),
  ).toHaveText('00:01')
  await page.getByRole('button', { name: '再開する', exact: true }).click()
  await page.clock.runFor(1000)
  await expect(
    page
      .locator('.stat-grid > div')
      .filter({ hasText: '経過時間' })
      .locator('strong'),
  ).toHaveText('00:02')
  await page.getByRole('button', { name: '練習の記録', exact: true }).click()
  const clear = page.getByRole('button', { name: '全記録を削除' })
  await clear.click()
  const confirm = page.getByRole('alertdialog')
  await expect(
    confirm.getByRole('button', { name: 'キャンセル' }),
  ).toBeFocused()
  await page.keyboard.press('Shift+Tab')
  await expect(
    confirm.getByRole('button', { name: '削除する', exact: true }),
  ).toBeFocused()
  await page.keyboard.press('Escape')
  await expect(confirm).toHaveCount(0)
  await expect(clear).toBeFocused()
  await page.getByRole('button', { name: 'タイピング', exact: true }).click()
  await expect(page.locator('.mission-carousel')).toHaveAttribute(
    'data-stage',
    '0',
  )
  await page.getByRole('button', { name: '入力へ進む', exact: true }).click()
  await page.clock.runFor(120000)
  await expect(
    page.locator('.practice-overlay[data-phase=ready]'),
  ).toBeVisible()
  await expect(keys).toHaveText('0')
  expect(
    await page.evaluate(() =>
      JSON.parse(localStorage.getItem('yohaku.history.v1') ?? '[]'),
    ),
  ).toEqual([])
  expect(errors).toEqual([])
})
