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

test('a legacy saved log yields reusable words without particles; a repeated run saves separately, displays axes/statistics and ranks after reload', async ({
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
    await page.clock.runFor(1100)
    await page.keyboard.type('ginnga')
  }
  await expect(
    page.getByText('反復練習 COMPLETE', { exact: true }),
  ).toBeVisible()
  await expect(page.locator('.result-pace .pace-axis text')).toHaveCount(5)
  await expect(
    page.getByRole('region', { name: '速度の詳細統計' }),
  ).toContainText('分散（母分散）')
  await expect(
    page.getByRole('region', { name: '速度の詳細統計' }),
  ).toContainText('過去順位 1 / 1')
  await expect
    .poll(() =>
      page.evaluate(() =>
        JSON.parse(localStorage.getItem('yohaku.history.v1') ?? '[]').some(
          (r: { mode?: string; pace?: unknown }) =>
            r.mode === 'weak' && !!r.pace,
        ),
      ),
    )
    .toBe(true)
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
    await page.clock.runFor(1500)
    await page.keyboard.type('ginnga')
  }
  await expect(
    page.getByRole('region', { name: '速度の詳細統計' }),
  ).toContainText('過去順位 1 / 2')
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          JSON.parse(localStorage.getItem('yohaku.history.v1') ?? '[]').filter(
            (r: { mode?: string }) => r.mode === 'weak',
          ).length,
      ),
    )
    .toBe(2)
  await page.reload()
  await page.getByRole('button', { name: '練習の記録', exact: true }).click()
  const row = page
    .locator('.history-table tbody tr')
    .filter({ hasText: '苦手ワード' })
    .first()
  await row.getByRole('button', { name: '詳細を見る', exact: true }).click()
  await expect(
    page.getByRole('region', { name: '速度の詳細統計' }),
  ).toContainText('過去順位 1 / 2')
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
