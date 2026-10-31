import { test, expect, type Page } from '@playwright/test'
import { startPractice } from './startPractice'
import { originalLongEntries } from '../src/domain/content/originalLong'
import { RomanEngine } from '../src/domain/typing/engine'

async function selectLong(page: Page, index: number) {
  await page.addInitScript(() =>
    localStorage.setItem(
      'yohaku.settings.v1',
      JSON.stringify({ background: false }),
    ),
  )
  await page.goto('/')
  await page
    .getByRole('button', { name: 'オリジナル長文', exact: true })
    .click()
  await expect(page.locator('.story-card')).toHaveCount(26)
  await page.getByPlaceholder('タイトル・ジャンルで検索').fill('博士課程')
  await expect(page.locator('.story-card')).toHaveCount(3)
  await page.getByPlaceholder('タイトル・ジャンルで検索').fill('')
  await page
    .getByRole('button', { name: new RegExp(originalLongEntries[index].title) })
    .click()
  await expect(page.locator('#passage-full-text li')).toHaveCount(1)
  expect(
    (
      await page.locator('#passage-full-text .token-text').allTextContents()
    ).join(''),
  ).toBe(originalLongEntries[index].text)
  await expect(page.getByLabel('単語の色分け', { exact: true })).toBeChecked()
  await page.getByRole('button', { name: '入力へ進む', exact: true }).click()
  await expect(page.locator('[data-face="2"]')).toHaveCSS('transform', 'none')
  await expect(page.locator('.reading-toolbar')).toContainText('全文1問')
}
async function cursorVisible(page: Page) {
  return page.locator('.current-paragraph').evaluate((el) => {
    const cursor = el
      .querySelector('[aria-current="location"]')!
      .getBoundingClientRect()
    const viewport = el.getBoundingClientRect()
    return (
      cursor.top >= viewport.top &&
      cursor.bottom <= viewport.bottom &&
      cursor.left >= viewport.left &&
      cursor.right <= viewport.right
    )
  })
}

test('a supplied long passage stays intact across punctuation, pause and completion, then replays', async ({
  page,
}) => {
  test.setTimeout(90000)
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  await selectLong(page, 0)
  const entry = originalLongEntries[0]
  const paragraph = page.locator('.current-paragraph')
  await expect(paragraph).toHaveAttribute('data-text', entry.text)
  await expect(paragraph).toHaveAttribute('data-continuous', 'true')
  await expect(page.locator('.upcoming')).toHaveCount(0)
  await startPractice(page)
  const engine = new RomanEngine(entry.reading)
  let firstSentence = ''
  while (engine.position <= entry.reading.indexOf('。')) {
    firstSentence += engine.hint[0]
    engine.feed(engine.hint[0])
  }
  await page.keyboard.type(firstSentence)
  await expect(paragraph).toHaveAttribute('data-text', entry.text)
  await expect(page.getByText('SESSION COMPLETE')).toHaveCount(0)
  await expect.poll(() => cursorVisible(page)).toBe(true)
  await page.keyboard.press('Escape')
  await page.getByRole('button', { name: '再開する', exact: true }).click()
  await page.keyboard.type(engine.hint)
  await expect(page.getByText('SESSION COMPLETE')).toBeVisible()
  await page.getByRole('button', { name: '練習の記録', exact: true }).click()
  await page.getByRole('tab', { name: '全記録', exact: true }).click()
  await expect(page.locator('tbody tr')).toHaveCount(1)
  await page
    .getByRole('button', { name: 'リプレイを見る', exact: true })
    .click()
  const replay = page.getByRole('region', { name: '記録リプレイ' })
  await expect(replay.locator('.current-paragraph')).toHaveAttribute(
    'data-continuous',
    'true',
  )
  await expect(replay.locator('.current-paragraph')).toHaveAttribute(
    'data-text',
    entry.text,
  )
  await replay.getByRole('button', { name: '次の1打鍵', exact: true }).click()
  await expect(replay.locator('.typed-roman')).toHaveText(firstSentence[0])
  expect(errors).toEqual([])
})

test('the longest passage remains one unwrapped line and follows the cursor on mobile, resize and restart', async ({
  page,
}) => {
  test.setTimeout(90000)
  await page.setViewportSize({ width: 390, height: 844 })
  await page.emulateMedia({ reducedMotion: 'reduce', colorScheme: 'light' })
  await selectLong(page, 2)
  await startPractice(page)
  const input = new RomanEngine(originalLongEntries[2].reading).hint
  await page.keyboard.type(input.slice(0, -1))
  await expect.poll(() => cursorVisible(page)).toBe(true)
  await expect(page.locator('.current-paragraph')).toHaveCSS(
    'white-space',
    'nowrap',
  )
  expect(
    await page
      .locator('.sentence-stream')
      .evaluate(
        (el) => new DOMMatrixReadOnly(getComputedStyle(el).transform).m41,
      ),
  ).toBeLessThan(0)
  expect(
    await page.locator('.current-paragraph').evaluate((el) => el.scrollTop),
  ).toBe(0)
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true)
  await page.getByLabel('入力済み単語を消す', { exact: true }).check()
  await expect.poll(() => cursorVisible(page)).toBe(true)
  await expect(page.locator('.prose')).toHaveAttribute('data-flow', 'consume')
  await page.getByLabel('入力済み単語を消す', { exact: true }).uncheck()
  await page.getByRole('region', { name: /タイピング入力領域/ }).focus()
  await page.screenshot({
    path: 'artifacts/original-long-mobile.png',
    fullPage: true,
  })
  await page.setViewportSize({ width: 1440, height: 1100 })
  await page.emulateMedia({ colorScheme: 'dark' })
  await expect.poll(() => cursorVisible(page)).toBe(true)
  await page.screenshot({
    path: 'artifacts/original-long-desktop.png',
    fullPage: true,
  })
  await page.getByRole('button', { name: 'やり直す', exact: true }).click()
  await expect
    .poll(() =>
      page
        .locator('.sentence-stream')
        .evaluate(
          (el) => new DOMMatrixReadOnly(getComputedStyle(el).transform).m41,
        ),
    )
    .toBe(0)
  await expect.poll(() => cursorVisible(page)).toBe(true)
})
