import { startPractice } from './startPractice'
import { choose as pick } from './select'
import { test, expect } from '@playwright/test'
import { RomanEngine } from '../src/domain/typing/engine'
import { passages } from '../src/domain/content/passages'
import { sentencesByPassage } from '../src/domain/content/sentences'
test('complete longform, pause, persist, export and clear records', async ({
  page,
}) => {
  await page.goto('/')
  await page.getByRole('button', { name: '入力へ進む', exact: true }).click()
  await expect(page.locator('[data-face="2"]')).toHaveCSS('transform', 'none')
  // Long input streams should not compete with CI software WebGL rendering.
  // Background-on input is covered by the stellar scene test.
  await page.getByLabel('3D 背景', { exact: true }).uncheck()
  const area = page.getByRole('region', { name: /タイピング入力/ })
  await expect(page.locator('.current-paragraph')).toHaveAttribute(
    'data-text',
    sentencesByPassage[passages[0].id][0].text,
  )
  await expect(page.locator('.upcoming')).toHaveAttribute(
    'data-text',
    sentencesByPassage[passages[0].id][1].text,
  )
  await area.focus()
  await startPractice(page)
  await page.keyboard.type('x')
  await expect(page.locator('.miss-stat')).toContainText('1')
  await page.keyboard.press('Escape')
  await expect(page.getByRole('button', { name: '再開する' })).toBeVisible()
  await page.getByRole('button', { name: '再開する' }).click()
  await expect(area).toBeFocused()
  await page.keyboard.press('Escape')
  await page.getByRole('button', { name: '再開する' }).click()
  await expect(area).toBeFocused()
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
  await page.getByRole('tab', { name: '全記録', exact: true }).click()
  await expect(page.locator('tbody tr')).toHaveCount(1)
  await expect(page.locator('tbody')).toContainText('夜更けの図書室')
  await page.reload()
  await page.getByRole('button', { name: '練習の記録' }).click()
  await page.getByRole('tab', { name: '全記録', exact: true }).click()
  await expect(page.locator('tbody tr')).toHaveCount(1)
  const download = page.waitForEvent('download')
  await page.getByRole('button', { name: 'JSON 書出し' }).click()
  expect((await download).suggestedFilename()).toBe('galactype-records.json')
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
  await page.getByRole('button', { name: '入力へ進む', exact: true }).click()
  await expect(page.locator('[data-face="2"]')).toHaveCSS('transform', 'none')
  await expect(page.locator('.space-scene')).toHaveAttribute(
    'data-rendering',
    'webgl',
  )
  await page.screenshot({ path: 'artifacts/desktop.png', fullPage: true })
  await page.getByRole('button', { name: '文章選択へ', exact: true }).click()
  await page.getByRole('button', { name: 'オリジナル', exact: true }).click()
  await page
    .getByRole('button', { name: '星の光が届くまで', exact: true })
    .click()
  await expect(page.locator('.passage-header')).toContainText(
    '星の光が届くまで',
  )
  await pick(page.getByLabel('入力方式', { exact: true }), 'dvorak')
  await page.getByLabel('3D 背景', { exact: true }).uncheck()
  await page.reload()
  await expect(page.getByLabel('入力方式', { exact: true })).toHaveAttribute(
    'data-value',
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
  await page.getByRole('button', { name: '入力へ進む', exact: true }).click()
  await expect(page.locator('[data-face="2"]')).toHaveCSS('transform', 'none')
  await pick(page.getByLabel('入力方式', { exact: true }), 'kana')
  await page.getByRole('region').focus()
  await startPractice(page)
  // へいかん: Equal, E, T, Y
  for (const key of ['Equal', 'KeyE', 'KeyT', 'KeyY'])
    await page.keyboard.press(key)
  await expect(page.locator('.miss-stat')).toContainText('4')
  await expect(page.locator('.typed-kana')).toHaveText('へいかん')
  const cursor = page.locator('[aria-current="location"]')
  await expect(cursor).toHaveText('の')
  for (const key of ['KeyK', 'Minus', 'Digit4', 'KeyC', 'Digit4', 'KeyT'])
    await page.keyboard.press(key)
  await expect(cursor).toHaveText('が')
  await page.keyboard.press('BracketLeft')
  await expect(cursor).toHaveText('終')

  await page.getByRole('button', { name: '環境設定' }).click()
  await page.getByRole('button', { name: '設定を閉じる' }).click()
  await expect(page.getByRole('button', { name: '再開する' })).toBeVisible()
})

test('guides stay visible with a legacy opt-out, after resize and restart', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.addInitScript(() =>
    localStorage.setItem(
      'yohaku.settings.v1',
      JSON.stringify({ guide: false }),
    ),
  )
  await page.goto('/')
  await page.getByRole('button', { name: '入力へ進む', exact: true }).click()
  await expect(page.locator('[data-face="2"]')).toHaveCSS('transform', 'none')
  await page.getByRole('button', { name: '文章選択へ', exact: true }).click()
  await page
    .getByRole('button', { name: '星の光が届くまで', exact: true })
    .click()
  await page.getByLabel('3D 背景', { exact: true }).uncheck()
  await expect(page.getByLabel('入力ガイド', { exact: true })).toHaveCount(0)
  await page.getByRole('button', { name: '入力へ進む', exact: true }).click()
  await expect(page.locator('[data-face="2"]')).toHaveCSS('transform', 'none')
  await page.getByRole('region').focus()
  await startPractice(page)
  const sentences = sentencesByPassage['starlight']
  await expect(page.locator('.roman-line')).toBeVisible()
  const longest = sentences.reduce(
    (best, s, i) =>
      s.reading.length > sentences[best].reading.length ? i : best,
    0,
  )
  for (let i = 0; i < longest; i++)
    await page.keyboard.type(new RomanEngine(sentences[i].reading).hint)
  await page.keyboard.type(
    new RomanEngine(sentences[longest].reading).hint.slice(0, -1),
  )
  const visible = () =>
    page.locator('.kana-line').evaluate((el) => {
      const cursor = el
        .querySelector('[data-guide-cursor]')!
        .getBoundingClientRect()
      const viewport = el.getBoundingClientRect()
      const transform = getComputedStyle(
        el.querySelector('.flow-track')!,
      ).transform
      return {
        visible:
          cursor.left >= viewport.left - 1 &&
          cursor.right <= viewport.right + 1,
        shift: new DOMMatrixReadOnly(transform).m41,
      }
    })
  await expect.poll(async () => (await visible()).visible).toBe(true)
  expect((await visible()).shift).toBeLessThan(0)
  await page.setViewportSize({ width: 1000, height: 900 })
  await expect.poll(async () => (await visible()).visible).toBe(true)
  await page.getByRole('button', { name: 'やり直す', exact: true }).click()
  await expect.poll(async () => (await visible()).shift).toBe(0)
})

test('two tabs keep simultaneous completions, synchronize deletion, and do not restore deleted history', async ({
  context,
  page,
}) => {
  test.setTimeout(90000)
  await page.goto('/')
  await page.getByRole('button', { name: '入力へ進む', exact: true }).click()
  await expect(page.locator('[data-face="2"]')).toHaveCSS('transform', 'none')
  await page.getByLabel('3D 背景', { exact: true }).uncheck()
  const other = await context.newPage()
  await other.goto('/')
  const complete = async (tab: typeof page) => {
    await tab.getByRole('button', { name: '入力へ進む', exact: true }).click()
    await expect(tab.locator('[data-face="2"]')).toHaveCSS('transform', 'none')
    await tab.getByRole('region').focus()
    await startPractice(tab)
    for (const p of passages[0].paragraphs)
      await tab.keyboard.type(new RomanEngine(p.reading).hint)
    await expect(tab.getByText('SESSION COMPLETE')).toBeVisible()
  }
  await Promise.all([complete(page), complete(other)])
  for (const tab of [page, other]) {
    await tab.getByRole('button', { name: '練習の記録' }).click()
    await tab.getByRole('tab', { name: '全記録', exact: true }).click()
    await expect(tab.locator('tbody tr')).toHaveCount(2)
  }
  await page.getByRole('button', { name: '全記録を削除' }).click()
  await page.getByRole('button', { name: '削除する', exact: true }).click()
  await expect(other.getByText('最初の一篇から、はじめよう。')).toBeVisible()
  await other.getByRole('button', { name: 'タイピング', exact: true }).click()
  await expect(other.locator('.mission-carousel')).toHaveAttribute(
    'data-stage',
    '0',
  )
  await complete(other)
  await page.reload()
  await page.getByRole('button', { name: '練習の記録' }).click()
  await page.getByRole('tab', { name: '全記録', exact: true }).click()
  await expect(page.locator('tbody tr')).toHaveCount(1)
})

test('main cursor, two-sentence window, feedback and reduced motion', async ({
  page,
}) => {
  await page.goto('/')
  await page.getByRole('button', { name: '入力へ進む', exact: true }).click()
  await expect(page.locator('[data-face="2"]')).toHaveCSS('transform', 'none')
  // Long input streams should not compete with CI software WebGL rendering.
  // Background-on input is covered by the stellar scene test.
  await page.getByLabel('3D 背景', { exact: true }).uncheck()
  const sentences = sentencesByPassage[passages[0].id]
  const cursor = page.locator('[aria-current="location"]')
  await expect(cursor).toHaveText('閉館')
  await expect(page.locator('.prose p')).toHaveCount(2)
  await expect(page.getByText(sentences[2].text, { exact: true })).toHaveCount(
    0,
  )
  const sizes = await page
    .locator('.prose')
    .evaluate((el) => [
      parseFloat(
        getComputedStyle(el.querySelector('.current-paragraph')!).fontSize,
      ),
      parseFloat(getComputedStyle(el.querySelector('.upcoming')!).fontSize),
    ])
  expect(sizes[1]).toBeLessThan(sizes[0])
  await page.getByRole('region').focus()
  await startPractice(page)
  await page.keyboard.type('z')
  await expect(cursor).toHaveText('閉館')
  await expect(page.locator('.keyburst')).toHaveCount(0)
  await page.keyboard.type('hei')
  await expect(cursor).toHaveText('閉館')
  await expect(page.locator('.keyburst')).toHaveCount(1)
  await page.keyboard.type('kanno')
  await expect(cursor).toHaveText('放送')
  await page.keyboard.press('Escape')
  await expect(page.locator('.keyburst')).toHaveCount(0)
  await page.getByRole('button', { name: 'やり直す', exact: true }).click()
  await expect(cursor).toHaveText('閉館')
  await page.getByRole('region').focus()
  await startPractice(page)
  const keyboardOffset = () =>
    page
      .locator('.typing-area')
      .evaluate(
        (el) =>
          el.querySelector('.keyboard-guide')!.getBoundingClientRect().top -
          el.getBoundingClientRect().top,
      )
  let previousKeyboard = 0
  for (let i = 0; i < sentences.length; i++) {
    if (i === sentences.length - 2) previousKeyboard = await keyboardOffset()
    await expect(page.locator('.current-paragraph')).toHaveAttribute(
      'data-text',
      sentences[i].text,
    )
    if (i + 1 < sentences.length)
      await expect(page.locator('.upcoming')).toHaveAttribute(
        'data-text',
        sentences[i + 1].text,
      )
    else {
      await expect(page.locator('.upcoming')).toBeHidden()
      await expect(page.locator('.next-sentence')).toHaveAttribute(
        'data-empty',
        'true',
      )
      expect(await keyboardOffset()).toBeCloseTo(previousKeyboard, 1)
    }
    await page.keyboard.type(new RomanEngine(sentences[i].reading).hint)
  }
  await expect(page.getByText('SESSION COMPLETE')).toBeVisible()
  await expect(cursor).toHaveCount(0)
  await expect(page.locator('.keyburst')).toHaveCount(1)
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.getByRole('button', { name: 'もう一度', exact: true }).click()
  await page.getByRole('region').focus()
  await startPractice(page)
  await page.keyboard.type('h')
  await expect(page.locator('.keyburst')).toBeHidden()
})
