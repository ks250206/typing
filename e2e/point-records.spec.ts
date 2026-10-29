import { test, expect } from '@playwright/test'

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
  await expect(page.locator('.detail-point')).toHaveText('150 pt · リス')
  await expect(page.getByRole('region', { name: '打鍵の詳細' })).toContainText(
    '600 KPM',
  )
})
