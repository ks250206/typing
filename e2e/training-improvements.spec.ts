import { expect, test, type Page } from '@playwright/test'
import { RomanEngine } from '../src/domain/typing/engine'
import { TypingTrace } from '../src/domain/records/telemetry'
import { choose } from './select'
import { startPractice } from './startPractice'

async function setup(page: Page) {
  await page.clock.install()
  await page.addInitScript(() =>
    localStorage.setItem(
      'yohaku.settings.v1',
      JSON.stringify({ background: false, navigationMotion: 'off' }),
    ),
  )
  await page.goto('/')
}
const sentence = {
  text: '銀河の記録',
  reading: 'ぎんがのきろく',
  segments: [
    { text: '銀河', reading: 'ぎんが' },
    { text: 'の', reading: 'の' },
    { text: '記録', reading: 'きろく' },
  ],
}
const recorder = new TypingTrace()
recorder.begin(sentence, 0, 'jis')
recorder.add('x', 'g', 0, false, 100)
const engine = new RomanEngine(sentence.reading)
let at = 200
for (const char of engine.hint) {
  const position = engine.position
  engine.feed(char)
  recorder.add(char, char, position, true, at)
  at += position >= 4 ? 400 : 100
}
const source = {
  id: 'weak-fixture',
  passageId: 'source',
  title: '銀河の記録',
  date: '2026-10-30T00:00:00Z',
  layout: 'jis',
  elapsed: at,
  keys: recorder.finish(at).strokes.filter((s) => s.correct).length,
  misses: 1,
  rawMisses: 1,
  kpm: 240,
  accuracy: 90,
  mode: 'practice',
  hasTrace: true,
  trace: recorder.finish(at),
}
async function seedLog(page: Page) {
  await page.addInitScript((record) => {
    if (localStorage.getItem('weak-fixture-seeded')) return
    localStorage.setItem('weak-fixture-seeded', 'true')
    localStorage.setItem('yohaku.history.v1', JSON.stringify([record]))
    const request = indexedDB.open('galactype.telemetry.v1', 1)
    request.onupgradeneeded = () => request.result.createObjectStore('traces')
    request.onsuccess = () => {
      const db = request.result,
        tx = db.transaction('traces', 'readwrite')
      tx.objectStore('traces').put(record.trace, record.id)
      tx.oncomplete = () => db.close()
    }
  }, source)
}

test('five-row keyboards flash the real mistaken key, re-pulse the expected key, clear on pause/reset and respect reduced motion', async ({
  page,
}) => {
  await setup(page)
  await page.getByRole('button', { name: '入力へ進む', exact: true }).click()
  const area = page.getByRole('region', { name: /タイピング入力領域/ })
  await area.focus()
  await startPractice(page, true)
  await expect(
    page.locator('[data-code="Escape"], [data-code="F1"], [data-code="F12"]'),
  ).toHaveCount(0)
  const expected = page.locator('[data-code="KeyH"]')
  const wrong = page.locator('[data-code="KeyZ"]')
  await page.keyboard.press('KeyZ')
  await expect(wrong).toHaveAttribute('data-error', 'true')
  await expect(expected).toHaveAttribute('data-state', 'next')
  await expect(expected.locator('.next-key-pulse')).toHaveCount(1)
  await page.clock.runFor(300)
  await page.keyboard.press('KeyZ')
  await page.clock.runFor(350)
  await expect(wrong).toHaveAttribute('data-error', 'true')
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await expect(expected.locator('.next-key-pulse')).toHaveCSS(
    'animation-name',
    'none',
  )
  await page.keyboard.press('Escape')
  await expect(page.locator('[data-error="true"]')).toHaveCount(0)
  await page.getByRole('button', { name: '再開する', exact: true }).click()
  await page.keyboard.press('KeyZ')
  await page.clock.runFor(610)
  await expect(page.locator('[data-error="true"]')).toHaveCount(0)
  await page.getByRole('button', { name: 'やり直す', exact: true }).click()
  await expect(page.locator('[data-error="true"]')).toHaveCount(0)
})

test('CPU settings disappear after start; the right sidebar keeps the normal main width and error feedback, pause and reset work', async ({
  page,
}) => {
  await setup(page)
  const width = (selector: string) =>
    page.locator(selector).evaluate((el) => el.getBoundingClientRect().width)
  const normal = await width('.practice-main')
  await page.getByRole('button', { name: 'CPU対戦', exact: true }).click()
  await expect(page.getByLabel('CPUプリセット', { exact: true })).toBeVisible()
  expect(Math.abs((await width('.cpu-battle')) - normal)).toBeLessThan(1)
  await choose(page.getByLabel('CPUプリセット', { exact: true }), 'カメ')
  await page.getByRole('button', { name: 'CPUと対戦する', exact: true }).click()
  await expect(page.locator('.cpu-config')).toHaveCount(0)
  await expect(
    page.getByRole('complementary', { name: '対戦のサイドバー' }),
  ).toBeVisible()
  await page.clock.runFor(3100)
  const area = page.getByRole('region', {
    name: 'CPU対戦の入力領域',
    exact: true,
  })
  await area.focus()
  // Semicolon is never a Japanese roman initial in the RTC default corpus.
  await page.keyboard.press('Semicolon')
  await expect(page.locator('[data-code="Semicolon"]')).toHaveAttribute(
    'data-error',
    'true',
  )
  await page.keyboard.press('Escape')
  await expect(page.locator('[data-error="true"]')).toHaveCount(0)
  await page
    .getByRole('button', { name: '対戦をリセット', exact: true })
    .click()
  await expect(page.getByLabel('CPUプリセット', { exact: true })).toBeVisible()
  await page.setViewportSize({ width: 390, height: 900 })
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true)
  await page.screenshot({
    path: 'artifacts/cpu-sidebar-mobile.png',
    fullPage: true,
  })
})

test('a legacy log yields reusable words; repetition shows statistics and tooltips without saving records', async ({
  page,
}) => {
  await seedLog(page)
  await setup(page)
  await page
    .getByRole('button', { name: '苦手ワード練習', exact: true })
    .click()
  await expect(page.getByLabel('銀河を練習', { exact: true })).toBeVisible()
  await expect(page.getByLabel('のを練習', { exact: true })).toHaveCount(0)
  await page.getByRole('button', { name: '選択を解除', exact: true }).click()
  await page.getByLabel('銀河を練習', { exact: true }).check()
  await page.getByLabel('繰り返し回数', { exact: true }).fill('3.5')
  await expect(page.getByLabel('繰り返し回数', { exact: true })).toHaveValue(
    '3',
  )
  await page.getByRole('button', { name: '1語で反復練習', exact: true }).click()
  const area = page.getByRole('region', { name: /タイピング入力領域/ })
  await expect(area).toBeFocused()
  await page.keyboard.press('Space')
  await page.clock.runFor(3000)
  await page.keyboard.press('Semicolon')
  await expect(page.locator('[data-code="Semicolon"]')).toHaveAttribute(
    'data-error',
    'true',
  )
  for (let i = 0; i < 3; i++) {
    await page.clock.runFor(2200)
    await page.keyboard.type('ginnga')
  }
  await expect(
    page.getByText('反復練習 COMPLETE', { exact: true }),
  ).toBeVisible()
  await expect(page.locator('.result-pace .pace-axis text')).toHaveCount(5)
  await expect(
    page.getByRole('region', { name: '速度の詳細統計' }),
  ).toContainText('分散（母分散）')
  await expect(page.locator('.moving-stat small')).toHaveCount(0)
  const rawMinimum = page
    .locator('.statistics-grid > div')
    .filter({ has: page.getByText('最低速度', { exact: true }) })
  await expect(rawMinimum).not.toContainText('過去順位')
  await expect(page.locator('.result-pace .pace-moving')).not.toHaveAttribute(
    'points',
    '',
  )

  const cards = page.locator('.statistics-grid > div')
  const positions = await Promise.all(
    [0, 1, 2, 3].map((i) => cards.nth(i).boundingBox()),
  )
  expect(positions[0]!.x).toBeCloseTo(positions[2]!.x)
  expect(positions[1]!.x).toBeCloseTo(positions[3]!.x)
  expect(positions[2]!.y).toBeGreaterThan(positions[0]!.y)
  const chart = page.getByRole('img', {
    name: '1秒ごとのKPMとミス',
    exact: true,
  })
  await chart.locator('circle').nth(2).hover()
  await expect(page.getByRole('tooltip')).toContainText('銀河')
  await expect(page.getByRole('tooltip')).toContainText('ミス')
  await page.screenshot({
    path: 'artifacts/pace-tooltip.png',
    fullPage: true,
    animations: 'disabled',
  })
  await chart.focus()
  await chart.press('End')
  await expect(page.getByRole('tooltip')).toContainText('5–6秒')
  await chart.press('Escape')
  await expect(page.getByRole('tooltip')).toHaveCount(0)
  expect(
    await page.evaluate(() =>
      JSON.parse(localStorage.getItem('yohaku.history.v1') ?? '[]').some(
        (r: { mode?: string }) => r.mode === 'weak',
      ),
    ),
  ).toBe(false)
  await page.screenshot({
    path: 'artifacts/weak-result-statistics.png',
    fullPage: true,
    animations: 'disabled',
  })
  await page
    .getByRole('button', { name: '同じ単語でもう一度', exact: true })
    .click()
  await expect(area).toBeFocused()
  await page.keyboard.press('Space')
  await page.clock.runFor(3000)
  for (let i = 0; i < 3; i++) {
    await page.clock.runFor(2500)
    await page.keyboard.type('ginnga')
  }
  await expect(
    page.getByText('反復練習 COMPLETE', { exact: true }),
  ).toBeVisible()
  expect(
    await page.evaluate(
      () =>
        JSON.parse(localStorage.getItem('yohaku.history.v1') ?? '[]').length,
    ),
  ).toBe(1)
  await page.reload()
  await page.getByRole('button', { name: '練習の記録', exact: true }).click()
  await expect(page.locator('.passage-records')).not.toContainText('苦手ワード')
  await page.getByRole('tab', { name: '全記録', exact: true }).click()
  await expect(page.locator('.history-table tbody tr')).toHaveCount(1)
  await expect(page.locator('.history-table')).not.toContainText('苦手ワード')
  await page.setViewportSize({ width: 390, height: 900 })
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true)
})

test('weak practice has an explicit empty state with no logs', async ({
  page,
}) => {
  await setup(page)
  await page
    .getByRole('button', { name: '苦手ワード練習', exact: true })
    .click()
  await expect(page.getByText(/練習候補がありません/)).toBeVisible()
})

test('AZERTY accepts numeric Shift and Ctrl+Alt as AltGr with physical error feedback', async ({
  page,
}) => {
  await setup(page)
  await choose(page.getByLabel('入力方式', { exact: true }), 'azerty')
  await page.getByRole('button', { name: '入力へ進む', exact: true }).click()
  await page.getByRole('region', { name: /タイピング入力領域/ }).focus()
  await startPractice(page, true)
  await page.keyboard.press('Control+Alt+Digit0')
  await expect(page.locator('[data-code="Digit0"]')).toHaveAttribute(
    'data-error',
    'true',
  )
  await page.clock.runFor(650)
  await page.keyboard.press('Shift+Digit1')
  await expect(page.locator('[data-code="Digit1"]')).toHaveAttribute(
    'data-error',
    'true',
  )
})

test('changing layout in weak practice also resets the suspended normal engine', async ({
  page,
}) => {
  await seedLog(page)
  await setup(page)
  await page
    .getByRole('button', { name: '苦手ワード練習', exact: true })
    .click()
  await page.getByRole('button', { name: /語で反復練習/, exact: true }).click()
  await choose(page.getByLabel('入力方式', { exact: true }), 'kana')
  await page.getByRole('button', { name: 'タイピング', exact: true }).click()
  await page.getByRole('button', { name: '入力へ進む', exact: true }).click()
  await page.getByRole('region', { name: /タイピング入力領域/ }).focus()
  await startPractice(page, true)
  await page.keyboard.press('Equal') // へ
  await expect(page.locator('[data-code="KeyE"]')).toHaveAttribute(
    'data-state',
    'next',
  ) // い
  await expect(page.locator('[data-error="true"]')).toHaveCount(0)
})

test('settings delete uses a separate confirmation, cancels safely, removes stored records and logs, and preserves settings', async ({
  page,
}) => {
  await seedLog(page)
  await setup(page)
  await page.setViewportSize({ width: 390, height: 600 })
  await page.getByRole('button', { name: '環境設定', exact: true }).click()
  const settings = page.getByRole('dialog')
  const clear = settings.getByRole('button', {
    name: '記録をすべて消去',
    exact: true,
  })
  const box = await settings.boundingBox()
  expect(box!.y).toBeGreaterThanOrEqual(24)
  expect(box!.y + box!.height).toBeLessThanOrEqual(576)
  const preferences = await page.evaluate(() =>
    localStorage.getItem('yohaku.settings.v1'),
  )
  await clear.click()
  const confirm = page.getByRole('alertdialog')
  await expect(settings).toHaveCount(0)
  await expect(
    confirm.getByRole('button', { name: 'キャンセル', exact: true }),
  ).toBeFocused()
  expect(
    await page.evaluate(
      () =>
        JSON.parse(localStorage.getItem('yohaku.history.v1') ?? '[]').length,
    ),
  ).toBe(1)
  await confirm.getByRole('button', { name: 'キャンセル', exact: true }).click()
  await expect(clear).toBeFocused()
  await clear.click()
  await page.keyboard.press('Escape')
  await expect(clear).toBeFocused()
  await clear.click()
  await confirm.getByRole('button', { name: '削除する', exact: true }).click()
  await expect(confirm).toHaveCount(0)
  await expect(clear).toBeFocused()
  expect(
    await page.evaluate(() =>
      JSON.parse(localStorage.getItem('yohaku.history.v1') ?? '[]'),
    ),
  ).toEqual([])
  expect(
    await page.evaluate(() =>
      JSON.parse(localStorage.getItem('galactype.bests.v1') ?? '[]'),
    ),
  ).toEqual([])
  expect(
    await page.evaluate(() => localStorage.getItem('yohaku.settings.v1')),
  ).toBe(preferences)
  const count = await page.evaluate(
    () =>
      new Promise<number>((resolve, reject) => {
        const request = indexedDB.open('galactype.telemetry.v1', 1)
        request.onsuccess = () => {
          const db = request.result,
            tx = db.transaction('traces'),
            rows = tx.objectStore('traces').count()
          rows.onsuccess = () => resolve(rows.result)
          tx.oncomplete = () => db.close()
        }
        request.onerror = () => reject(request.error)
      }),
  )
  expect(count).toBe(0)
  await settings.getByRole('button', { name: '閉じる', exact: true }).click()
  await page.getByRole('button', { name: '練習の記録', exact: true }).click()
  await expect(
    page.getByText('最初の一篇から、はじめよう。', { exact: true }),
  ).toBeVisible()
  await page.getByRole('button', { name: 'タイピング', exact: true }).click()
  await expect(
    page.getByRole('button', { name: '夜更けの図書室', exact: true }),
  ).toBeVisible()
})

test('failed settings deletion keeps the confirmation and stored data for retry', async ({
  page,
}) => {
  await seedLog(page)
  await setup(page)
  await page.getByRole('button', { name: '環境設定', exact: true }).click()
  await page
    .getByRole('button', { name: '記録をすべて消去', exact: true })
    .click()
  await page.evaluate(() =>
    Object.defineProperty(indexedDB, 'open', {
      configurable: true,
      value: () => {
        throw new Error('test: storage blocked')
      },
    }),
  )
  const confirm = page.getByRole('alertdialog')
  await confirm.getByRole('button', { name: '削除する', exact: true }).click()
  await expect(confirm.getByRole('alert')).toContainText(
    '記録を削除できませんでした',
  )
  expect(
    await page.evaluate(
      () =>
        JSON.parse(localStorage.getItem('yohaku.history.v1') ?? '[]').length,
    ),
  ).toBe(1)
  await expect(
    confirm.getByRole('button', { name: 'キャンセル', exact: true }),
  ).toBeFocused()
  await confirm.getByRole('button', { name: 'キャンセル', exact: true }).click()
  await page.reload()
  await page
    .getByRole('button', { name: '苦手ワード練習', exact: true })
    .click()
  await expect(page.getByLabel('銀河を練習', { exact: true })).toBeVisible()
})

test('history axes use labeled hundreds and unlabeled fifty-step minor ticks with a rounded maximum', async ({
  page,
}) => {
  await seedLog(page)
  await setup(page)
  await page.getByRole('button', { name: '練習の記録', exact: true }).click()
  await choose(page.getByLabel('記録の主指標', { exact: true }), 'kpm')
  const axis = page.locator('.history-insights .chart-y-axis')
  await expect(axis.locator('[data-tick="major"] text')).toHaveText([
    '0',
    '100',
    '200',
    '300',
  ])
  await expect(axis.locator('[data-tick="minor"]')).toHaveCount(3)
  await expect(axis.locator('[data-tick="minor"] text')).toHaveCount(0)
  await page.getByRole('tab', { name: '全記録', exact: true }).click()
  const actions = page.locator('.history-record-actions').first()
  const buttons = actions.getByRole('button')
  const first = await buttons.nth(0).boundingBox()
  const second = await buttons.nth(1).boundingBox()
  expect(second!.y > first!.y || second!.x >= first!.x + first!.width + 6).toBe(
    true,
  )
  await page.screenshot({
    path: 'artifacts/history-record-actions.png',
    fullPage: true,
    animations: 'disabled',
  })
  await page
    .locator('.history-table tbody tr')
    .first()
    .getByRole('button', { name: '詳細を見る', exact: true })
    .click()
  const detail = page.getByRole('region', { name: '打鍵の詳細', exact: true })
  await expect(detail.locator('.chart-y-axis')).toBeVisible()
  const labels = await detail
    .locator('.chart-y-axis [data-tick="major"] text')
    .allTextContents()
  expect(labels.length).toBeGreaterThan(1)
  expect(labels.map(Number).every((v, i) => v === i * 100)).toBe(true)
  await expect(
    detail.locator('.chart-y-axis [data-tick="minor"] text'),
  ).toHaveCount(0)
  await page.setViewportSize({ width: 390, height: 900 })
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true)
})
