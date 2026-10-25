import { test, expect } from '@playwright/test'
import { RomanEngine } from '../src/engine'
import { passages } from '../src/passages'
import { sentencesByPassage } from '../src/sentences'
test('complete longform, pause, persist, export and clear records', async ({
  page,
}) => {
  await page.goto('/')
  // Long input streams should not compete with CI software WebGL rendering.
  // Background-on input is covered by the stellar scene test.
  await page.getByLabel('3D 背景', { exact: true }).uncheck()
  const area = page.getByRole('region', { name: /タイピング入力/ })
  await expect(page.locator('.current-paragraph')).toHaveText(
    sentencesByPassage[passages[0].id][0].text,
  )
  await expect(page.locator('.upcoming')).toHaveText(
    sentencesByPassage[passages[0].id][1].text,
  )
  await area.focus()
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
  await expect(page.locator('.space-scene')).toHaveAttribute(
    'data-rendering',
    'webgl',
  )
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

test('next reading stays visible with guide off, after resize and restart', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/')
  await page.getByRole('button', { name: '文章ライブラリ' }).click()
  await page.getByRole('button', { name: /星の光が届くまで/ }).click()
  await page.getByLabel('3D 背景', { exact: true }).uncheck()
  await page.getByLabel('入力ガイド', { exact: true }).uncheck()
  await page.getByRole('region').focus()
  const sentences = sentencesByPassage['starlight']
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
      const text = el.querySelector('.remaining-kana')!.firstChild!
      const range = document.createRange()
      range.setStart(text, 0)
      range.setEnd(text, 1)
      const next = range.getBoundingClientRect(),
        viewport = el.getBoundingClientRect()
      return {
        visible:
          next.top >= viewport.top - 1 && next.bottom <= viewport.bottom + 1,
        scrollTop: el.scrollTop,
      }
    })
  await expect.poll(async () => (await visible()).visible).toBe(true)
  expect((await visible()).scrollTop).toBeGreaterThan(0)
  await page.setViewportSize({ width: 1000, height: 900 })
  await expect.poll(async () => (await visible()).visible).toBe(true)
  await page.getByRole('button', { name: 'やり直す', exact: true }).click()
  await expect.poll(async () => (await visible()).scrollTop).toBe(0)
})

test('two tabs keep simultaneous completions, synchronize deletion, and do not restore deleted history', async ({
  context,
  page,
}) => {
  test.setTimeout(90000)
  await page.goto('/')
  await page.getByLabel('3D 背景', { exact: true }).uncheck()
  const other = await context.newPage()
  await other.goto('/')
  const complete = async (tab: typeof page) => {
    await tab.getByRole('region').focus()
    for (const p of passages[0].paragraphs)
      await tab.keyboard.type(new RomanEngine(p.reading).hint)
    await expect(tab.getByText('SESSION COMPLETE')).toBeVisible()
  }
  await Promise.all([complete(page), complete(other)])
  for (const tab of [page, other]) {
    await tab.getByRole('button', { name: '練習の記録' }).click()
    await expect(tab.locator('tbody tr')).toHaveCount(2)
  }
  await page.getByRole('button', { name: '全記録を削除' }).click()
  await page.getByRole('button', { name: '削除する', exact: true }).click()
  await expect(other.getByText('最初の一篇から、はじめよう。')).toBeVisible()
  await other.getByRole('button', { name: 'タイピング', exact: true }).click()
  await other.getByRole('button', { name: 'やり直す', exact: true }).click()
  await complete(other)
  await page.reload()
  await page.getByRole('button', { name: '練習の記録' }).click()
  await expect(page.locator('tbody tr')).toHaveCount(1)
})

test('main cursor, two-sentence window, feedback and reduced motion', async ({
  page,
}) => {
  await page.goto('/')
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
  for (let i = 0; i < sentences.length; i++) {
    await expect(page.locator('.current-paragraph')).toHaveText(
      sentences[i].text,
    )
    if (i + 1 < sentences.length)
      await expect(page.locator('.upcoming')).toHaveText(sentences[i + 1].text)
    else await expect(page.locator('.upcoming')).toHaveCount(0)
    await page.keyboard.type(new RomanEngine(sentences[i].reading).hint)
  }
  await expect(page.getByText('SESSION COMPLETE')).toBeVisible()
  await expect(cursor).toHaveCount(0)
  await expect(page.locator('.keyburst')).toHaveCount(1)
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.getByRole('button', { name: 'やり直す', exact: true }).click()
  await page.getByRole('region').focus()
  await page.keyboard.type('h')
  await expect(page.locator('.keyburst')).toBeHidden()
})
