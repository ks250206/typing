import { test, expect } from '@playwright/test'
import { passages } from '../src/passages'
import { RomanEngine } from '../src/engine'
import { sentencesByPassage } from '../src/sentences'

test('full passage opens before practice, collapses on input and follows selection and reset', async ({
  page,
}) => {
  await page.goto('/')
  await page.getByLabel('3D 背景', { exact: true }).uncheck()
  const preview = page.locator('#passage-full-text')
  const toggle = page.getByRole('button', { name: /全文を確認/ })
  await expect(toggle).toHaveAttribute('aria-expanded', 'true')
  await expect(preview.locator('li')).toHaveCount(3)
  for (const [index, paragraph] of passages[0].paragraphs.entries())
    await expect(preview.locator('li').nth(index)).toHaveText(paragraph.text)
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 1100 })
    await page.screenshot({
      path: `artifacts/passage-preview-${width}.png`,
      fullPage: true,
    })
  }
  await expect(page.locator('.primary-stat')).toContainText('0')
  await preview.getByRole('button', { name: /練習へ進む/ }).click()
  await expect(page.getByRole('region')).toBeFocused()
  await expect(preview).toBeHidden()
  await toggle.click()
  await expect(preview).toBeVisible()
  await page.getByRole('region').focus()
  await page.keyboard.type('he')
  await expect(preview).toBeHidden()
  await toggle.click()
  await expect(page.getByText('PAUSED', { exact: true })).toBeVisible()
  await preview.getByRole('button', { name: /練習へ進む/ }).click()
  await expect(page.getByText('IN THE FLOW', { exact: true })).toBeVisible()
  await expect(page.getByRole('region')).toBeFocused()
  await page.getByRole('button', { name: 'やり直す', exact: true }).click()
  await expect(preview).toBeVisible()
  await page
    .getByRole('button', { name: '文章ライブラリ', exact: true })
    .click()
  await page.getByRole('button', { name: /星の光が届くまで/ }).click()
  await expect(preview).toBeVisible()
  await expect(preview.locator('li').first()).toHaveText(
    passages.find((p) => p.id === 'starlight')!.paragraphs[0].text,
  )
})

test('finger keyboard follows next key, word, layout, pause, mistakes, sentence and completion', async ({
  page,
}) => {
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(e.message))
  await page.goto('/')
  await page.getByLabel('3D 背景', { exact: true }).uncheck()
  const key = (code: string) =>
    page.locator(`.keyboard-key[data-code="${code}"]`)
  const area = page.getByRole('region')
  await expect(key('KeyH')).toHaveAttribute('data-state', 'next')
  await expect(key('KeyE')).toHaveAttribute('data-state', 'word')
  await expect(key('KeyF')).toHaveAttribute('data-finger', 'left-index')
  await expect(key('KeyJ')).toHaveAttribute('data-finger', 'right-index')
  await area.focus()
  await page.keyboard.type('z')
  await expect(key('KeyH')).toHaveAttribute('data-state', 'next')
  await page.keyboard.type('h')
  await expect(key('KeyE')).toHaveAttribute('data-state', 'next')
  await page.keyboard.press('Escape')
  await expect(page.locator('.keyboard-key[data-state="next"]')).toHaveCount(0)
  await page.getByRole('button', { name: '再開する' }).click()
  await expect(area).toBeFocused()
  await expect(key('KeyE')).toHaveAttribute('data-state', 'next')
  const model = new RomanEngine(sentencesByPassage['night-library'][0].reading)
  model.feed('h')
  await page.keyboard.type(model.hint)
  await expect(key('KeyM')).toHaveAttribute('data-state', 'next')
  await page.getByRole('button', { name: 'やり直す', exact: true }).click()
  await page.getByLabel('入力方式', { exact: true }).selectOption('dvorak')
  await expect(key('KeyJ')).toHaveAttribute('data-state', 'next')
  await expect(key('KeyJ').locator('> span')).toHaveText('h')
  await page.getByLabel('入力方式', { exact: true }).selectOption('us')
  await expect(key('KeyH')).toHaveAttribute('data-state', 'next')
  await expect(key('IntlYen')).toHaveCount(0)
  await page.getByLabel('入力方式', { exact: true }).selectOption('kana')
  await expect(key('Equal')).toHaveAttribute('data-state', 'next')
  await area.focus()
  for (const code of [
    'Equal',
    'KeyE',
    'KeyT',
    'KeyY',
    'KeyK',
    'Minus',
    'Digit4',
    'KeyC',
    'Digit4',
    'KeyT',
  ])
    await page.keyboard.press(code)
  await expect(key('BracketLeft')).toHaveAttribute('data-state', 'next')
  await page.keyboard.press('BracketLeft')
  await expect(key('Digit6')).toHaveAttribute('data-state', 'next')
  for (const code of ['Digit6', 'Digit0', 'Period', 'KeyS'])
    await page.keyboard.press(code)
  await expect(key('ShiftLeft')).toHaveAttribute('data-state', 'next')
  await expect(key('Comma')).toHaveAttribute('data-state', 'next')
  await page.keyboard.press('Shift+Comma')
  await expect(key('KeyS')).toHaveAttribute('data-state', 'next')
  await page.getByRole('button', { name: 'やり直す', exact: true }).click()
  await page.getByLabel('入力方式', { exact: true }).selectOption('jis')
  await area.focus()
  for (const sentence of sentencesByPassage['night-library'])
    await page.keyboard.type(new RomanEngine(sentence.reading).hint)
  await expect(page.getByText('SESSION COMPLETE')).toBeVisible()
  await expect(
    page.locator(
      '.keyboard-key[data-state="next"], .keyboard-key[data-state="word"]',
    ),
  ).toHaveCount(0)
  expect(errors).toEqual([])
})

test('keyboard stays within desktop and mobile viewport and respects reduced motion', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/')
  await page.getByLabel('3D 背景', { exact: true }).uncheck()
  await page
    .locator('#passage-full-text')
    .getByRole('button', { name: /練習へ進む/ })
    .click()
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 1100 })
    for (const layout of ['jis', 'us', 'dvorak', 'kana']) {
      await page.getByLabel('入力方式', { exact: true }).selectOption(layout)
      const toggle = page.getByRole('button', { name: /全文を確認/ })
      if ((await toggle.getAttribute('aria-expanded')) === 'true')
        await toggle.click()
      await expect(page.locator('.keyboard-guide')).toBeVisible()
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true)
      expect(
        await page.locator('.keyboard-guide').evaluate((el) => {
          const r = el.getBoundingClientRect()
          return r.left >= 0 && r.right <= innerWidth
        }),
      ).toBe(true)
      await page.screenshot({
        path: `artifacts/keyboard-${layout}-${width}.png`,
        fullPage: true,
      })
    }
  }
})
