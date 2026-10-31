import { expect, test } from '@playwright/test'
import type { RecordEntry } from '../src/domain/records/types'
import { recordGroup } from '../src/domain/records/recordStats'
import { TypingTrace } from '../src/domain/records/telemetry'
import { startPractice } from './startPractice'
import { choose } from './select'
const rows: RecordEntry[] = Array.from({ length: 225 }, (_, i) => ({
  id: `record-${i}`,
  passageId: `group-${i < 205 ? 0 : 1}`,
  title: `文章${i < 205 ? 0 : 1}`,
  layout: 'jis',
  date: new Date(Date.UTC(2026, 9, 30, 0, 0, i)).toISOString(),
  elapsed: 10000,
  keys: 100,
  misses: 0,
  kpm: 600,
  accuracy: 100,
  pace: {
    version: 1,
    samples: 10,
    min: 0,
    max: 1000,
    mean: 500,
    median: 500,
    variance: 1,
    sd: 1,
    p90: 900,
    moving: { window: 5, samples: 6, min: 100 + i, max: 300 + i },
  },
}))

test('compares selected passage attempts and pace TOP10, pages past challenges by date, eases to clicked details and retains all completed history', async ({
  page,
}) => {
  await page.clock.install()
  await page.addInitScript((records) => {
    if (localStorage.getItem('pagination-seeded')) return
    localStorage.setItem('pagination-seeded', 'yes')
    localStorage.setItem(
      'yohaku.settings.v1',
      JSON.stringify({ background: false, navigationMotion: 'off' }),
    )
    const legacyWeak = {
      ...records[0],
      id: 'legacy-weak',
      mode: 'weak',
      title: '苦手ワード · 旧記録',
    }
    localStorage.setItem(
      'yohaku.history.v1',
      JSON.stringify([...records, legacyWeak]),
    )
    localStorage.setItem(
      'galactype.bests.v1',
      JSON.stringify([
        records[0],
        legacyWeak,
        {
          ...records[0],
          id: 'archived',
          date: '2026-10-01T00:00:00Z',
          pace: {
            ...records[0].pace!,
            moving: { window: 5, samples: 6, min: 50, max: 900 },
          },
        },
      ]),
    )
  }, rows)
  await page.goto('/')
  await page.getByRole('button', { name: '練習の記録', exact: true }).click()
  await expect(
    page.getByText('完了した挑戦 226 回', { exact: true }),
  ).toBeVisible()
  const comparison = page.getByLabel('比較する記録', { exact: true })
  await expect(comparison).not.toContainText('苦手ワード')
  await choose(comparison, recordGroup(rows[0]))
  const past = page.getByRole('region', { name: '過去の記録一覧', exact: true })
  await expect(past.locator('tbody tr')).toHaveCount(20)
  await expect(page.locator('.history-attempts')).toContainText('206 回')
  await expect(past.locator('tbody tr').first()).toContainText('2026/10/30')
  await expect(past.locator('tbody tr').first()).not.toContainText('文章0')
  const indicator = page.getByLabel('記録の主指標', { exact: true })
  await choose(indicator, 'max')
  await expect(
    page.locator('.top-records li').first().locator('strong'),
  ).toHaveText('900 KPM')
  await choose(indicator, 'min')
  await expect(
    page.locator('.top-records li').first().locator('strong'),
  ).toHaveText('304 KPM')
  await choose(indicator, 'point')
  const pastPages = page.getByRole('navigation', {
    name: '過去の記録のページ送り',
    exact: true,
  })
  await pastPages.getByRole('button', { name: '次へ', exact: true }).click()
  await expect(pastPages).toContainText('21–40 / 206件')
  await pastPages.getByRole('button', { name: '最後', exact: true }).click()
  await expect(past.locator('tbody tr')).toHaveCount(6)
  await page.getByRole('button', { name: '環境設定', exact: true }).click()
  await choose(
    page.getByLabel('画面切り替えのアニメーション', { exact: true }),
    'on',
  )
  await page.getByRole('button', { name: '設定を閉じる', exact: true }).click()
  const row = past.locator('tbody tr').last()
  await row.locator('td').nth(1).hover()
  const panel = page.locator('.history-panel')
  await row.locator('td').nth(1).click()
  await page.clock.runFor(100)
  const early = await panel.evaluate((el) => el.scrollTop)
  expect(early).toBeGreaterThan(0)
  await page.clock.runFor(225)
  expect(await panel.evaluate((el) => el.scrollTop)).toBeLessThan(early)
  await page.clock.runFor(350)
  expect(await panel.evaluate((el) => el.scrollTop)).toBeLessThan(40)
  await expect(
    page.getByRole('region', { name: '打鍵の詳細', exact: true }),
  ).toBeInViewport()
  await expect(page.locator('.detail-point')).toContainText('pt')
  await expect(
    past.getByRole('button', { name: '分析を見る', exact: true }),
  ).toHaveCount(0)
  await page.getByRole('button', { name: '詳細を閉じる', exact: true }).click()
  await choose(comparison, recordGroup(rows[224]))
  await expect(page.locator('.history-attempts')).toContainText('20 回')
  await expect(pastPages).toContainText('1–20 / 20件')
  const height = await page
    .locator('.history-viewport')
    .evaluate((el) => el.getBoundingClientRect().height)
  await page.getByRole('tab', { name: '全記録', exact: true }).click()
  expect(
    await page
      .locator('.history-viewport')
      .evaluate((el) => el.getBoundingClientRect().height),
  ).toBe(height)
  const table = page.locator('#history-panel-records tbody')
  await expect(table.locator('tr')).toHaveCount(20)
  await expect(table.locator('tr').first()).toContainText('文章1')
  await expect(table).not.toContainText('苦手ワード')
  const pages = page.getByRole('navigation', {
    name: '全記録のページ送り',
    exact: true,
  })
  await pages.getByRole('button', { name: '次へ', exact: true }).click()
  await expect(pages).toContainText('21–40 / 226件')
  await pages.getByRole('button', { name: '最後', exact: true }).click()
  await expect(table.locator('tr')).toHaveCount(6)
  await expect(pages).toContainText('221–226 / 226件')
  await expect(table.locator('tr').last()).toContainText('2026/10/1')
  await page.setViewportSize({ width: 390, height: 850 })
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true)
  await page.screenshot({
    path: 'artifacts/history-records-mobile.png',
    fullPage: true,
    animations: 'disabled',
  })
  await page.getByRole('button', { name: 'タイピング', exact: true }).click()
  await page.getByRole('button', { name: '入力へ進む', exact: true }).click()
  await startPractice(page, true)
  await page.keyboard.type('h')
  await page.getByRole('button', { name: '練習の記録', exact: true }).click()
  await expect(
    page.getByText('完了した挑戦 226 回', { exact: true }),
  ).toBeVisible()
  expect(
    await page.evaluate(
      () => JSON.parse(localStorage.getItem('yohaku.history.v1')!).length,
    ),
  ).toBe(226)
})

test('weak words paginate without losing selections or repeat settings; selected words from different pages enter one run', async ({
  page,
}) => {
  const trace = new TypingTrace()
  for (let i = 0; i < 25; i++) {
    trace.begin(
      {
        text: `銀河${String(i).padStart(2, '0')}`,
        reading: 'ぎんが',
        segments: [
          { text: `銀河${String(i).padStart(2, '0')}`, reading: 'ぎんが' },
        ],
      },
      i * 1000,
      'jis',
    )
    trace.add('x', 'g', 0, false, i * 1000 + 100)
    trace.add('g', 'g', 0, true, i * 1000 + 200)
  }
  const data = trace.finish(25000)
  await page.clock.install()
  await page.addInitScript((data) => {
    if (localStorage.getItem('weak-pagination-seeded')) return
    localStorage.setItem('weak-pagination-seeded', 'yes')
    localStorage.setItem(
      'yohaku.settings.v1',
      JSON.stringify({ background: false, navigationMotion: 'off' }),
    )
    localStorage.setItem(
      'yohaku.history.v1',
      JSON.stringify([
        {
          id: 'words',
          passageId: 'words',
          title: '単語集',
          layout: 'jis',
          date: '2026-10-30T00:00:00Z',
          elapsed: data.elapsed,
          keys: 25,
          misses: 25,
          kpm: 60,
          accuracy: 50,
          hasTrace: true,
        },
      ]),
    )
    const request = indexedDB.open('galactype.telemetry.v1', 1)
    request.onupgradeneeded = () => request.result.createObjectStore('traces')
    request.onsuccess = () => {
      const db = request.result,
        tx = db.transaction('traces', 'readwrite')
      tx.objectStore('traces').put(data, 'words')
      tx.oncomplete = () => db.close()
    }
  }, data)
  await page.goto('/')
  await page
    .getByRole('button', { name: '苦手ワード練習', exact: true })
    .click()
  await expect(page.locator('.weak-word-list .weak-word')).toHaveCount(20)
  await page.getByRole('button', { name: '選択を解除', exact: true }).click()
  await page.getByLabel('銀河00を練習', { exact: true }).check()
  await page.getByLabel('繰り返し回数', { exact: true }).fill('3')
  const paging = page.getByRole('navigation', {
    name: '苦手ワードのページ送り',
    exact: true,
  })
  await paging.getByRole('button', { name: '次へ', exact: true }).click()
  await expect(page.locator('.weak-word-list .weak-word')).toHaveCount(5)
  await page.getByLabel('銀河24を練習', { exact: true }).check()
  await paging.getByRole('button', { name: '前へ', exact: true }).click()
  await expect(page.getByLabel('銀河00を練習', { exact: true })).toBeChecked()
  await expect(page.getByLabel('繰り返し回数', { exact: true })).toHaveValue(
    '3',
  )
  await page.getByRole('button', { name: '2語で反復練習', exact: true }).click()
  await expect(
    page.getByRole('region', { name: '苦手ワードの反復練習', exact: true }),
  ).toContainText('2語 × 3回')
  await page.getByRole('region', { name: /タイピング入力領域/ }).focus()
  await page.keyboard.press('Space')
  await page.clock.runFor(3000)
  for (let i = 0; i < 6; i++) await page.keyboard.type('ginnga')
  await expect(
    page.getByRole('button', { name: '今回の単語を候補から削除', exact: true }),
  ).toBeVisible()
  await page
    .getByRole('button', { name: '今回の単語を候補から削除', exact: true })
    .click()
  expect(
    await page.evaluate(
      () => JSON.parse(localStorage.getItem('yohaku.history.v1')!).length,
    ),
  ).toBe(1)
  await expect(paging).toContainText('/ 23件')
  await expect(page.getByLabel('銀河00を練習', { exact: true })).toHaveCount(0)
  await page.reload()
  await page
    .getByRole('button', { name: '苦手ワード練習', exact: true })
    .click()
  await expect(paging).toContainText('/ 23件')
  await expect(page.getByLabel('銀河00を練習', { exact: true })).toHaveCount(0)
})
