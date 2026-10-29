import { test, expect } from '@playwright/test'
import { readFile } from 'node:fs/promises'

test('point leads summary, ranking and trends while KPM remains visible; pinky blue and ring pink match the legend', async ({
  page,
}) => {
  await page.addInitScript(() => {
    localStorage.setItem(
      'yohaku.settings.v1',
      JSON.stringify({ background: false }),
    )
    const base = {
      passageId: 'points-demo',
      title: 'point比較',
      layout: 'jis',
      elapsed: 60000,
      misses: 0,
      accuracy: 100,
      mode: 'practice',
      scoreVersion: 3,
    }
    localStorage.setItem(
      'yohaku.history.v1',
      JSON.stringify([
        {
          ...base,
          id: 'accurate',
          date: '2026-10-29T02:00:00Z',
          keys: 400,
          kpm: 400,
          point: 400,
        },
        {
          ...base,
          id: 'fast',
          date: '2026-10-29T01:00:00Z',
          keys: 600,
          kpm: 600,
          misses: 600,
          missPenalty: 600,
          accuracy: 50,
          point: 9999,
          rank: '旧称号',
        },
      ]),
    )
  })
  await page.goto('/')
  await page.getByRole('button', { name: '入力へ進む', exact: true }).click()
  await expect(page.locator('[data-face="2"]')).toHaveCSS('transform', 'none')
  for (const [code, color] of [
    ['KeyA', '#6390ff'],
    ['Semicolon', '#6390ff'],
    ['KeyS', '#ed8ccf'],
    ['KeyL', '#ed8ccf'],
  ])
    expect(
      await page
        .locator(`.keyboard-key[data-code="${code}"]`)
        .evaluate((el) =>
          getComputedStyle(el).getPropertyValue('--finger').trim(),
        ),
    ).toBe(color)
  const legend = await page
    .locator('.keyboard-legend')
    .evaluate((el) =>
      [0, 1].map(
        (i) =>
          getComputedStyle(el.querySelector(`[data-tone="${i}"]`)!, '::before')
            .backgroundColor,
      ),
    )
  expect(legend).toEqual(['rgb(99, 144, 255)', 'rgb(237, 140, 207)'])
  await page.screenshot({
    path: 'artifacts/keyboard-blue-pink.png',
    fullPage: true,
    animations: 'disabled',
  })
  await page.getByRole('button', { name: '練習の記録', exact: true }).click()
  const metrics = page.locator('.history-metrics > div')
  await expect(metrics.nth(0).locator('strong')).toHaveText('400 pt')
  await expect(metrics.nth(0)).toContainText('400 KPM')
  await expect(metrics.nth(1).locator('strong')).toHaveText('150 pt')
  await expect(metrics.nth(1)).toContainText('600 KPM')
  await expect(metrics.nth(2).locator('strong')).toHaveText('275.0 pt')
  await expect(metrics.nth(2)).toContainText('500.0 KPM')
  await expect(metrics.nth(3).locator('strong')).toHaveText('+250 pt')
  await expect(metrics.nth(3)).toContainText('-200 KPM')
  await expect(page.getByLabel('記録の主指標')).toHaveValue('point')
  await expect(
    page.locator('.top-records li').first().locator('strong'),
  ).toHaveText('400 pt')
  await expect(page.locator('.top-records li').first()).toContainText('400 KPM')
  await expect(
    page.getByRole('img', { name: '直近30回のpointと5回移動平均' }),
  ).toBeVisible()
  await page.screenshot({
    path: 'artifacts/point-records-desktop.png',
    fullPage: true,
    animations: 'disabled',
  })
  await page.setViewportSize({ width: 390, height: 1000 })
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true)
  await page.screenshot({
    path: 'artifacts/point-records-mobile.png',
    fullPage: true,
    animations: 'disabled',
  })
  await page.getByLabel('記録の主指標').selectOption('kpm')
  await expect(
    page.locator('.top-records li').first().locator('strong'),
  ).toHaveText('600 KPM')
  await expect(page.locator('.top-records li').first()).toContainText('150 pt')
  await expect(
    page.getByRole('img', { name: '直近30回のKPMと5回移動平均' }),
  ).toBeVisible()
  await page.locator('.top-records li').first().getByRole('button').click()
  await expect(page.locator('.detail-point')).toHaveText('150 pt · 混沌のリス')
  await expect(page.getByRole('region', { name: '打鍵の詳細' })).toContainText(
    '600 KPM',
  )
})

test('live adjective uses raw misses and matches the saved record, detail and JSON', async ({
  page,
}) => {
  await page.clock.install()
  await page.goto('/')
  await page.getByLabel('3D 背景', { exact: true }).uncheck()
  await page
    .getByRole('button', {
      name: '打鍵トレーナー準拠 · さくさくタイピング',
      exact: true,
    })
    .click()
  await page.getByRole('button', { name: '入力へ進む', exact: true }).click()
  await expect(page.locator('[data-face="2"]')).toHaveCSS('transform', 'none')
  await expect(page.locator('.point-panel > span')).toHaveText('カメ')
  await page.getByRole('region', { name: /タイピング入力/ }).focus()
  await page.keyboard.type(
    (await page.locator('.roman-current').textContent())!,
  )
  await expect(page.locator('.point-panel > span')).toContainText(
    '星々に祝福されし',
  )
  const next = (await page.locator('.roman-current').textContent())!
  await page.keyboard.type(next === 'z' ? 'qqq' : 'zzz')
  await expect(page.locator('.point-panel > span')).toContainText('混沌の')
  await expect(page.locator('.point-panel')).toContainText('実ミス率 75%')
  await page.setViewportSize({ width: 390, height: 1000 })
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true)
  await page.clock.fastForward(60050)
  await expect(page.getByText('TIME UP', { exact: true })).toBeVisible()
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          JSON.parse(localStorage.getItem('yohaku.history.v1') ?? '[]').length,
      ),
    )
    .toBe(1)
  const r = await page.evaluate(
    () => JSON.parse(localStorage.getItem('yohaku.history.v1')!)[0],
  )
  expect(r).toMatchObject({ rank: '混沌のカメ', rawMisses: 3, actualKeys: 1 })
  await page.getByRole('button', { name: '練習の記録', exact: true }).click()
  await page.getByRole('button', { name: '詳細を見る', exact: true }).click()
  await expect(page.locator('.detail-point')).toHaveText('0 pt · 混沌のカメ')
  await expect(page.getByRole('region', { name: '打鍵の詳細' })).toContainText(
    '実ミス率 75%',
  )
  const download = page.waitForEvent('download')
  await page.getByRole('button', { name: 'JSON 書出し', exact: true }).click()
  const file = await download
  const exported = JSON.parse(await readFile((await file.path())!, 'utf8'))
  expect(exported.records[0].rank).toBe('混沌のカメ')
})
