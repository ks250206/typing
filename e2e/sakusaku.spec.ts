import { startPractice } from './startPractice'
import { test, expect, type Page } from '@playwright/test'
import { sakusakuEntries, createTrainerOrder } from '../src/sakusaku'

const remaining = async (page: Page) =>
  ((await page.locator('.roman-current').textContent()) ?? '') +
  ((await page.locator('.remaining-roman').textContent()) ?? '')
const history = (page: Page) =>
  page.evaluate(() =>
    JSON.parse(localStorage.getItem('yohaku.history.v1') ?? '[]'),
  )
async function choose(page: Page) {
  await page.goto('/')
  await page.getByLabel('3D 背景', { exact: true }).uncheck()
  await page
    .getByRole('button', {
      name: '打鍵トレーナー · さくさくタイピング',
      exact: true,
    })
    .click()
}
async function enter(page: Page) {
  await page.getByRole('button', { name: '入力へ進む', exact: true }).click()
  await expect(page.locator('[data-face="2"]')).toHaveCSS('transform', 'none')
  await page.clock.pauseAt(
    new Date(await page.evaluate(() => Date.now() + 10_000)),
  )
  await page.getByRole('region', { name: /タイピング入力/ }).focus()
}

test('15 supplied texts, random next sentence, paused clock, partial 60-second result and responsive display', async ({
  page,
}) => {
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(e.message))
  await page.clock.install()
  await choose(page)
  await page.getByRole('button', { name: '全文を読む', exact: true }).click()
  const paragraphs = page.locator('#passage-full-text li p')
  await expect(paragraphs).toHaveCount(15)
  const previewOrder = createTrainerOrder(
    await page.getByLabel('出題シード', { exact: true }).inputValue(),
  )
  for (let i = 0; i < 15; i++)
    expect(
      (await paragraphs.nth(i).locator('.token-text').allTextContents()).join(
        '',
      ),
    ).toBe(sakusakuEntries[previewOrder()][0])
  await enter(page)
  await expect(page.getByLabel('残り時間')).toContainText('60 秒')
  await page.clock.runFor(1500)
  await expect(page.getByLabel('残り時間')).toContainText('60 秒')
  const original = await page
    .locator('.current-paragraph')
    .getAttribute('data-text')
  await startPractice(page, true)
  const first = await remaining(page)
  await page.keyboard.type(first)
  await expect(page.locator('.current-paragraph')).not.toHaveAttribute(
    'data-text',
    original!,
  )
  const partial = (await remaining(page)).slice(0, 2)
  await page.keyboard.type(partial)
  await page.clock.runFor(10_000)
  await page.keyboard.press('Escape')
  const paused = await page.getByLabel('残り時間').textContent()
  await page.clock.runFor(120_000)
  await expect(page.getByLabel('残り時間')).toHaveText(paused!)
  expect(await history(page)).toHaveLength(0)
  await page.getByRole('button', { name: '再開する' }).click()
  await page.getByRole('region', { name: /タイピング入力/ }).focus()
  await startPractice(page, true)
  await page.screenshot({
    path: 'artifacts/sakusaku-desktop.png',
    fullPage: true,
    animations: 'disabled',
  })
  await page.setViewportSize({ width: 390, height: 1000 })
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true)
  await expect(page.locator('.current-paragraph')).toHaveCSS(
    'white-space',
    'nowrap',
  )
  await page.screenshot({
    path: 'artifacts/sakusaku-mobile.png',
    fullPage: true,
    animations: 'disabled',
  })
  await page.clock.runFor(50_050)
  await expect(page.getByText('TIME UP', { exact: true })).toBeVisible()
  await expect(page.getByLabel('残り時間')).toContainText('0 秒')
  await expect.poll(async () => (await history(page)).length).toBe(1)
  const saved = await history(page)
  expect(saved).toHaveLength(1)
  expect(saved[0]).toMatchObject({
    passageId: 'sakusaku-trainer',
    mode: 'trainer',
    elapsed: 60_000,
    keys: first.length + partial.length,
    actualKeys: first.length + partial.length,
    misses: 0,
    accuracy: 100,
  })
  await page.keyboard.type('aaaa')
  await page.clock.runFor(1000)
  expect(await history(page)).toEqual(saved)
  await page.getByRole('button', { name: '練習の記録', exact: true }).click()
  await expect(page.locator('tbody')).toContainText('さくさくタイピング')
  expect(errors).toEqual([])
})

test('mistakes after countdown are counted; a key arriving at the deadline is excluded before the timer tick', async ({
  page,
}) => {
  await page.clock.install()
  await choose(page)
  await enter(page)
  await startPractice(page, true)
  const first = (await remaining(page))[0]
  await page.keyboard.type(first === 'z' ? 'qqq' : 'zzz')
  await expect(page.locator('.miss-stat')).toContainText('ミス3')
  // Move the sampled monotonic clock beyond the deadline without firing intervals.
  await page.evaluate(() => {
    const now = performance.now.bind(performance)
    performance.now = () => now() + 60_000
  })
  await page.keyboard.type(first)
  await expect(page.getByText('TIME UP', { exact: true })).toBeVisible()
  await expect.poll(async () => (await history(page)).length).toBe(1)
  const saved = await history(page)
  expect(saved).toHaveLength(1)
  expect(saved[0]).toMatchObject({
    elapsed: 60_000,
    keys: 0,
    misses: 3,
    rawMisses: 3,
    accuracy: 0,
    point: 0,
    missPenalty: 2.25,
  })
})
