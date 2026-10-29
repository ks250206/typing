import { test, expect, type Page } from '@playwright/test'
import type { SessionTrace } from '../src/domain/records/telemetry'

async function setup(page: Page) {
  await page.clock.install()
  await page.addInitScript(() =>
    localStorage.setItem(
      'yohaku.settings.v1',
      JSON.stringify({ background: false, navigationMotion: 'off' }),
    ),
  )
  await page.goto('/')
  await page.clock.pauseAt(
    new Date(await page.evaluate(() => Date.now() + 10_000)),
  )
}
async function enter(page: Page) {
  await page.getByRole('button', { name: '入力へ進む', exact: true }).click()
  await page.getByRole('region', { name: /タイピング入力領域/ }).focus()
}
const phase = (page: Page, value: string) =>
  page.locator(`.practice-overlay[data-phase=${value}]`)
const elapsed = (page: Page) =>
  page
    .locator('.stat-grid > div')
    .filter({ hasText: '経過時間' })
    .locator('strong')

for (const title of [
  '夜更けの図書室',
  'タイプウェル · 基本常用語',
  '打鍵トレーナー · さくさくタイピング',
]) {
  test(`${title}: Space starts exactly after 3 seconds; ready/countdown keys never reach input or records`, async ({
    page,
  }) => {
    await setup(page)
    if (title !== '夜更けの図書室')
      await page.getByRole('button', { name: title, exact: true }).click()
    await enter(page)
    await expect(phase(page, 'ready')).toBeVisible()
    const text = await page
      .locator('.current-paragraph')
      .getAttribute('data-text')
    await page.keyboard.type('zzz')
    await page.clock.runFor(5000)
    await expect(phase(page, 'ready')).toBeVisible()
    await expect(elapsed(page)).toHaveText('00:00')
    await page.keyboard.down('Space')
    await expect(page.locator('.practice-countdown strong')).toHaveText('3')
    await page.clock.runFor(1000)
    await page.keyboard.down('Space') // repeat must not restart the deadline or scroll
    await page.keyboard.type('zzz')
    await expect(page.locator('.practice-countdown strong')).toHaveText('2')
    await page.clock.runFor(1000)
    await expect(page.locator('.practice-countdown strong')).toHaveText('1')
    await page.clock.runFor(999)
    await expect(page.locator('.practice-countdown')).toBeVisible()
    await expect(elapsed(page)).toHaveText('00:00')
    await expect(page.locator('.miss-stat strong').nth(0)).toHaveText('0')
    await expect(page.locator('.miss-stat strong').nth(1)).toHaveText('0')
    await page.clock.runFor(1)
    await page.keyboard.up('Space')
    const sessionStart = await page.evaluate(() => performance.now())
    await expect(page.locator('.practice-overlay')).toHaveCount(0)
    await expect(page.getByText('IN THE FLOW', { exact: true })).toBeVisible()
    await expect(page.locator('.current-paragraph')).toHaveAttribute(
      'data-text',
      text!,
    )
    await page.clock.runFor(1200)
    await expect
      .poll(async () => {
        await page.clock.runFor(50)
        return elapsed(page).textContent()
      })
      .toBe('00:01')
    const keyTime =
      (await page.evaluate(() => performance.now())) - sessionStart
    const key = (await page.locator('.roman-current').textContent())!
    await page.keyboard.type(key)
    await expect(page.locator('.miss-stat strong').nth(1)).toHaveText('1')
    await page.keyboard.press('Escape')
    await expect(phase(page, 'paused')).toBeVisible()
    await page.clock.runFor(10000)
    await expect(elapsed(page)).toHaveText('00:01')
    await page.getByRole('button', { name: '再開する', exact: true }).click()
    await expect(
      page.getByRole('region', { name: /タイピング入力領域/ }),
    ).toBeFocused()
    await expect(page.locator('.practice-countdown')).toHaveCount(0)
    await page.clock.runFor(1000)
    await expect(elapsed(page)).toHaveText('00:02')
    if (title.startsWith('打鍵トレーナー')) {
      await page.clock.runFor(58000)
      await expect(page.getByText('TIME UP', { exact: true })).toBeVisible()
      await expect
        .poll(() =>
          page.evaluate(
            () =>
              JSON.parse(localStorage.getItem('yohaku.history.v1') ?? '[]')
                .length,
          ),
        )
        .toBe(1)
      const record = await page.evaluate(
        () => JSON.parse(localStorage.getItem('yohaku.history.v1')!)[0],
      )
      expect(record).toMatchObject({
        elapsed: 60000,
        keys: 1,
        actualKeys: 1,
        misses: 0,
      })
      const trace = await page.evaluate(
        (id: string) =>
          new Promise<SessionTrace>((resolve, reject) => {
            const open = indexedDB.open('galactype.telemetry.v1')
            open.onsuccess = () => {
              const db = open.result
              const request = db
                .transaction('traces')
                .objectStore('traces')
                .get(id)
              request.onsuccess = () => {
                db.close()
                resolve(request.result)
              }
              request.onerror = () => reject(request.error)
            }
            open.onerror = () => reject(open.error)
          }),
        record.id,
      )
      expect(trace.strokes).toHaveLength(1)
      expect(trace.strokes[0].t).toBe(keyTime)
    }
  })
}

test('countdown is cancelled by Escape, focus loss, face/page changes, reset and visibility loss', async ({
  page,
}) => {
  await setup(page)
  await enter(page)
  const start = async () => {
    await page.getByRole('region', { name: /タイピング入力領域/ }).focus()
    await page.keyboard.press('Space')
    await page.clock.runFor(1000)
    await expect(page.locator('.practice-countdown strong')).toHaveText('2')
  }
  const cancelled = async () => {
    await page.clock.runFor(5000)
    await expect(phase(page, 'ready')).toBeVisible()
    await expect(elapsed(page)).toHaveText('00:00')
    await expect(page.locator('.miss-stat strong').nth(1)).toHaveText('0')
  }
  await start()
  await page.keyboard.press('Escape')
  await cancelled()
  await start()
  await page.getByRole('button', { name: '環境設定', exact: true }).click()
  await page.getByRole('button', { name: '設定を閉じる', exact: true }).click()
  await cancelled()
  await start()
  await page.getByRole('button', { name: '全文確認へ', exact: true }).click()
  await page.clock.runFor(5000)
  await enter(page)
  await cancelled()
  await start()
  await page.getByRole('button', { name: '練習の記録', exact: true }).click()
  await page.clock.runFor(5000)
  await page.getByRole('button', { name: 'タイピング', exact: true }).click()
  await cancelled()
  await start()
  await page.getByRole('button', { name: 'やり直す', exact: true }).click()
  await cancelled()
  await start()
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', {
      value: true,
      configurable: true,
    })
    document.dispatchEvent(new Event('visibilitychange'))
    delete (document as unknown as { hidden?: boolean }).hidden
  })
  await cancelled()
  await page
    .getByRole('group', { name: '練習の開始', exact: true })
    .getByRole('button')
    .click()
  await page.clock.runFor(3000)
  await expect(page.getByText('IN THE FLOW', { exact: true })).toBeVisible()
  expect(
    await page.evaluate(() =>
      JSON.parse(localStorage.getItem('yohaku.history.v1') ?? '[]'),
    ),
  ).toEqual([])
})

test('start and pause overlays keep large controls inside a mobile viewport and respect motion reduction', async ({
  page,
}) => {
  await setup(page)
  await page.setViewportSize({ width: 1440, height: 1100 })
  await enter(page)
  await page.screenshot({
    path: 'artifacts/practice-ready-desktop.png',
    fullPage: true,
  })
  await page.setViewportSize({ width: 390, height: 844 })
  await page.emulateMedia({ reducedMotion: 'reduce' })
  for (const state of ['ready', 'paused']) {
    if (state === 'paused') {
      await page.keyboard.press('Space')
      await page.clock.runFor(3000)
      await page.keyboard.press('Escape')
    }
    const overlay = phase(page, state)
    await expect(overlay).toBeVisible()
    const button = overlay.getByRole('button')
    expect(
      await button.evaluate((el) => parseFloat(getComputedStyle(el).fontSize)),
    ).toBeGreaterThanOrEqual(22)
    const rect = await button.boundingBox()
    expect(rect!.x).toBeGreaterThanOrEqual(0)
    expect(rect!.x + rect!.width).toBeLessThanOrEqual(390)
    await expect(overlay).toHaveCSS('animation-name', 'none')
    await page.screenshot({
      path: `artifacts/practice-${state}-mobile.png`,
      fullPage: true,
    })
  }
  await page.setViewportSize({ width: 1440, height: 1100 })
  await page.screenshot({
    path: 'artifacts/practice-paused-desktop.png',
    fullPage: true,
  })
})
