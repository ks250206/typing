import { test, expect, type Page } from '@playwright/test'
import { choose } from './select'

const arena = (page: Page) =>
  page.getByRole('region', { name: /タイピング入力領域/ })
const stage = (page: Page) => page.locator('.mission-carousel')
const keys = (page: Page) => page.locator('.miss-stat strong').nth(1)
const misses = (page: Page) => page.locator('.miss-stat strong').first()
const ready = (page: Page) =>
  page.locator('.practice-overlay[data-phase=ready]')
const paused = (page: Page) =>
  page.locator('.practice-overlay[data-phase=paused]')
const records = (page: Page) =>
  page.evaluate(() =>
    JSON.parse(localStorage.getItem('yohaku.history.v1') ?? '[]'),
  )
const errors = new WeakMap<Page, string[]>()

test.beforeEach(async ({ page }) => {
  const messages: string[] = []
  errors.set(page, messages)
  page.on('pageerror', (error) => messages.push(error.message))
  await page.clock.install()
  await page.addInitScript(() => {
    localStorage.setItem(
      'yohaku.settings.v1',
      JSON.stringify({
        background: false,
        navigationMotion: 'off',
      }),
    )
  })
  await page.goto('/')
  await page.clock.pauseAt(
    new Date(await page.evaluate(() => Date.now() + 10000)),
  )
})
test.afterEach(async ({ page }) => {
  expect(errors.get(page)).toEqual([])
})

async function enter(page: Page) {
  await page.getByRole('button', { name: '入力へ進む', exact: true }).click()
  await arena(page).focus()
}
async function start(page: Page) {
  await enter(page)
  await page.keyboard.press('Space')
  await page.clock.runFor(3000)
  await expect(page.getByText('IN THE FLOW', { exact: true })).toBeVisible()
}
async function typeOne(page: Page) {
  await page.keyboard.type(
    (await page.locator('.roman-current').textContent())!,
  )
}
async function finishTimed(page: Page) {
  await page
    .getByRole('button', {
      name: '打鍵トレーナー · さくさくタイピング',
      exact: true,
    })
    .click()
  await start(page)
  await typeOne(page)
  await page.clock.runFor(60000)
  await expect(stage(page)).toHaveAttribute('data-stage', '3')
  await expect.poll(() => records(page)).toHaveLength(1)
}
async function startCpu(page: Page) {
  await page.getByRole('button', { name: 'CPU対戦', exact: true }).click()
  await page.getByLabel('CPU速度 (KPM)', { exact: true }).fill('1800')
  await page.getByLabel('CPU反応時間 (ms)', { exact: true }).fill('100')
  await choose(page.getByLabel('CPUの打ち方', { exact: true }), 'constant')
  await page.getByLabel('対戦シードを固定する', { exact: true }).check()
  await page.getByLabel('対戦シード', { exact: true }).fill('shortcut-test')
  await page.getByRole('button', { name: 'CPUと対戦する', exact: true }).click()
  // Run the scheduled focus before advancing a large interval.
  await page.clock.runFor(20)
}

test('number keys navigate only outside typing/forms, without modifiers or IME; result needs a record', async ({
  page,
}) => {
  await page.keyboard.press('4')
  await expect(stage(page)).toHaveAttribute('data-stage', '0')
  for (const key of ['Control+2', 'Meta+2', 'Alt+2', 'Shift+2']) {
    await page.keyboard.press(key)
    await expect(stage(page)).toHaveAttribute('data-stage', '0')
  }
  await page.evaluate(() =>
    document.body.dispatchEvent(
      new KeyboardEvent('keydown', {
        key: '2',
        code: 'Digit2',
        bubbles: true,
        isComposing: true,
      }),
    ),
  )
  await expect(stage(page)).toHaveAttribute('data-stage', '0')
  const search = page.getByPlaceholder('タイトル・ジャンルで検索')
  await search.fill('1234')
  await expect(search).toHaveValue('1234')
  await expect(stage(page)).toHaveAttribute('data-stage', '0')
  await search.fill('')
  const layout = page.getByRole('combobox', { name: '入力方式', exact: true })
  await layout.focus()
  await page.keyboard.press('2')
  await expect(layout).toHaveAttribute('aria-expanded', 'true')
  await expect(stage(page)).toHaveAttribute('data-stage', '0')
  await page.keyboard.press('Escape')
  await page.locator('.section-heading').click()
  await page.keyboard.press('2')
  await expect(stage(page)).toHaveAttribute('data-stage', '1')
  await page.keyboard.press('1')
  await expect(stage(page)).toHaveAttribute('data-stage', '0')
  await page.keyboard.press('3')
  await page.clock.runFor(20)
  await expect(stage(page)).toHaveAttribute('data-stage', '2')
  await expect(arena(page)).toBeFocused()
  await page.keyboard.type('124')
  await expect(stage(page)).toHaveAttribute('data-stage', '2')
  await expect(keys(page)).toHaveText('0')
  await expect(misses(page)).toHaveText('0')
  await page.keyboard.press('Space')
  await page.clock.runFor(3000)
  await page.keyboard.type('124')
  await expect(stage(page)).toHaveAttribute('data-stage', '2')
  // Losing focus pauses a live game; number keys must still not navigate.
  await page.locator('.section-heading').click()
  await page.keyboard.press('1')
  await expect(stage(page)).toHaveAttribute('data-stage', '2')
})

test('editable elements and settings dialogs keep their keys', async ({
  page,
}) => {
  for (const tag of ['textarea', 'div']) {
    await page.evaluate((tag) => {
      const element = document.createElement(tag)
      element.id = 'editable-shortcut-test'
      if (tag === 'div') element.contentEditable = 'true'
      document.body.append(element)
      element.focus()
    }, tag)
    await page.keyboard.type('1234r')
    await expect(stage(page)).toHaveAttribute('data-stage', '0')
    await page
      .locator('#editable-shortcut-test')
      .evaluate((element) => element.remove())
  }
  await start(page)
  await typeOne(page)
  await page.getByRole('button', { name: '環境設定', exact: true }).click()
  // Focus the dialog itself so Space/Enter do not activate its Close button.
  await page.getByRole('dialog').evaluate((element) => {
    element.setAttribute('tabindex', '-1')
    ;(element as HTMLElement).focus()
  })
  for (const key of ['1', '2', '3', '4', 'r', 'Space', 'Enter']) {
    await page.keyboard.press(key)
    await expect(page.getByRole('dialog')).toBeVisible()
    await expect(keys(page)).toHaveText('1')
    await expect(stage(page)).toHaveAttribute('data-stage', '2')
  }
  // Esc closes settings without also resuming the game behind it.
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect(paused(page)).toBeVisible()
})

test('pause resume keys preserve progress and ignore long presses; R restarts without typing', async ({
  page,
}) => {
  await start(page)
  await typeOne(page)
  for (const key of ['Escape', 'Space', 'Enter']) {
    await page.keyboard.press('Escape')
    await expect(paused(page)).toBeVisible()
    await page.clock.runFor(10000)
    await page.keyboard.down(key)
    await page.clock.runFor(20)
    await page.keyboard.down(key)
    await expect(page.getByText('IN THE FLOW', { exact: true })).toBeVisible()
    await expect(keys(page)).toHaveText('1')
    await expect(misses(page)).toHaveText('0')
    await page.keyboard.up(key)
  }
  await page.keyboard.press('Escape')
  await page.keyboard.down('r')
  await page.clock.runFor(20)
  await page.keyboard.down('r')
  await expect(ready(page)).toBeVisible()
  await expect(keys(page)).toHaveText('0')
  await expect(misses(page)).toHaveText('0')
  await page.keyboard.up('r')
  await expect(arena(page)).toBeFocused()
  await page.keyboard.press('Space')
  await page.clock.runFor(3000)
  await typeOne(page)
  await expect(keys(page)).toHaveText('1')
  expect(await records(page)).toEqual([])
})

test('result R retries, 4 returns to a completed result, and leaving clears only the current game', async ({
  page,
}) => {
  await finishTimed(page)
  const saved = await records(page)
  for (const [key, index] of [
    ['1', '0'],
    ['2', '1'],
    ['3', '2'],
  ]) {
    await page.keyboard.press(key)
    await expect(stage(page)).toHaveAttribute('data-stage', index)
    await page.clock.runFor(20)
    // Number navigation deliberately requires focus outside the typing area.
    await page.locator('.section-heading').click()
    await page.keyboard.press('4')
    await expect(stage(page)).toHaveAttribute('data-stage', '3')
  }
  const result = await page.locator('.session-result').count()
  expect(result).toBeGreaterThan(0)
  await page.keyboard.down('r')
  await page.clock.runFor(20)
  await page.keyboard.down('r')
  await page.keyboard.up('r')
  await expect(ready(page)).toBeVisible()
  await expect(keys(page)).toHaveText('0')
  await expect(misses(page)).toHaveText('0')
  await expect(
    page.getByRole('button', { name: '結果へ', exact: true }),
  ).toBeDisabled()
  expect(await records(page)).toEqual(saved)
  await page.getByRole('button', { name: '練習の記録', exact: true }).click()
  await page.keyboard.type('1234rns')
  await page.getByRole('button', { name: 'タイピング', exact: true }).click()
  await expect(stage(page)).toHaveAttribute('data-stage', '0')
  await page.keyboard.press('4')
  await expect(stage(page)).toHaveAttribute('data-stage', '0')
  expect(await records(page)).toEqual(saved)
})

for (const state of [
  'selection',
  'preview',
  'ready',
  'countdown',
  'running',
  'paused',
  'done',
]) {
  test(`leaving practice in ${state} returns to selection and never records a cancelled game`, async ({
    page,
  }) => {
    if (state === 'done') await finishTimed(page)
    else if (state === 'preview') await page.keyboard.press('2')
    else if (state !== 'selection') {
      await page
        .getByRole('button', {
          name: '打鍵トレーナー · さくさくタイピング',
          exact: true,
        })
        .click()
      await enter(page)
      if (state !== 'ready') {
        await page.keyboard.press('Space')
        if (state !== 'countdown') {
          await page.clock.runFor(3000)
          await typeOne(page)
          if (state === 'paused') await page.keyboard.press('Escape')
        }
      }
    }
    const saved = await records(page)
    for (const target of ['CPU対戦', '練習の記録', '苦手ワード練習']) {
      await page.getByRole('button', { name: target, exact: true }).click()
      await page.clock.runFor(120000)
      await page
        .getByRole('button', { name: 'タイピング', exact: true })
        .click()
      await expect(stage(page)).toHaveAttribute('data-stage', '0')
      await page.keyboard.press('4')
      await expect(stage(page)).toHaveAttribute('data-stage', '0')
      await expect(
        page.getByRole('button', { name: '結果へ', exact: true }),
      ).toBeDisabled()
      await enter(page)
      await expect(ready(page)).toBeVisible()
      await expect(keys(page)).toHaveText('0')
      await expect(misses(page)).toHaveText('0')
      expect(await records(page)).toEqual(saved)
    }
  })
}

for (const nextKey of ['n', 's', 'Space', 'Enter']) {
  test(`CPU ${nextKey} advances exactly one round; R rematches once after BO7`, async ({
    page,
  }) => {
    await startCpu(page)
    for (let round = 1; round <= 4; round++) {
      await page.clock.fastForward(180000)
      await expect(page.getByTestId('cpu-rounds')).toHaveText(String(round))
      if (round === 4) break
      await expect(page.locator('.cpu-results')).toHaveAttribute(
        'data-result',
        'round',
      )
      // Check the same key while a different action button owns focus.
      await page
        .getByRole('button', { name: '対戦をリセット', exact: true })
        .focus()
      await page.keyboard.down(nextKey)
      await page.clock.runFor(20)
      await page.keyboard.down(nextKey)
      await page.keyboard.up(nextKey)
      await expect(page.locator('.battle-countdown')).toBeVisible()
      await expect(
        page.getByRole('region', { name: 'CPU対戦の入力領域' }),
      ).toBeFocused()
      await expect(misses(page)).toHaveText('0')
    }
    await expect(page.locator('.cpu-results')).toHaveAttribute(
      'data-result',
      'defeat',
    )
    await expect.poll(() => records(page)).toHaveLength(1)
    await page.getByRole('button', { name: '環境設定', exact: true }).click()
    await page.keyboard.press('r')
    await expect(page.locator('.cpu-results')).toHaveAttribute(
      'data-result',
      'defeat',
    )
    await page.keyboard.press('Escape')
    await page.keyboard.down('r')
    await page.clock.runFor(20)
    await page.keyboard.down('r')
    await page.keyboard.up('r')
    await expect(page.locator('.battle-countdown')).toBeVisible()
    await expect(page.getByTestId('cpu-rounds')).toHaveText('0')
    await expect(page.getByTestId('player-rounds')).toHaveText('0')
    await expect(page.locator('.battle-seed-info')).toContainText(
      'shortcut-test',
    )
    expect(await records(page)).toHaveLength(1)
  })
}

test('CPU paused resume keys preserve progress, R restarts the match, and hints fit mobile', async ({
  page,
}) => {
  await startCpu(page)
  await page.clock.runFor(3050)
  for (const key of ['Escape', 'Space', 'Enter']) {
    await page.keyboard.press('Escape')
    const resume = page.getByRole('button', {
      name: '対戦を再開する',
      exact: true,
    })
    await expect(resume).toBeVisible()
    const opponent = await page.locator('.opponent-typed').textContent()
    await page.clock.fastForward(60000)
    await expect(page.locator('.opponent-typed')).toHaveText(opponent!)
    await resume.focus()
    await page.keyboard.down(key)
    await page.clock.runFor(20)
    await page.keyboard.down(key)
    await page.keyboard.up(key)
    await expect(resume).toHaveCount(0)
    await expect(misses(page)).toHaveText('0')
  }
  await page.keyboard.press('Escape')
  await page.setViewportSize({ width: 390, height: 844 })
  await page.emulateMedia({ reducedMotion: 'reduce', colorScheme: 'light' })
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true)
  await page.screenshot({
    path: 'artifacts/cpu-shortcuts-paused-mobile.png',
    fullPage: true,
  })
  await page.keyboard.press('r')
  await page.clock.runFor(20)
  await expect(page.locator('.battle-countdown')).toBeVisible()
  await expect(page.getByTestId('cpu-rounds')).toHaveText('0')
  expect(await records(page)).toEqual([])
})
