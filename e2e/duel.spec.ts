import { test, expect } from '@playwright/test'
const enter = async (page: import('@playwright/test').Page) => {
  await page.goto('/')
  await page.getByLabel('3D 背景', { exact: true }).uncheck()
  await page.getByRole('button', { name: 'CPU対戦', exact: true }).click()
}
const input = async (page: import('@playwright/test').Page) =>
  ((await page.locator('.roman-current').textContent()) ?? '') +
  ((await page.locator('.remaining-roman').textContent()) ?? '')

test('mission frame stays fixed across faces, and every typing line scrolls horizontally', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1100 })
  await page.goto('/')
  await page.getByLabel('3D 背景', { exact: true }).uncheck()
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 1100 })
    const heights = []
    for (const name of ['文章選択へ', '全文確認へ', '入力へ進む']) {
      await page.getByRole('button', { name, exact: true }).click()
      await expect(page.locator('.mission-face.is-active')).toHaveCSS(
        'transform',
        'none',
      )
      heights.push(
        await page
          .locator('.practice-main')
          .evaluate((el) => el.getBoundingClientRect().height),
      )
    }
    expect(new Set(heights).size).toBe(1)
    for (const selector of [
      '.current-paragraph',
      '.kana-line',
      '.roman-line',
      '.upcoming',
    ])
      await expect(page.locator(selector)).toHaveCSS('white-space', 'nowrap')
    const gap = await page
      .locator('.sentence-guides')
      .evaluate(
        (el) =>
          el.querySelector('.roman-line')!.getBoundingClientRect().top -
          el.querySelector('.kana-line')!.getBoundingClientRect().bottom,
      )
    expect(gap).toBeLessThanOrEqual(2)
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true)
  }
  const area = page.getByRole('region')
  await area.focus()
  const hint = await input(page)
  await page.keyboard.type(hint.slice(0, -1))
  await expect
    .poll(() =>
      page
        .locator('.roman-line .flow-track')
        .evaluate(
          (el) => new DOMMatrixReadOnly(getComputedStyle(el).transform).m41,
        ),
    )
    .toBeLessThan(0)
  await expect(page.locator('.roman-line .flow-track')).toHaveCSS(
    'transition-property',
    'transform',
  )
  await page.screenshot({
    path: 'artifacts/smooth-flow-mobile.png',
    fullPage: true,
  })
  await page.getByRole('button', { name: 'やり直す', exact: true }).click()
  await page.getByRole('region').focus()
  await page.keyboard.type('zzzz')
  await expect(page.locator('.miss-stat > strong').first()).toHaveText('1')
  await expect(page.locator('.miss-stat')).toContainText('実ミス 4 打鍵')
  await page.keyboard.type('hz')
  await expect(page.locator('.miss-stat > strong').first()).toHaveText('2')
})

test('CPU presets include reaction; paused time never advances the opponent; CPU wins BO7 and is recorded', async ({
  page,
}) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  await page.clock.install()
  await enter(page)
  await page
    .getByLabel('CPUプリセット', { exact: true })
    .selectOption({ label: 'ウサギ / 上級' })
  await expect(page.getByLabel('CPU速度 (KPM)', { exact: true })).toHaveValue(
    '500',
  )
  await expect(
    page.getByLabel('CPU反応時間 (ms)', { exact: true }),
  ).toHaveValue('240')
  await expect(page.getByLabel('CPUの打ち方', { exact: true })).toHaveValue(
    'ease-in',
  )
  await page.getByLabel('CPU速度 (KPM)', { exact: true }).fill('1800')
  await page.getByLabel('CPU反応時間 (ms)', { exact: true }).fill('1000')
  await page.getByLabel('CPUの打ち方', { exact: true }).selectOption('constant')
  await page.getByRole('button', { name: 'CPUと対戦する', exact: true }).click()
  await expect(page.locator('.battle-countdown')).toBeVisible()
  await expect(page.locator('.next-sentence')).toHaveCount(0)
  await page.clock.fastForward(3100)
  await expect(page.locator('.cpu-progress')).toContainText('反応待ち')
  await page.clock.fastForward(400)
  await expect(page.locator('.cpu-progress')).toContainText('CPU · 0/')
  await page.clock.fastForward(700)
  expect(
    await page
      .locator('.cpu-progress > div i')
      .evaluate((el) => parseFloat((el as HTMLElement).style.width)),
  ).toBeGreaterThan(0)
  await page.screenshot({ path: 'artifacts/cpu-active.png', fullPage: true })
  await page.getByRole('region').focus()
  await page.keyboard.press('Escape')
  const before = await page
    .locator('.cpu-progress > div i')
    .getAttribute('style')
  await page.clock.fastForward(60000)
  await expect(page.locator('.cpu-progress > div i')).toHaveAttribute(
    'style',
    before!,
  )
  await page.setViewportSize({ width: 390, height: 844 })
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true)
  await page.screenshot({ path: 'artifacts/cpu-mobile.png', fullPage: true })
  await page.setViewportSize({ width: 1280, height: 1000 })
  await page.getByRole('button', { name: '対戦を再開する' }).click()
  for (let round = 0; round < 4; round++) {
    await page.clock.fastForward(180000)
    if (round < 3) {
      await expect(page.locator('[data-testid=cpu-rounds]')).toHaveText(
        String(round + 1),
      )
      await page.getByRole('button', { name: '次のラウンド' }).click()
    }
  }
  await expect(page.getByText('CPU WINS / 敗北')).toBeVisible()
  await expect(page.locator('[data-testid=cpu-rounds]')).toHaveText('4')
  await page.screenshot({ path: 'artifacts/cpu-result.png', fullPage: true })
  await page.getByRole('button', { name: '練習の記録', exact: true }).click()
  await expect(page.locator('tbody tr')).toHaveCount(1)
  await expect(page.locator('tbody')).toContainText('CPU対戦 0–4')
  await page.getByRole('button', { name: 'CPU対戦', exact: true }).click()
  await expect(
    page.getByLabel('CPU反応時間 (ms)', { exact: true }),
  ).toHaveValue('1000')
  expect(errors).toEqual([])
})

test('human can win four RTC rounds; no next sentence is exposed and only one result is saved', async ({
  page,
}) => {
  await page.clock.install()
  await enter(page)
  await page.getByLabel('CPU速度 (KPM)', { exact: true }).fill('60')
  await page.getByLabel('CPU反応時間 (ms)', { exact: true }).fill('1500')
  await page.getByRole('button', { name: 'CPUと対戦する', exact: true }).click()
  for (let round = 0; round < 4; round++) {
    await page.clock.fastForward(3100)
    await page.getByRole('region').focus()
    for (let word = 0; word < 10; word++) {
      await expect(page.locator('.battle-countdown')).toHaveCount(0)
      await expect(page.locator('.next-sentence')).toHaveCount(0)
      await page.keyboard.type(await input(page))
      await expect(page.locator('[data-testid=player-points]')).toHaveText(
        String(word + 1),
      )
      if (word < 9) await page.clock.fastForward(700)
    }
    if (round < 3)
      await page.getByRole('button', { name: '次のラウンド' }).click()
  }
  await expect(page.getByText('VICTORY / 勝利')).toBeVisible()
  await expect(page.locator('[data-testid=player-rounds]')).toHaveText('4')
  await page.clock.fastForward(60000)
  await page.getByRole('button', { name: '練習の記録', exact: true }).click()
  await expect(page.locator('tbody tr')).toHaveCount(1)
  await expect(page.locator('tbody')).toContainText('CPU対戦 4–0')
})
