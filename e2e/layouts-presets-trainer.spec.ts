import { startPractice } from './startPractice'
import { choose as pick } from './select'
import { test, expect, type Page } from '@playwright/test'
import { cpuPresets } from '../src/domain/battle/cpuMatch'
import {
  createTrainerOrder,
  sakusaku,
  sakusakuEntries,
} from '../src/domain/content/sakusaku'
import { typewellDocument } from '../src/domain/content/typewell'
import { physicalType } from './physicalType'
import type { Layout } from '../src/domain/typing/engine'

async function setup(page: Page, layout: Layout = 'jis') {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.addInitScript(
    (layout) =>
      localStorage.setItem(
        'yohaku.settings.v1',
        JSON.stringify({ layout, background: false, guide: false }),
      ),
    layout,
  )
  await page.goto('/')
}
async function enter(page: Page) {
  await page.getByRole('button', { name: '入力へ進む', exact: true }).click()
  await expect(page.locator('[data-face="2"]')).toHaveCSS('transform', 'none')
  await page.getByRole('region', { name: /タイピング入力領域/ }).focus()
  await startPractice(page, true)
}
const guide = (page: Page) =>
  page
    .locator('.roman-line')
    .evaluate((el) =>
      [...el.querySelectorAll('.roman-current, .remaining-roman')]
        .map((n) => n.textContent)
        .join(''),
    )

test('trainer seed controls reproduce the same order across pauses, restart and saved history', async ({
  page,
}) => {
  await page.clock.install()
  await setup(page)
  await page.getByRole('button', { name: sakusaku.title, exact: true }).click()
  await expect(page.locator('.passage-header')).not.toContainText('準拠')
  await page.getByLabel('シードを固定する', { exact: true }).check()
  await page.getByLabel('出題シード', { exact: true }).fill('trainer-fixed')
  await page
    .getByRole('button', { name: 'このシードを使う', exact: true })
    .click()
  const next = createTrainerOrder('trainer-fixed')
  const order = Array.from({ length: 6 }, () => next())
  await enter(page)
  await page.clock.pauseAt(
    new Date(await page.evaluate(() => Date.now() + 1000)),
  )
  for (let i = 0; i < 3; i++) {
    await expect(page.locator('.current-paragraph')).toHaveAttribute(
      'data-text',
      sakusakuEntries[order[i]][0],
    )
    await page.keyboard.type(await guide(page))
  }
  await page.keyboard.press('Escape')
  await page.clock.runFor(5000)
  await expect(page.locator('.current-paragraph')).toHaveAttribute(
    'data-text',
    sakusakuEntries[order[3]][0],
  )
  await page.getByRole('button', { name: '再開する', exact: true }).click()
  await page.getByRole('region', { name: /タイピング入力領域/ }).focus()
  await startPractice(page, true)
  await page.keyboard.type(await guide(page))
  await expect(page.locator('.current-paragraph')).toHaveAttribute(
    'data-text',
    sakusakuEntries[order[4]][0],
  )
  await page.clock.runFor(60050)
  await expect(page.getByText('60秒の計測が終了しました。')).toBeVisible()
  await page.getByRole('button', { name: '練習の記録', exact: true }).click()
  await page.getByRole('tab', { name: '全記録', exact: true }).click()
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          JSON.parse(localStorage.getItem('yohaku.history.v1') ?? '[]').length,
      ),
    )
    .toBe(1)
  expect(
    await page.evaluate(
      () => JSON.parse(localStorage.getItem('yohaku.history.v1')!)[0],
    ),
  ).toMatchObject({
    mode: 'trainer',
    seed: 'trainer-fixed',
    replayVersion: 2,
    title: sakusaku.title,
  })
  await page
    .getByRole('button', { name: 'シード trainer-fixed を再現', exact: true })
    .click()
  await enter(page)
  for (let i = 0; i < 3; i++) {
    await expect(page.locator('.current-paragraph')).toHaveAttribute(
      'data-text',
      sakusakuEntries[order[i]][0],
    )
    await page.keyboard.type(await guide(page))
  }
  await page.getByRole('button', { name: 'やり直す', exact: true }).click()
  await expect(page.locator('.current-paragraph')).toHaveAttribute(
    'data-text',
    sakusakuEntries[order[0]][0],
  )
  await page.getByRole('button', { name: '文章選択へ', exact: true }).click()
  await page.getByLabel('出題シード', { exact: true }).fill('another-trainer')
  await page
    .getByRole('button', { name: 'このシードを使う', exact: true })
    .click()
  await enter(page)
  await expect(page.locator('.current-paragraph')).toHaveAttribute(
    'data-text',
    sakusakuEntries[createTrainerOrder('another-trainer')()][0],
  )
})

test('CPU has 21 rank-based profiles, migrates old defaults and persists the 35KPM profile', async ({
  page,
}) => {
  await page.addInitScript(
    () =>
      !localStorage.getItem('yohaku.cpu.v1') &&
      localStorage.setItem(
        'yohaku.cpu.v1',
        JSON.stringify({ kpm: 300, reactionMs: 210, curve: 'ease-in' }),
      ),
  )
  await setup(page)
  await page.getByRole('button', { name: 'CPU対戦', exact: true }).click()
  await expect(page.getByLabel('CPU速度 (KPM)', { exact: true })).toHaveValue(
    '385',
  )
  await expect(
    page.getByLabel('CPU反応時間 (ms)', { exact: true }),
  ).toHaveValue('205')
  const presets = page.getByLabel('CPUプリセット', { exact: true })
  await presets.click()
  await expect(
    page
      .getByRole('listbox')
      .locator('[role=option]:not([aria-disabled=true])'),
  ).toHaveCount(21)
  await page.keyboard.press('Escape')
  for (const p of cpuPresets) {
    await pick(presets, p.name)
    await expect(page.getByLabel('CPU速度 (KPM)', { exact: true })).toHaveValue(
      String(p.kpm),
    )
    await expect(
      page.getByLabel('CPU反応時間 (ms)', { exact: true }),
    ).toHaveValue(String(p.reactionMs))
    expect(
      await page
        .getByLabel('CPU反応時間 (ms)', { exact: true })
        .evaluate((el: HTMLInputElement) => el.validity.valid),
    ).toBe(true)
  }
  await pick(presets, 'カメ')
  await page.getByRole('button', { name: 'CPUと対戦する', exact: true }).click()
  await expect
    .poll(() =>
      page.evaluate(
        () => JSON.parse(localStorage.getItem('yohaku.cpu.v1')!).kpm,
      ),
    )
    .toBe(35)
  await page.reload()
  await page.getByRole('button', { name: 'CPU対戦', exact: true }).click()
  await expect(presets).toHaveAttribute('data-value', 'カメ')
  await expect(page.getByLabel('CPU速度 (KPM)', { exact: true })).toHaveValue(
    '35',
  )
  await pick(presets, 'カメ')
  await page.getByRole('button', { name: 'CPUと対戦する', exact: true }).click()
  await expect(page.locator('.battle-countdown')).toBeVisible()
})

for (const layout of [
  'colemak',
  'workman',
  'onishi',
  'azerty',
  'norman',
  'nova-f5-pair',
] as const)
  test(`${layout} supports physical typing, records, replay, ghosts, CPU and always-on guides`, async ({
    page,
  }) => {
    const errors: string[] = []
    page.on('pageerror', (e) => errors.push(e.message))
    await page.clock.install()
    await setup(page, layout)
    await expect(page.getByLabel('入力方式', { exact: true })).toHaveAttribute(
      'data-value',
      layout,
    )
    await expect(page.getByLabel('入力ガイド', { exact: true })).toHaveCount(0)
    await page
      .getByRole('button', {
        name: 'タイプウェル準拠 · 宇宙の名前',
        exact: true,
      })
      .click()
    await page.getByLabel('シードを固定する', { exact: true }).check()
    await page.getByLabel('出題シード', { exact: true }).fill('new-layout')
    await page
      .getByRole('button', { name: 'このシードを使う', exact: true })
      .click()
    const reference = typewellDocument(
      'typewell-space',
      'new-layout',
      layout,
      2,
    ).plan.reference
    await enter(page)
    await expect(page.locator('.roman-line')).toBeVisible()
    await expect(page.locator('[data-code="KeyE"] > span')).toHaveText(
      {
        colemak: 'F',
        workman: 'R',
        onishi: 'U',
        azerty: 'E',
        norman: 'D',
        'nova-f5-pair': 'U',
      }[layout],
    )
    await expect(page.locator('[data-code="KeyJ"] > span')).toHaveText(
      {
        colemak: 'N',
        workman: 'N',
        onishi: 'T',
        azerty: 'J',
        norman: 'N',
        'nova-f5-pair': 'T',
      }[layout],
    )
    await expect(page.locator('[data-code="Semicolon"] > span')).toHaveText(
      {
        colemak: 'O',
        workman: 'I',
        onishi: 'H',
        azerty: 'M',
        norman: 'H',
        'nova-f5-pair': 'S',
      }[layout],
    )
    await physicalType(page, reference.slice(0, 5), layout)
    await expect(page.locator('.typed-roman')).toHaveText(reference.slice(0, 5))
    if (layout === 'workman' || layout === 'azerty')
      await page.setViewportSize({ width: 390, height: 1000 })
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true)
    await page.screenshot({
      path: `artifacts/${layout}-typing.png`,
      fullPage: true,
      animations: 'disabled',
    })
    await physicalType(page, reference.slice(5), layout)
    await expect(
      page.getByText('SESSION COMPLETE', { exact: true }),
    ).toBeVisible()
    await page.getByRole('button', { name: '練習の記録', exact: true }).click()
    await page.getByRole('tab', { name: '全記録', exact: true }).click()
    await expect
      .poll(() =>
        page.evaluate(
          () =>
            JSON.parse(localStorage.getItem('yohaku.history.v1') ?? '[]')
              .length,
        ),
      )
      .toBe(1)
    expect(
      await page.evaluate(
        () => JSON.parse(localStorage.getItem('yohaku.history.v1')!)[0],
      ),
    ).toMatchObject({ layout, keys: 400, rawMisses: 0 })
    await page
      .getByRole('button', { name: 'リプレイを見る', exact: true })
      .click()
    const replay = page.getByRole('region', {
      name: '記録リプレイ',
      exact: true,
    })
    await replay.getByRole('button', { name: '次の1打鍵', exact: true }).click()
    await expect(replay.locator('.typed-roman')).toHaveText(reference[0])
    await page
      .getByRole('button', { name: 'この記録のゴーストと対戦', exact: true })
      .click()
    const ghostInput = page.getByRole('region', {
      name: /ゴースト対戦の入力領域/,
    })
    await ghostInput.focus()
    await page.keyboard.press('Space')
    await expect(page.locator('[data-code="Space"]')).toHaveAttribute(
      'data-error',
      'true',
    )
    await physicalType(page, reference.slice(0, 5), layout)
    await expect(ghostInput.locator('.typed-roman')).toHaveText(
      reference.slice(0, 5),
    )
    await page.keyboard.press('Escape')
    await page.getByRole('button', { name: 'CPU対戦', exact: true }).click()
    await expect(
      page.getByLabel('対戦の入力方式', { exact: true }),
    ).toHaveAttribute('data-value', layout)
    await pick(page.getByLabel('CPUプリセット', { exact: true }), 'カメ')
    await page
      .getByRole('button', { name: 'CPUと対戦する', exact: true })
      .click()
    await page.clock.fastForward(3100)
    const area = page.getByRole('region', {
      name: 'CPU対戦の入力領域',
      exact: true,
    })
    await area.focus()
    await expect(page.locator('.duel-row-player')).toBeVisible()
    const prompt = await page
      .locator('.current-paragraph')
      .getAttribute('data-text')
    expect(prompt).toBeTruthy()
    const cpuGuide = (
      await page.locator('.duel-row-player .duel-cell').allTextContents()
    ).join('')
    await physicalType(page, cpuGuide, layout)
    await expect(page.getByTestId('player-points')).toHaveText('1')
    expect(errors).toEqual([])
  })
