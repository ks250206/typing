import { test, expect } from '@playwright/test'
import { RomanEngine } from '../src/engine'
import { passages } from '../src/passages'
test('complete longform, pause, persist, export and clear records', async ({
  page,
}) => {
  await page.goto('/')
  const area = page.getByRole('region', { name: /タイピング入力/ })
  await expect(page.getByText(passages[0].paragraphs[2].text)).toBeVisible()
  await area.focus()
  await page.keyboard.type('x')
  await expect(page.locator('.miss-stat')).toContainText('1')
  await page.keyboard.press('Escape')
  await expect(page.getByRole('button', { name: '再開する' })).toBeVisible()
  await page.getByRole('button', { name: '再開する' }).click()
  await page.keyboard.press('Escape')
  await page.getByRole('button', { name: '再開する' }).click()
  for (const p of passages[0].paragraphs) {
    const engine = new RomanEngine(p.reading)
    let input = ''
    while (!engine.done) {
      const k = engine.hint[0]
      input += k
      engine.feed(k)
    }
    await page.keyboard.type(input)
  }
  await expect(page.getByText('SESSION COMPLETE')).toBeVisible()
  await expect(page.locator('.practice-footer')).toContainText('100%')
  await page.getByRole('button', { name: '練習の記録' }).click()
  await expect(page.locator('tbody tr')).toHaveCount(1)
  await expect(page.locator('tbody')).toContainText('夜更けの図書室')
  await page.reload()
  await page.getByRole('button', { name: '練習の記録' }).click()
  await expect(page.locator('tbody tr')).toHaveCount(1)
  const download = page.waitForEvent('download')
  await page.getByRole('button', { name: 'JSON 書出し' }).click()
  expect((await download).suggestedFilename()).toBe('yohaku-records.json')
  await page.getByRole('button', { name: '全記録を削除' }).click()
  await page.getByRole('button', { name: '削除する', exact: true }).click()
  await expect(page.getByText('最初の一篇から、はじめよう。')).toBeVisible()
})
test('library, settings persistence, screenshots and responsive layout', async ({
  page,
}) => {
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(e.message))
  await page.setViewportSize({ width: 1440, height: 1100 })
  await page.goto('/')
  await page.screenshot({ path: 'artifacts/desktop.png', fullPage: true })
  await page.getByRole('button', { name: '文章ライブラリ' }).click()
  await page.getByRole('button', { name: '科学', exact: true }).click()
  await page.getByRole('button', { name: /星の光が届くまで/ }).click()
  await expect(page.locator('.passage-header')).toContainText(
    '星の光が届くまで',
  )
  await page.getByLabel('入力方式', { exact: true }).selectOption('dvorak')
  await page.getByLabel('3D 背景', { exact: true }).uncheck()
  await page.reload()
  await expect(page.getByLabel('入力方式', { exact: true })).toHaveValue(
    'dvorak',
  )
  await expect(page.getByLabel('3D 背景', { exact: true })).not.toBeChecked()
  await page.setViewportSize({ width: 390, height: 844 })
  await page.screenshot({ path: 'artifacts/mobile.png', fullPage: true })
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true)
  expect(errors).toEqual([])
})
test('JIS kana physical keys accept voiced syllables and pause on blur', async ({
  page,
}) => {
  await page.goto('/')
  await page.getByLabel('入力方式', { exact: true }).selectOption('kana')
  await page.getByRole('region').focus()
  // へいかん: Equal, E, T, Y
  for (const key of ['Equal', 'KeyE', 'KeyT', 'KeyY'])
    await page.keyboard.press(key)
  await expect(page.locator('.miss-stat')).toContainText('4')
  await expect(page.locator('.typed-kana')).toHaveText('へいかん')
  await page.getByRole('button', { name: '環境設定' }).click()
  await page.getByRole('button', { name: '設定を閉じる' }).click()
  await expect(page.getByRole('button', { name: '再開する' })).toBeVisible()
})
