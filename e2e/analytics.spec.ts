import { startPractice } from './startPractice'
import { choose as pick } from './select'
import { test, expect, type Page } from '@playwright/test'
import { readFile } from 'node:fs/promises'
import {
  battleSets,
  seededBattlePrompts,
} from '../src/domain/content/battleSets'
const input = async (page: Page) =>
  ((await page.locator('.roman-current').textContent()) ?? '') +
  ((await page.locator('.remaining-roman').textContent()) ?? '')
const records = (page: Page) =>
  page.evaluate(() =>
    JSON.parse(localStorage.getItem('yohaku.history.v1') ?? '[]'),
  )
const dbTrace = (page: Page, id: string) =>
  page.evaluate(
    (id) =>
      new Promise<unknown>((resolve, reject) => {
        const r = indexedDB.open('galactype.telemetry.v1')
        r.onsuccess = () => {
          const db = r.result
          const q = db.transaction('traces').objectStore('traces').get(id)
          q.onsuccess = () => {
            db.close()
            resolve(q.result)
          }
          q.onerror = () => reject(q.error)
        }
        r.onerror = () => reject(r.error)
      }),
    id,
  )

async function palette(page: Page) {
  const result = await page.locator('.keyboard-guide').evaluate((el) => {
    const canvas = document.createElement('canvas')
    canvas.width = canvas.height = 1
    const ctx = canvas.getContext('2d')!
    const rgb = (color: string) => {
      ctx.clearRect(0, 0, 1, 1)
      ctx.fillStyle = color
      ctx.fillRect(0, 0, 1, 1)
      return [...ctx.getImageData(0, 0, 1, 1).data].slice(0, 3)
    }
    const luminance = (c: number[]) =>
      c
        .map((n) => n / 255)
        .map((n) => (n <= 0.04045 ? n / 12.92 : ((n + 0.055) / 1.055) ** 2.4))
        .reduce((sum, n, i) => sum + n * [0.2126, 0.7152, 0.0722][i], 0)
    const colors = ['pinky', 'ring', 'middle', 'index', 'thumb'].map((f) => {
      const key = el.querySelector<HTMLElement>(
        `.keyboard-key[data-finger$="${f}"][data-state="idle"]`,
      )!
      const s = getComputedStyle(key)
      const bg = rgb(s.backgroundColor)
      const fg = rgb(s.color)
      return { bg, contrast: (luminance(fg) + 0.05) / (luminance(bg) + 0.05) }
    })
    return {
      minContrast: Math.min(...colors.map((c) => c.contrast)),
      minDistance: Math.min(
        ...colors.flatMap((c, i) =>
          colors
            .slice(i + 1)
            .map((b) =>
              Math.sqrt(c.bg.reduce((n, v, k) => n + (v - b.bg[k]) ** 2, 0)),
            ),
        ),
      ),
    }
  })
  expect(result.minContrast).toBeGreaterThan(4.5)
  expect(result.minDistance).toBeGreaterThan(18)
}

test('seeded CPU set selection, prominent scores, full RTC trace persistence and identical seeded rematch', async ({
  page,
}) => {
  await page.clock.install()
  await page.goto('/')
  await page.getByLabel('3D 背景', { exact: true }).uncheck()
  await page.getByRole('button', { name: 'CPU対戦', exact: true }).click()
  await page.getByLabel('対戦の文章セット').click()
  await expect(page.getByRole('listbox').getByRole('option')).toHaveCount(
    battleSets.length,
  )
  await page.keyboard.press('Escape')
  await pick(page.getByLabel('対戦の文章セット'), 'etyping-face-idioms')
  await page.getByLabel('対戦シードを固定する', { exact: true }).check()
  await page.getByLabel('対戦シード', { exact: true }).fill('rtc-analytics')
  await page.getByLabel('CPU速度 (KPM)', { exact: true }).fill('60')
  await page.getByLabel('CPU反応時間 (ms)', { exact: true }).fill('1500')
  await pick(page.getByLabel('CPUの打ち方', { exact: true }), 'constant')
  await page.getByRole('button', { name: 'CPUと対戦する', exact: true }).click()
  let index = 0
  const expected = seededBattlePrompts('etyping-face-idioms', 'rtc-analytics')
  for (let round = 0; round < 4; round++) {
    await page.clock.fastForward(3100)
    for (let word = 0; word < 10; word++) {
      await expect(page.locator('.current-paragraph')).toHaveAttribute(
        'data-text',
        expected[index++].text,
      )
      await page.getByRole('region', { name: 'CPU対戦の入力領域' }).focus()
      await page.clock.runFor(100)
      await page.keyboard.type(await input(page))
      if (round === 0 && word === 0) {
        await expect(page.getByTestId('player-points')).toHaveText('1')
        expect(
          await page
            .getByTestId('player-points')
            .evaluate((el) => parseFloat(getComputedStyle(el).fontSize)),
        ).toBeGreaterThanOrEqual(30)
        await expect(
          page.locator('.point-lights [data-lit="true"]'),
        ).toHaveCount(1)
        await palette(page)
        await page.screenshot({
          path: 'artifacts/rtc-score-desktop.png',
          fullPage: true,
          animations: 'disabled',
        })
        await page.setViewportSize({ width: 390, height: 1000 })
        expect(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth,
          ),
        ).toBe(true)
        await page.emulateMedia({ reducedMotion: 'reduce' })
        await expect(page.getByTestId('player-points')).toHaveCSS(
          'animation-name',
          'none',
        )
        await page.screenshot({
          path: 'artifacts/rtc-score-mobile.png',
          fullPage: true,
          animations: 'disabled',
        })
      }
      if (word < 9) await page.clock.fastForward(700)
    }
    if (round < 3)
      await page
        .getByRole('button', { name: '次のラウンド', exact: true })
        .click()
  }
  await expect(page.getByText('VICTORY / 勝利', { exact: true })).toBeVisible()
  await expect.poll(async () => (await records(page)).length).toBe(1)
  const saved = (await records(page))[0]
  expect(saved).toMatchObject({
    passageId: 'etyping-face-idioms',
    seed: 'rtc-analytics',
    rank: expect.stringMatching(/^星々に祝福されし/),
    hasTrace: true,
    mode: 'cpu',
    cpuConfig: { kpm: 60, reactionMs: 1500, curve: 'constant' },
  })
  const trace = (await dbTrace(page, saved.id)) as {
    prompts: { text: string }[]
    strokes: { correct: boolean; t: number }[]
    elapsed: number
  }
  expect(trace.prompts.map((p) => p.text)).toEqual(
    expected.slice(0, 40).map((s) => s.text),
  )
  expect(trace.strokes.filter((s) => s.correct)).toHaveLength(saved.keys)
  expect(trace.strokes.every((s) => s.t <= trace.elapsed)).toBe(true)
  await page.getByRole('button', { name: '練習の記録', exact: true }).click()
  await page.getByRole('tab', { name: '全記録', exact: true }).click()
  await page
    .getByRole('button', {
      name: '対戦シード rtc-analytics を再現',
      exact: true,
    })
    .click()
  await expect(page.getByLabel('対戦の文章セット')).toHaveAttribute(
    'data-value',
    'etyping-face-idioms',
  )
  await expect(
    page.getByLabel('対戦シードを固定する', { exact: true }),
  ).toBeChecked()
  await expect(page.getByLabel('CPU速度 (KPM)', { exact: true })).toHaveValue(
    '60',
  )
  await page.getByRole('button', { name: 'CPUと対戦する', exact: true }).click()
  await page.clock.fastForward(3100)
  await expect(page.locator('.current-paragraph')).toHaveAttribute(
    'data-text',
    expected[0].text,
  )
  await expect(page.locator('.next-sentence')).toHaveCount(0)
})

test('all practice strokes survive reload; pauses are excluded; analysis, pagination, export and deletion include traces and bests', async ({
  page,
}) => {
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(e.message))
  await page.clock.install()
  await page.goto('/')
  await page.getByLabel('3D 背景', { exact: true }).uncheck()
  await page
    .getByRole('button', { name: 'タイプウェル準拠 · 宇宙の名前', exact: true })
    .click()
  await page.getByLabel('シードを固定する', { exact: true }).check()
  await page.getByLabel('出題シード', { exact: true }).fill('telemetry')
  await page
    .getByRole('button', { name: 'このシードを使う', exact: true })
    .click()
  await page.getByRole('button', { name: '入力へ進む', exact: true }).click()
  await expect(page.locator('[data-face="2"]')).toHaveCSS('transform', 'none')
  // Freeze the clock after the carousel transition; CI keyboard dispatch is slower.
  await page.clock.pauseAt(
    new Date(await page.evaluate(() => Date.now() + 10_000)),
  )
  await page.getByRole('region', { name: /タイピング入力/ }).focus()
  await startPractice(page, true)
  const guide = await input(page)
  await page.keyboard.type(guide[0])
  await page.clock.runFor(200)
  const next = (await input(page))[0]
  await page.keyboard.type(next === 'z' ? 'qqq' : 'zzz')
  await page.clock.runFor(300)
  await page.keyboard.press('Escape')
  await page.clock.fastForward(30000)
  await page.getByRole('button', { name: '再開する', exact: true }).click()
  await page.getByRole('region', { name: /タイピング入力/ }).focus()
  await startPractice(page, true)
  await page.clock.runFor(250)
  const tail = guide.slice(1)
  for (let offset = 0; offset < tail.length; offset += 20) {
    await page.clock.runFor(100)
    await page.keyboard.type(tail.slice(offset, offset + 20))
  }
  await expect(
    page.getByText('SESSION COMPLETE', { exact: true }),
  ).toBeVisible()
  await expect.poll(async () => (await records(page)).length).toBe(1)
  const record = (await records(page))[0]
  expect(record.elapsed).toBeCloseTo(2750, 0)
  const trace = (await dbTrace(page, record.id)) as {
    strokes: { correct: boolean; dt: number }[]
  }
  expect(trace.strokes).toHaveLength(403)
  expect(trace.strokes.filter((s) => !s.correct)).toHaveLength(3)
  expect(Math.max(...trace.strokes.map((s) => s.dt))).toBeLessThan(3000)
  await page.reload()
  await page.getByRole('button', { name: '練習の記録', exact: true }).click()
  await expect(
    page.getByRole('region', { name: '文章別の記録分析', exact: true }),
  ).toContainText('歴代 TOP 10')
  await page.getByRole('tab', { name: '全記録', exact: true }).click()
  await page.getByRole('button', { name: '詳細を見る', exact: true }).click()
  const detail = page.getByRole('region', { name: '打鍵の詳細' })
  await expect(detail).toContainText('403打鍵（実ミス 3）')
  await expect(
    detail.getByRole('img', { name: '1秒区間のKPMとミス率' }),
  ).toBeVisible()
  await page
    .getByRole('button', { name: '文字・文章のタイムロス', exact: true })
    .click()
  await expect(detail).toContainText('時間がかかった文章')
  await expect(detail.locator('.prompt-losses li')).toHaveCount(1)
  await page.screenshot({
    path: 'artifacts/typing-analysis-desktop.png',
    fullPage: true,
    animations: 'disabled',
  })
  await page.getByRole('button', { name: '全打鍵ログ', exact: true }).click()
  await expect(detail.locator('tbody tr')).toHaveCount(100)
  await page.getByRole('button', { name: '次の100打鍵', exact: true }).click()
  await expect(detail).toContainText('101–200 / 403')
  await page.setViewportSize({ width: 390, height: 1000 })
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true)
  await page.screenshot({
    path: 'artifacts/typing-analysis-mobile.png',
    fullPage: true,
    animations: 'disabled',
  })
  const download = page.waitForEvent('download')
  await page.getByRole('button', { name: 'JSON 書出し', exact: true }).click()
  const file = await download
  const json = JSON.parse(await readFile((await file.path())!, 'utf8'))
  expect(json.traces[record.id].strokes).toHaveLength(403)
  expect(json.bestRecords).toHaveLength(1)
  await page.getByRole('button', { name: '全記録を削除', exact: true }).click()
  await page.getByRole('button', { name: '削除する', exact: true }).click()
  await expect(page.getByText('最初の一篇から、はじめよう。')).toBeVisible()
  expect(await dbTrace(page, record.id)).toBeUndefined()
  expect(
    await page.evaluate(() =>
      JSON.parse(localStorage.getItem('galactype.bests.v1')!),
    ),
  ).toEqual([])
  expect(errors).toEqual([])
})

test('legacy records remain comparable and explain missing detail', async ({
  page,
}) => {
  await page.addInitScript(() => {
    localStorage.setItem(
      'yohaku.settings.v1',
      JSON.stringify({ background: false }),
    )
    const rows = [100, 200, 300, 400, 500, 600].map((kpm, i) => ({
      id: String(i),
      passageId: 'old-set',
      title: '以前の文章',
      layout: 'jis',
      date: new Date(1700000000000 + i * 1000).toISOString(),
      elapsed: 60000,
      keys: kpm,
      misses: 0,
      kpm,
      accuracy: 100,
    }))
    localStorage.setItem('yohaku.history.v1', JSON.stringify(rows))
  })
  await page.goto('/')
  await page.getByRole('button', { name: '練習の記録', exact: true }).click()
  const metrics = page.locator('.history-metrics')
  await expect(metrics).toContainText('600')
  await expect(metrics).toContainText('500')
  await expect(metrics).toContainText('400.0')
  await expect(page.locator('.top-records li')).toHaveCount(6)
  await page.getByRole('tab', { name: '全記録', exact: true }).click()
  await page
    .getByRole('button', { name: '詳細を見る', exact: true })
    .first()
    .click()
  await expect(page.getByRole('region', { name: '打鍵の詳細' })).toContainText(
    'この記録には打鍵ログがありません',
  )
})

test('unavailable detail storage warns and keeps every stroke exportable in memory', async ({
  page,
}) => {
  await page.clock.install()
  await page.addInitScript(() =>
    Object.defineProperty(window, 'indexedDB', { value: undefined }),
  )
  await page.goto('/')
  await page.getByLabel('3D 背景', { exact: true }).uncheck()
  await page
    .getByRole('button', {
      name: '打鍵トレーナー · さくさくタイピング',
      exact: true,
    })
    .click()
  await page.getByRole('button', { name: '入力へ進む', exact: true }).click()
  await expect(page.locator('[data-face="2"]')).toHaveCSS('transform', 'none')
  await page.getByRole('region', { name: /タイピング入力/ }).focus()
  await startPractice(page, true)
  await page.keyboard.type((await input(page))[0])
  await page.clock.fastForward(60050)
  await expect(page.getByText('TIME UP', { exact: true })).toBeVisible()
  await expect(page.locator('.notice')).toContainText('記録を保存できません')
  await page.getByRole('button', { name: '練習の記録', exact: true }).click()
  await page.getByRole('tab', { name: '全記録', exact: true }).click()
  await page.getByRole('button', { name: '詳細を見る', exact: true }).click()
  await expect(page.getByRole('region', { name: '打鍵の詳細' })).toContainText(
    '1打鍵（実ミス 0）',
  )
  const download = page.waitForEvent('download')
  await page.getByRole('button', { name: 'JSON 書出し', exact: true }).click()
  const file = await download
  const json = JSON.parse(await readFile((await file.path())!, 'utf8'))
  expect(Object.values(json.traces)).toHaveLength(1)
})
