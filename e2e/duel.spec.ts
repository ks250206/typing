import { choose as pick } from './select'
import { seededBattlePrompts } from '../src/battleSets'
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
  await pick(page.getByLabel('CPUプリセット', { exact: true }), {
    label: 'ウサギ',
  })
  await expect(page.getByLabel('CPU速度 (KPM)', { exact: true })).toHaveValue(
    '535',
  )
  await expect(
    page.getByLabel('CPU反応時間 (ms)', { exact: true }),
  ).toHaveValue('185')
  await expect(page.getByLabel('CPUの打ち方', { exact: true })).toHaveAttribute(
    'data-value',
    'ease-in',
  )
  await page.getByLabel('CPU速度 (KPM)', { exact: true }).fill('1800')
  await page.getByLabel('CPU反応時間 (ms)', { exact: true }).fill('1000')
  await pick(page.getByLabel('CPUの打ち方', { exact: true }), 'constant')
  await page.getByRole('button', { name: 'CPUと対戦する', exact: true }).click()
  await expect(page.locator('.battle-countdown')).toBeVisible()
  await expect(page.locator('.next-sentence')).toHaveCount(0)
  await page.clock.fastForward(3100)
  await expect(page.locator('.cpu-progress')).toHaveCount(0)
  await expect(page.locator('.opponent-typed')).toHaveText('')
  await page.clock.fastForward(400)
  await expect(page.locator('.opponent-typed')).toHaveText('')
  await page.clock.fastForward(700)
  await expect(page.getByLabel('CPUのローマ字入力')).toBeVisible()
  expect(
    (await page.locator('.opponent-typed').textContent())!.length,
  ).toBeGreaterThan(0)
  await page.screenshot({ path: 'artifacts/cpu-active.png', fullPage: true })
  await page.getByRole('region').focus()
  await page.keyboard.press('Escape')
  const opponentBefore = await page.locator('.opponent-typed').textContent()
  await page.clock.fastForward(60000)
  await expect(page.locator('.opponent-typed')).toHaveText(opponentBefore!)
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
  await expect(page.locator('.cpu-results')).toHaveAttribute(
    'data-result',
    'defeat',
  )
  await expect(page.locator('.round-reports details')).toHaveCount(4)
  await expect(page.locator('[data-testid=cpu-rounds]')).toHaveText('4')
  await page.screenshot({ path: 'artifacts/cpu-result.png', fullPage: true })
  await page.getByRole('button', { name: '練習の記録', exact: true }).click()
  await expect(page.locator('tbody tr')).toHaveCount(1)
  await expect(page.locator('tbody')).toContainText('RTCオリジナル 0–4')
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
  await expect(page.locator('.cpu-results')).toHaveAttribute(
    'data-result',
    'victory',
  )
  await expect(page.locator('.round-reports details')).toHaveCount(4)
  await page.screenshot({
    path: 'artifacts/cpu-victory-result.png',
    fullPage: true,
    animations: 'disabled',
  })
  await expect(page.locator('[data-testid=player-rounds]')).toHaveText('4')
  await page.clock.fastForward(60000)
  await page.getByRole('button', { name: '練習の記録', exact: true }).click()
  await expect(page.locator('tbody tr')).toHaveCount(1)
  await expect(page.locator('tbody')).toContainText('RTCオリジナル 4–0')
})

test('duel roman rows use the same glyph columns, word gaps and shared scrolling with alternate spellings', async ({
  page,
}) => {
  await page.clock.install()
  await page.addInitScript(() => {
    Math.random = () => 0
    localStorage.setItem(
      'yohaku.settings.v1',
      JSON.stringify({
        layout: 'jis',
        background: false,
        guide: true,
        wordColors: true,
        consumeTyped: true,
      }),
    )
  })
  await enter(page)
  await page.getByLabel('CPU速度 (KPM)', { exact: true }).fill('60')
  await page.getByLabel('CPU反応時間 (ms)', { exact: true }).fill('1500')
  await pick(page.getByLabel('CPUの打ち方', { exact: true }), 'constant')
  const seed = Array.from({ length: 2000 }, (_, i) => String(i)).find((s) =>
    seededBattlePrompts('cpu-rtc', s)[0].reading.startsWith('ほし'),
  )!
  await page.getByLabel('対戦シードを固定する', { exact: true }).check()
  await page.getByLabel('対戦シード', { exact: true }).fill(seed)
  await page.getByRole('button', { name: 'CPUと対戦する', exact: true }).click()
  await page.clock.fastForward(3100)
  const aligned = async () => {
    const result = await page.locator('.duel-roman').evaluate((el) => {
      const player = el.querySelector('.duel-row-player')!
      const cpu = el.querySelector('.duel-row-cpu')!
      const top = [...player.querySelectorAll<HTMLElement>('[data-column]')]
      const bottom = [...cpu.querySelectorAll<HTMLElement>('[data-column]')]
      return {
        sameText: player.textContent === cpu.textContent,
        sameColumns:
          top.length === bottom.length &&
          top.every(
            (cell, i) =>
              Math.abs(
                cell.getBoundingClientRect().x -
                  bottom[i].getBoundingClientRect().x,
              ) < 0.05 &&
              Math.abs(
                cell.getBoundingClientRect().width -
                  bottom[i].getBoundingClientRect().width,
              ) < 0.05,
          ),
        gaps: top
          .filter((cell) => cell.classList.contains('word-start'))
          .every(
            (cell) => parseFloat(getComputedStyle(cell).marginInlineStart) > 0,
          ),
        colors: new Set(
          [
            ...el.querySelectorAll(
              '.remaining-roman .duel-cell, .opponent-remaining .duel-cell',
            ),
          ].map((cell) => getComputedStyle(cell).color),
        ).size,
        tracks: el.querySelectorAll('.flow-track').length,
      }
    })
    expect(result).toEqual({
      sameText: true,
      sameColumns: true,
      gaps: true,
      colors: 1,
      tracks: 1,
    })
  }
  await aligned()
  await expect(page.getByLabel('入力の先行状況')).toHaveText('同じ位置')
  const area = page.getByRole('region')
  await area.focus()
  await page.keyboard.type('hosi')
  await expect(page.locator('.duel-row-player')).toContainText('hosi')
  await expect(page.getByLabel('入力の先行状況')).toHaveText('YOU が先行')
  await aligned()
  await page.clock.runFor(7600)
  await expect(page.getByLabel('入力の先行状況')).toHaveText('CPU が先行')
  await aligned()
  await page.screenshot({
    path: 'artifacts/duel-aligned-desktop.png',
    fullPage: true,
    animations: 'disabled',
  })
  await area.focus()
  await page.keyboard.press('Escape')
  const before = await page.locator('.opponent-typed').textContent()
  await page.clock.fastForward(30000)
  await expect(page.locator('.opponent-typed')).toHaveText(before!)
  await page.setViewportSize({ width: 390, height: 1000 })
  await aligned()
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true)
  await page.screenshot({
    path: 'artifacts/duel-aligned-mobile.png',
    fullPage: true,
    animations: 'disabled',
  })
  await page.getByRole('button', { name: '対戦を再開する' }).click()
  await page.clock.runFor(50)
  await area.focus()
  await page.keyboard.type(await input(page))
  await expect(page.locator('[data-testid=player-points]')).toHaveText('1')
  await page.clock.fastForward(700)
  await aligned()
  await expect(page.getByLabel('入力の先行状況')).toHaveText('同じ位置')
})
