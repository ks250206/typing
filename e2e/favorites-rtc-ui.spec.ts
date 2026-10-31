import { expect, test, type Page } from '@playwright/test'
import { choose } from './select'
import { rtcOriginalDocument } from '../src/domain/content/rtcOriginal'
import { seededBattlePrompts } from '../src/domain/content/battleSets'

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem(
      'yohaku.settings.v1',
      JSON.stringify({ background: false, navigationMotion: 'off' }),
    )
  })
})
async function favoriteMenu(page: Page) {
  const button = page.getByRole('button', {
    name: 'お気に入りを表示',
    exact: true,
  })
  if (
    (await button.isVisible()) &&
    (await button.getAttribute('aria-expanded')) === 'false'
  )
    await button.click()
  return page.getByRole('group', { name: 'お気に入り', exact: true })
}
const saved = (page: Page) =>
  page.evaluate(() =>
    JSON.parse(localStorage.getItem('galactype.favorites.v1') ?? '[]'),
  )
const previewText = (page: Page) =>
  page
    .locator('#passage-full-text li p')
    .evaluateAll((nodes) =>
      nodes.map((node) =>
        [...node.querySelectorAll('.token-text')]
          .map((part) => part.textContent)
          .join(''),
      ),
    )

for (const width of [1440, 390]) {
  test(`practice and CPU favorites restore settings with fresh unfixed seeds at ${width}px`, async ({
    page,
  }) => {
    const errors: string[] = []
    page.on('pageerror', (error) => errors.push(error.message))
    await page.setViewportSize({ width, height: 900 })
    await page.goto('/')
    await page
      .getByRole('button', { name: 'RTCオリジナル', exact: true })
      .click()
    await choose(
      page.getByRole('combobox', { name: '入力方式', exact: true }),
      'colemak',
    )
    await page.getByLabel('シードを固定する', { exact: true }).check()
    await page
      .getByLabel('出題シード', { exact: true })
      .fill('must-not-be-saved')
    await page
      .getByRole('button', { name: 'このシードを使う', exact: true })
      .click()
    await page
      .getByRole('button', { name: 'お気に入りに登録', exact: true })
      .click()
    await expect(
      page.getByRole('button', { name: 'お気に入りを解除', exact: true }),
    ).toHaveAttribute('aria-pressed', 'true')
    expect(await saved(page)).toEqual([
      { kind: 'practice', passageId: 'cpu-rtc', layout: 'colemak' },
    ])
    await page.getByRole('button', { name: 'CPU対戦', exact: true }).click()
    await choose(
      page.getByRole('combobox', { name: '対戦の文章セット', exact: true }),
      'cpu-rtc',
    )
    await choose(
      page.getByRole('combobox', { name: '対戦の入力方式', exact: true }),
      'kana',
    )
    await page.getByLabel('CPU速度 (KPM)', { exact: true }).fill('432')
    await page.getByLabel('CPU反応時間 (ms)', { exact: true }).fill('275')
    await choose(page.getByLabel('CPUの打ち方', { exact: true }), 'constant')
    await page.getByLabel('対戦シードを固定する', { exact: true }).check()
    await page.getByLabel('対戦シード', { exact: true }).fill('also-not-saved')
    await page
      .getByRole('button', { name: 'お気に入りに登録', exact: true })
      .click()
    expect(await saved(page)).toHaveLength(2)
    expect(JSON.stringify(await saved(page))).not.toContain('seed')
    await page.reload()
    let menu = await favoriteMenu(page)
    await expect(menu.locator('li')).toHaveCount(2)
    await menu
      .getByRole('button', {
        name: /お気に入りを開く：タイピング · RTCオリジナル/,
      })
      .click()
    await expect(page.locator('.mission-carousel')).toHaveAttribute(
      'data-stage',
      '1',
    )
    await expect(
      page.getByLabel('シードを固定する', { exact: true }),
    ).not.toBeChecked()
    await expect(
      page.getByRole('combobox', { name: '入力方式', exact: true }),
    ).toHaveAttribute('data-value', 'colemak')
    await expect(
      page.getByRole('button', { name: '全文確認へ', exact: true }),
    ).toHaveAttribute('aria-current', 'step')
    await expect(page.locator('#passage-full-text li')).toHaveCount(15)
    const firstSeed = await page
      .getByLabel('出題シード', { exact: true })
      .inputValue()
    expect(firstSeed).not.toBe('must-not-be-saved')
    menu = await favoriteMenu(page)
    await menu
      .getByRole('button', {
        name: /お気に入りを開く：タイピング · RTCオリジナル/,
      })
      .click()
    expect(
      await page.getByLabel('出題シード', { exact: true }).inputValue(),
    ).not.toBe(firstSeed)
    menu = await favoriteMenu(page)
    await menu
      .getByRole('button', {
        name: /お気に入りを開く：CPU対戦 · RTCオリジナル/,
      })
      .click()
    await expect(page.getByLabel('CPU速度 (KPM)', { exact: true })).toHaveValue(
      '432',
    )
    await expect(
      page.getByLabel('CPU反応時間 (ms)', { exact: true }),
    ).toHaveValue('275')
    await expect(
      page.getByLabel('CPUの打ち方', { exact: true }),
    ).toHaveAttribute('data-value', 'constant')
    await expect(
      page.getByLabel('対戦の入力方式', { exact: true }),
    ).toHaveAttribute('data-value', 'kana')
    await expect(
      page.getByLabel('対戦シードを固定する', { exact: true }),
    ).not.toBeChecked()
    const cpuSeed = await page
      .getByLabel('対戦シード', { exact: true })
      .inputValue()
    expect(cpuSeed).not.toBe('also-not-saved')
    // Re-open while the CPU page is mounted: apply the favorite, not stale state.
    await page.getByLabel('CPU速度 (KPM)', { exact: true }).fill('900')
    menu = await favoriteMenu(page)
    await menu
      .getByRole('button', {
        name: /お気に入りを開く：CPU対戦 · RTCオリジナル/,
      })
      .click()
    await expect(page.getByLabel('CPU速度 (KPM)', { exact: true })).toHaveValue(
      '432',
    )
    expect(
      await page.getByLabel('対戦シード', { exact: true }).inputValue(),
    ).not.toBe(cpuSeed)
    menu = await favoriteMenu(page)
    await page.screenshot({
      path: `artifacts/favorites-${width}.png`,
      fullPage: true,
    })
    await menu
      .getByRole('button', { name: /お気に入りから削除：CPU対戦/ })
      .click()
    await expect(menu.locator('li')).toHaveCount(1)
    expect(await saved(page)).toHaveLength(1)
    if (width === 390) {
      await page.keyboard.press('Escape')
      await expect(
        page.getByRole('button', { name: 'お気に入りを表示', exact: true }),
      ).toHaveAttribute('aria-expanded', 'false')
    }
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true)
    expect(errors).toEqual([])
  })
}

test('RTC original completes 15 seeded prompts in solo practice, saves and reopens the same seed', async ({
  page,
}) => {
  await page.clock.install()
  await page.goto('/')
  await page.getByRole('button', { name: 'RTCオリジナル', exact: true }).click()
  await page.getByLabel('シードを固定する', { exact: true }).check()
  await page.getByLabel('出題シード', { exact: true }).fill('original-solo')
  await page
    .getByRole('button', { name: 'このシードを使う', exact: true })
    .click()
  await page.getByRole('button', { name: '全文確認へ', exact: true }).click()
  const expected = rtcOriginalDocument('original-solo').sentences.map(
    (s) => s.text,
  )
  expect(await previewText(page)).toEqual(expected)
  await page.getByRole('button', { name: '入力へ進む', exact: true }).click()
  await page.getByRole('region', { name: /タイピング入力領域/ }).focus()
  await page.keyboard.press('Space')
  await page.clock.runFor(3000)
  for (let i = 0; i < 15; i++) {
    await expect(page.locator('.current-paragraph')).toHaveAttribute(
      'data-text',
      expected[i],
    )
    await page.keyboard.type(
      (await page.locator('.roman-current').textContent())! +
        (await page.locator('.remaining-roman').textContent())!,
    )
  }
  await expect(
    page.getByText('SESSION COMPLETE', { exact: true }),
  ).toBeVisible()
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          JSON.parse(localStorage.getItem('yohaku.history.v1') ?? '[]').length,
      ),
    )
    .toBe(1)
  const record = await page.evaluate(
    () => JSON.parse(localStorage.getItem('yohaku.history.v1')!)[0],
  )
  expect(record).toMatchObject({
    passageId: 'cpu-rtc',
    seed: 'original-solo',
    replayVersion: 1,
    mode: 'practice',
  })
  await page.getByRole('button', { name: '練習の記録', exact: true }).click()
  await page.getByRole('tab', { name: '全記録', exact: true }).click()
  await page
    .getByRole('button', { name: /シード original-solo を再現/ })
    .click()
  await page.getByRole('button', { name: '全文確認へ', exact: true }).click()
  expect(await previewText(page)).toEqual(expected)
})

test('favorites keyboard activation takes priority over paused game shortcuts; storage failures keep an in-memory favorite', async ({
  page,
}) => {
  await page.clock.install()
  await page.goto('/')
  await page
    .getByRole('button', { name: 'お気に入りに登録', exact: true })
    .click()
  await page.getByRole('button', { name: '入力へ進む', exact: true }).click()
  await page.getByRole('region', { name: /タイピング入力領域/ }).focus()
  await page.keyboard.press('Space')
  await page.clock.runFor(3000)
  await page.keyboard.press('Escape')
  await page
    .getByRole('button', { name: /お気に入りを開く：タイピング/ })
    .focus()
  await page.keyboard.press('Enter')
  await expect(page.locator('.mission-carousel')).toHaveAttribute(
    'data-stage',
    '1',
  )
  await page
    .getByRole('button', { name: 'お気に入りを解除', exact: true })
    .click()
  await page.evaluate(() => {
    Storage.prototype.setItem = () => {
      throw new Error('blocked')
    }
  })
  await page
    .getByRole('button', { name: 'お気に入りに登録', exact: true })
    .click()
  await expect(page.getByRole('status')).toContainText(
    'お気に入りを保存できません',
  )
  await expect(
    page.getByRole('button', { name: /お気に入りを開く：タイピング/ }),
  ).toBeVisible()
})

test('compact CPU scores and guide fit standard desktop viewports and retain key feedback', async ({
  page,
}) => {
  await page.clock.install()
  await page.setViewportSize({ width: 1366, height: 768 })
  await page.goto('/')
  await page.getByRole('button', { name: 'CPU対戦', exact: true }).click()
  await choose(page.getByLabel('CPUプリセット', { exact: true }), 'カメ')
  await page.getByRole('button', { name: 'CPUと対戦する', exact: true }).click()
  await page.clock.runFor(3100)
  for (const size of [
    { width: 1366, height: 768 },
    { width: 1440, height: 900 },
    { width: 1280, height: 800 },
  ]) {
    await page.setViewportSize(size)
    await page.evaluate(() => window.scrollTo(0, 0))
    await page.screenshot({
      path: `artifacts/cpu-compact-${size.width}.png`,
      fullPage: false,
    })
    const keyboard = await page.locator('.keyboard-guide').boundingBox()
    expect(keyboard!.y).toBeGreaterThanOrEqual(0)
    expect(keyboard!.y + keyboard!.height).toBeLessThanOrEqual(size.height)
  }
  await expect(page.getByText('YOUR OWN PACE', { exact: true })).toHaveCount(0)
  await expect(page.locator('.keyboard-guide figcaption')).toHaveCount(0)
  await expect(
    page.getByText('光るキーが次の一打', { exact: true }),
  ).toHaveCount(0)
  await expect(
    page.locator('.keyboard-guide [data-state=next]'),
  ).not.toHaveCount(0)
  await page.getByRole('region', { name: 'CPU対戦の入力領域' }).focus()
  await page.keyboard.press('Semicolon')
  await expect(page.locator('[data-code=Semicolon]')).toHaveAttribute(
    'data-error',
    'true',
  )
  await page.setViewportSize({ width: 390, height: 844 })
  await page.screenshot({
    path: 'artifacts/cpu-compact-mobile.png',
    fullPage: true,
  })
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true)
})

test('old RTC CPU records keep the 20-prompt order; resetting starts the expanded version', async ({
  page,
}) => {
  await page.clock.install()
  await page.addInitScript(() =>
    localStorage.setItem(
      'yohaku.history.v1',
      JSON.stringify([
        {
          id: 'legacy-cpu',
          title: '旧RTC対戦',
          passageId: 'cpu-rtc',
          layout: 'jis',
          mode: 'cpu',
          date: new Date().toISOString(),
          elapsed: 10000,
          keys: 100,
          misses: 0,
          kpm: 600,
          accuracy: 100,
          seed: 'old-cpu-seed',
          replayVersion: 1,
          cpuConfig: { kpm: 385, reactionMs: 205, curve: 'ease-in' },
        },
      ]),
    ),
  )
  await page.goto('/')
  await page.getByRole('button', { name: '練習の記録', exact: true }).click()
  await page.getByRole('tab', { name: '全記録', exact: true }).click()
  await page
    .getByRole('button', { name: /対戦シード old-cpu-seed を再現/ })
    .click()
  await expect(
    page.getByLabel('対戦シードを固定する', { exact: true }),
  ).toBeChecked()
  await page.getByRole('button', { name: 'CPUと対戦する', exact: true }).click()
  await page.clock.runFor(3100)
  await expect(page.locator('.current-paragraph')).toHaveAttribute(
    'data-text',
    seededBattlePrompts('cpu-rtc', 'old-cpu-seed', 1)[0].text,
  )
  await expect(page.locator('.battle-seed-info')).toContainText('RTC v1')
  await page
    .getByRole('button', { name: '対戦をリセット', exact: true })
    .click()
  await page.getByRole('button', { name: 'CPUと対戦する', exact: true }).click()
  await page.clock.runFor(3100)
  await expect(page.locator('.current-paragraph')).toHaveAttribute(
    'data-text',
    seededBattlePrompts('cpu-rtc', 'old-cpu-seed', 2)[0].text,
  )
  await expect(page.locator('.battle-seed-info')).toContainText('RTC v2')
})

test('selecting a CPU favorite during play cancels the match and applies the other configuration', async ({
  page,
}) => {
  await page.clock.install()
  await page.addInitScript(() =>
    localStorage.setItem(
      'galactype.favorites.v1',
      JSON.stringify([
        {
          kind: 'cpu',
          passageId: 'cpu-rtc',
          layout: 'jis',
          cpuConfig: { kpm: 100, reactionMs: 200, curve: 'constant' },
        },
        {
          kind: 'cpu',
          passageId: 'cpu-rtc',
          layout: 'kana',
          cpuConfig: { kpm: 900, reactionMs: 300, curve: 'ease-in' },
        },
      ]),
    ),
  )
  await page.goto('/')
  await page
    .getByRole('button', { name: /お気に入りを開く：CPU対戦.*100 KPM/ })
    .click()
  await page.getByRole('button', { name: 'CPUと対戦する', exact: true }).click()
  await page.clock.runFor(3100)
  const favorite = page.getByRole('button', {
    name: /お気に入りを開く：CPU対戦.*900 KPM/,
  })
  await favorite.focus()
  await page.keyboard.press('Space')
  await expect(page.getByLabel('CPU速度 (KPM)', { exact: true })).toHaveValue(
    '900',
  )
  await expect(
    page.getByLabel('対戦の入力方式', { exact: true }),
  ).toHaveAttribute('data-value', 'kana')
  await expect(
    page.getByLabel('対戦シードを固定する', { exact: true }),
  ).not.toBeChecked()
  await page.clock.fastForward(180000)
  expect(
    await page.evaluate(() =>
      JSON.parse(localStorage.getItem('yohaku.history.v1') ?? '[]'),
    ),
  ).toEqual([])
})
