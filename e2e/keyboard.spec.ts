import { test, expect } from '@playwright/test'
import { passages } from '../src/passages'
import { RomanEngine } from '../src/engine'
import { sentencesByPassage } from '../src/sentences'

test('mission carousel isolates selection, full passage and typing, pausing on return', async ({
  page,
}) => {
  await page.goto('/')
  await page.getByLabel('3D 背景', { exact: true }).uncheck()
  const face = (index: number) => page.locator(`[data-face="${index}"]`)
  await expect(face(0)).toHaveClass(/is-active/)
  await page.screenshot({
    path: 'artifacts/mission-selection.png',
    fullPage: true,
  })
  await expect(face(2)).toHaveAttribute('inert', '')
  await expect(page.getByRole('region')).toHaveCount(0)
  await page.getByRole('button', { name: '全文を読む' }).click()
  await expect(face(1)).toHaveClass(/is-active/)
  await expect(face(0)).toHaveAttribute('inert', '')
  const preview = page.locator('#passage-full-text')
  await expect(preview.locator('li')).toHaveCount(3)
  for (const [index, paragraph] of passages[0].paragraphs.entries()) {
    expect(
      (
        await preview
          .locator('li')
          .nth(index)
          .locator('.token-text')
          .allTextContents()
      ).join(''),
    ).toBe(paragraph.text)
  }
  await expect(face(1)).toHaveCSS('transform', 'none')
  expect(
    await face(0).evaluate((el) => {
      el.querySelector('button')?.focus()
      return el.contains(document.activeElement)
    }),
  ).toBe(false)
  await page.screenshot({
    path: 'artifacts/passage-preview-1440.png',
    fullPage: true,
  })
  await preview.getByRole('button', { name: 'この文章でスタート' }).click()
  const area = page.getByRole('region')
  await expect(area).toBeFocused()
  await expect(face(1)).toHaveAttribute('inert', '')
  await page.keyboard.type('he')
  await expect(page.locator('.typed-roman')).toHaveText('he')
  await page.getByRole('button', { name: '全文確認へ' }).click()
  await expect(face(1)).toHaveClass(/is-active/)
  await expect(face(2)).toHaveAttribute('inert', '')
  await preview.getByRole('button', { name: 'この文章でスタート' }).click()
  await expect(area).toBeFocused()
  await expect(page.getByText('IN THE FLOW', { exact: true })).toBeVisible()
  await page.keyboard.type('i')
  await expect(page.locator('.typed-roman')).toHaveText('hei')
  await page.getByRole('button', { name: '文章選択へ' }).click()
  await page
    .getByRole('button', { name: '星の光が届くまで', exact: true })
    .click()
  await page.getByRole('button', { name: '全文を読む' }).click()
  expect(
    (
      await preview
        .locator('li')
        .first()
        .locator('.token-text')
        .allTextContents()
    ).join(''),
  ).toBe(passages.find((p) => p.id === 'starlight')!.paragraphs[0].text)
})

test('finger keyboard follows next key, word, layout, pause, mistakes, sentence and completion', async ({
  page,
}) => {
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(e.message))
  await page.goto('/')
  await page.getByRole('button', { name: '入力へ進む', exact: true }).click()
  await expect(page.locator('[data-face="2"]')).toHaveCSS('transform', 'none')
  await page.getByLabel('3D 背景', { exact: true }).uncheck()
  const key = (code: string) =>
    page.locator(`.keyboard-key[data-code="${code}"]`)
  const area = page.getByRole('region')
  await expect(key('KeyH')).toHaveAttribute('data-state', 'next')
  await expect(key('KeyE')).toHaveAttribute('data-state', 'idle')
  await expect(page.locator('.keyboard-key[data-state=word]')).toHaveCount(0)
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
  await expect(key('KeyJ').locator('> span')).toHaveText('H')
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
  await page.getByRole('button', { name: '入力へ進む', exact: true }).click()
  await expect(page.locator('[data-face="2"]')).toHaveCSS('transform', 'none')
  await page.getByLabel('3D 背景', { exact: true }).uncheck()
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 1100 })
    for (const layout of ['jis', 'us', 'dvorak', 'kana']) {
      await page.getByLabel('入力方式', { exact: true }).selectOption(layout)
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

test('ruby and optional word colors/consuming flow stay aligned and persist', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1100 })
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(e.message))
  await page.goto('/')
  await page.getByLabel('3D 背景', { exact: true }).uncheck()
  await page.getByRole('button', { name: '入力へ進む', exact: true }).click()
  await expect(page.locator('[data-face="2"]')).toHaveCSS('transform', 'none')
  const area = page.getByRole('region')
  const main = page.locator('.current-paragraph')
  const ruby = main.locator('ruby').first()
  await expect(ruby.locator('.token-text')).toHaveText('閉館')
  await expect(ruby.locator('rt')).toHaveText('へいかん')
  await expect(page.getByLabel('単語の色分け', { exact: true })).toBeChecked()
  await page.getByLabel('単語の色分け', { exact: true }).uncheck()
  const natural = await main
    .locator('.pending-token[data-tone="1"]')
    .first()
    .evaluate((el) => getComputedStyle(el).color)
  await page.getByLabel('単語の色分け', { exact: true }).check()
  const color = await main
    .locator('.pending-token[data-tone="1"]')
    .first()
    .evaluate((el) => getComputedStyle(el).color)
  expect(color).not.toBe(natural)
  expect(
    await main
      .locator('.pending-token[data-tone="1"]')
      .first()
      .evaluate((el) => getComputedStyle(el).color),
  ).toBe(
    await page
      .locator('.remaining-kana > [data-tone="1"]')
      .first()
      .evaluate((el) => getComputedStyle(el).color),
  )
  await page.getByLabel('入力済み単語を消す', { exact: true }).check()
  await area.focus()
  await page.keyboard.type('heika')
  await expect(
    main.locator('.flow-track > span:not([data-consumed]) .token-text').first(),
  ).toHaveText('閉館')
  await page.keyboard.type('n')
  await expect(
    main.locator('.flow-track > span:not([data-consumed]) .token-text').first(),
  ).toHaveText('の')
  await expect(
    page.locator('.typed-kana > span:not([data-consumed])'),
  ).toHaveCount(0)
  await expect(
    page.locator('.typed-roman > span:not([data-consumed])'),
  ).toHaveCount(0)
  await expect(page.locator('.roman-current')).toHaveText('n')
  await page.keyboard.type('z')
  await expect(
    main.locator('.flow-track > span:not([data-consumed]) .token-text').first(),
  ).toHaveText('の')
  await page.keyboard.type('no')
  await expect(
    main.locator('.flow-track > span:not([data-consumed]) .token-text').first(),
  ).toHaveText('放送')
  await expect(page.locator('[aria-current="location"]')).toHaveText('放送')
  await page.getByLabel('入力済み単語を消す', { exact: true }).uncheck()
  await expect(
    main.locator('.flow-track > span:not([data-consumed]) .token-text').first(),
  ).toHaveText('閉館')
  await expect(
    main.locator('.typed-token').first().locator('.token-text'),
  ).toHaveText('閉館')
  await page.getByLabel('入力済み単語を消す', { exact: true }).check()
  await page.getByLabel('単語の色分け', { exact: true }).uncheck()
  await page.getByLabel('単語の色分け', { exact: true }).check()
  await page.screenshot({
    path: 'artifacts/flow-colors-desktop.png',
    fullPage: true,
  })
  await page.reload()
  await expect(page.getByLabel('単語の色分け', { exact: true })).toBeChecked()
  await expect(
    page.getByLabel('入力済み単語を消す', { exact: true }),
  ).toBeChecked()
  await page.getByRole('button', { name: '入力へ進む', exact: true }).click()
  await expect(page.locator('[data-face="2"]')).toHaveCSS('transform', 'none')
  await page.getByLabel('入力方式', { exact: true }).selectOption('kana')
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
  await expect(
    main.locator('.flow-track > span:not([data-consumed]) .token-text').first(),
  ).toHaveText('が')
  await page.keyboard.press('BracketLeft')
  await expect(
    main.locator('.flow-track > span:not([data-consumed]) .token-text').first(),
  ).toHaveText('終')
  await page.setViewportSize({ width: 390, height: 844 })
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await expect(page.locator('.sentence-stream')).toHaveCSS(
    'animation-name',
    'none',
  )
  await expect(page.locator('.mission-face.is-active')).toHaveCSS(
    'transition-duration',
    '0s',
  )
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true)
  await page.screenshot({
    path: 'artifacts/flow-colors-mobile.png',
    fullPage: true,
  })
  expect(errors).toEqual([])
})
