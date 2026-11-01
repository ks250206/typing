import { expect, test } from '@playwright/test'
import { sentencePracticePool } from '../src/domain/content/sentencePracticePool'
import { choose } from './select'
import { startPractice } from './startPractice'

for (const width of [1440, 390]) {
  test(`sentence list is embedded, virtual and reachable by first/last/jump at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 1000 })
    const errors: string[] = []
    page.on('pageerror', (error) => errors.push(error.message))
    page.on('console', (message) => {
      if (message.type() === 'error') errors.push(message.text())
    })
    await page.addInitScript(() => {
      localStorage.setItem(
        'yohaku.settings.v1',
        JSON.stringify({
          background: false,
          navigationMotion: 'off',
          layout: 'jis',
        }),
      )
      localStorage.setItem(
        'galactype.sentence-practice.v1',
        JSON.stringify({
          passageId: 'en-typewell-01',
          targetKpm: 600,
          maxMisses: 10,
          repetitions: 5,
        }),
      )
    })
    await page.goto('/')
    await page.getByRole('button', { name: '一文練習', exact: true }).click()
    const list = page.getByRole('region', {
      name: '文章別の練習統計',
      exact: true,
    })
    const table = list.locator('table')
    await expect(table).toHaveAttribute('aria-rowcount', '1501')
    expect(await list.evaluate((el) => !!el.closest('.mission-carousel'))).toBe(
      true,
    )
    await expect(page.locator('.sentence-list-heading')).toHaveCount(0)
    await expect(
      page.locator('.sentence-library .passage-header h2'),
    ).toHaveText('TypeWell · 基本英単語')

    expect(await list.locator('tr[data-word-row]').count()).toBeLessThan(30)
    for (const label of ['目標KPM', 'ミス上限', '連続回数'])
      await expect(page.getByLabel(label, { exact: true })).toHaveCSS(
        'text-align',
        'left',
      )
    const toggles = await page
      .locator('.sentence-options .input-style-card .toggle-row')
      .evaluateAll((labels) =>
        labels.map((label) => {
          const r = label.getBoundingClientRect()
          return r.y + r.height / 2
        }),
      )
    expect(toggles).toHaveLength(3)
    expect(
      Math.abs(toggles[1] - toggles[0] - (toggles[2] - toggles[1])),
    ).toBeLessThan(1)
    await list
      .getByRole('button', { name: '最後の文章へ', exact: true })
      .click()
    const last = list.locator('[data-word-row="1499"]')
    await expect(last).toBeVisible()
    await expect(last.getByRole('button')).toBeFocused()
    const geometry = await list
      .locator('.sentence-table-scroll')
      .evaluate((host) => {
        const row = host.querySelector<HTMLElement>('[data-word-row]')!
        const zoom =
          parseFloat(getComputedStyle(document.documentElement).zoom) || 1
        const head = host.querySelector('thead')!
        return {
          row: row.getBoundingClientRect().height / zoom,
          total: host.scrollHeight,
          header:
            getComputedStyle(head).position === 'absolute'
              ? 0
              : head.offsetHeight,
        }
      })
    expect(geometry.row).toBeCloseTo(width <= 800 ? 78 : 38, 0)
    expect(
      Math.abs(geometry.total - (geometry.row * 1500 + geometry.header)),
    ).toBeLessThanOrEqual(2)
    const jump = list.getByLabel('文章番号', { exact: true })
    await jump.fill('751')
    await jump.press('Enter')
    const target = list.locator('[data-word-row="750"]')
    await expect(target.getByRole('button')).toBeFocused()
    await page.keyboard.press('Enter')
    await expect(target).toHaveAttribute('data-selected', 'true')
    await expect(
      page
        .getByRole('region', { name: '一文練習の入力領域' })
        .locator('.current-paragraph'),
    ).toHaveAttribute(
      'data-text',
      sentencePracticePool('en-typewell-01', 'jis')[750].text,
    )
    await list
      .getByRole('button', { name: '最初の文章へ', exact: true })
      .click()
    await page.keyboard.press('ArrowDown')
    await expect(
      list.locator('[data-word-row="1"]').getByRole('button'),
    ).toBeFocused()
    await page.keyboard.press('End')
    await expect(last.getByRole('button')).toBeFocused()
    await jump.fill('99999')
    await jump.press('Enter')
    await expect(jump).toHaveValue('1500')
    await expect(last).toBeVisible()
    await page.screenshot({
      path: `artifacts/sentence-virtual-${width}.png`,
      fullPage: true,
      animations: 'disabled',
    })
    if (width === 1440) {
      await page.getByRole('button', { name: '環境設定', exact: true }).click()
      await choose(page.getByLabel('画面の表示倍率', { exact: true }), '125')
      await page
        .getByRole('button', { name: '設定を閉じる', exact: true })
        .click()
      await list
        .getByRole('button', { name: '最後の文章へ', exact: true })
        .click()
      await expect(last).toBeVisible()
    }
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true)
    expect(errors).toEqual([])
  })

  test(`C returns paused and completed practice/CPU to selection and settings at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 1000 })
    await page.clock.install()
    await page.addInitScript(() =>
      localStorage.setItem(
        'yohaku.settings.v1',
        JSON.stringify({ background: false, navigationMotion: 'off' }),
      ),
    )
    await page.goto('/')
    await page.getByRole('button', { name: '練習へ進む', exact: true }).click()
    await page.keyboard.press('c')
    await expect(
      page.getByRole('button', { name: '文章選択へ', exact: true }),
    ).toHaveAttribute('aria-current', 'step')
    await page.getByRole('button', { name: '練習へ進む', exact: true }).click()
    await startPractice(page, true)
    await page.keyboard.type('c')
    await expect(
      page.getByRole('button', { name: '練習へ進む', exact: true }),
    ).toHaveAttribute('aria-current', 'step')
    await page.keyboard.press('Escape')
    await page.keyboard.press('c')
    await expect(
      page.getByRole('button', { name: '文章選択へ', exact: true }),
    ).toHaveAttribute('aria-current', 'step')
    await page
      .getByRole('button', {
        name: '打鍵トレーナー · 高速タイピング',
        exact: true,
      })
      .click()
    await page.getByRole('button', { name: '練習へ進む', exact: true }).click()
    await startPractice(page, true)
    const next = (await page.locator('.roman-current').textContent())!
    await page.keyboard.type(next)
    await page.clock.fastForward(60100)
    await expect(
      page.getByRole('region', { name: 'セッションの結果' }),
    ).toBeVisible()
    await page.getByRole('button', { name: '環境設定', exact: true }).click()
    await page.keyboard.press('c')
    await expect(page.getByRole('dialog')).toBeVisible()
    await page
      .getByRole('button', { name: '設定を閉じる', exact: true })
      .click()
    await page.keyboard.press('c')
    await expect(
      page.getByRole('button', { name: '文章選択へ', exact: true }),
    ).toHaveAttribute('aria-current', 'step')
    await page.getByRole('button', { name: 'CPU対戦', exact: true }).click()
    const seedTitle = await page.locator('.battle-seed-label').boundingBox()
    const fixedLabel = await page.locator('.battle-fixed-toggle').boundingBox()
    const fixedText = await page
      .locator('.battle-fixed-toggle > span')
      .boundingBox()
    const fixedCheckbox = await page
      .getByRole('checkbox', { name: '対戦シードを固定する', exact: true })
      .boundingBox()
    expect(
      Math.abs(
        fixedText!.y +
          fixedText!.height / 2 -
          fixedCheckbox!.y -
          fixedCheckbox!.height / 2,
      ),
    ).toBeLessThan(1)
    expect(fixedCheckbox!.x).toBeGreaterThan(fixedText!.x + fixedText!.width)
    await page.screenshot({
      path: `artifacts/cpu-seed-${width}.png`,
      fullPage: true,
    })
    const seedInput = await page
      .getByLabel('対戦シード', { exact: true })
      .boundingBox()
    for (const label of ['CPUプリセット', 'CPUの打ち方']) {
      const control = await page
        .getByRole('combobox', { name: label, exact: true })
        .boundingBox()
      expect(Math.abs(seedInput!.width - control!.width)).toBeLessThan(1)
      expect(Math.abs(seedInput!.height - control!.height)).toBeLessThan(1)
    }
    expect(seedTitle!.y + seedTitle!.height).toBeLessThan(seedInput!.y)
    expect(
      Math.abs(
        seedInput!.y +
          seedInput!.height / 2 -
          fixedLabel!.y -
          fixedLabel!.height / 2,
      ),
    ).toBeLessThan(1)
    const refresh = await page
      .getByRole('button', { name: '更新', exact: true })
      .boundingBox()
    expect(
      Math.abs(
        seedInput!.y + seedInput!.height / 2 - refresh!.y - refresh!.height / 2,
      ),
    ).toBeLessThan(1)

    await page.getByLabel('CPU速度 (KPM)', { exact: true }).fill('1800')
    await page.getByLabel('CPU反応時間 (ms)', { exact: true }).fill('100')
    await choose(page.getByLabel('CPUの打ち方'), 'constant')
    const start = async () => {
      await page
        .getByRole('button', { name: 'CPUと対戦する', exact: true })
        .click()
      await page.clock.runFor(3100)
      await page.getByRole('region', { name: 'CPU対戦の入力領域' }).focus()
    }
    await start()
    await page.keyboard.type('c')
    await expect(page.locator('.cpu-battle')).toHaveAttribute(
      'data-match-active',
      'true',
    )
    await page.keyboard.press('Escape')
    await page.keyboard.press('c')
    await expect(
      page.getByRole('button', { name: 'CPUと対戦する', exact: true }),
    ).toBeVisible()
    await start()
    await page.clock.fastForward(60000)
    await expect(
      page.getByRole('button', { name: '次のラウンド', exact: true }),
    ).toBeVisible()
    await page.keyboard.press('c')
    await expect(
      page.getByRole('button', { name: 'CPUと対戦する', exact: true }),
    ).toBeVisible()
    await start()
    for (let round = 0; round < 4; round++) {
      await page.clock.fastForward(60000)
      if (round < 3)
        await page
          .getByRole('button', { name: '次のラウンド', exact: true })
          .click()
    }
    await expect(
      page.getByRole('region', { name: 'セッションの結果' }),
    ).toBeVisible()
    await page.keyboard.press('c')
    await expect(
      page.getByRole('button', { name: 'CPUと対戦する', exact: true }),
    ).toBeVisible()
    await expect
      .poll(async () =>
        page.evaluate(
          () =>
            JSON.parse(localStorage.getItem('yohaku.history.v1') ?? '[]')
              .length,
        ),
      )
      .toBe(2)
  })
}
