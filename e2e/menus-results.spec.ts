import { startPractice } from './startPractice'
import { test, expect, type Page } from '@playwright/test'
import { choose } from './select'
import { typewellDocument } from '../src/domain/content/typewell'
async function setup(page: Page, reduced = true) {
  await page.emulateMedia({
    reducedMotion: reduced ? 'reduce' : 'no-preference',
  })
  await page.addInitScript(
    () =>
      !localStorage.getItem('yohaku.settings.v1') &&
      localStorage.setItem(
        'yohaku.settings.v1',
        JSON.stringify({ background: false }),
      ),
  )
  await page.goto('/')
}
test('custom menus support keyboard navigation, typeahead, cancel, Tab commit, viewport bounds and disabled controls', async ({
  page,
}) => {
  await setup(page)
  const layout = page.getByRole('combobox', { name: '入力方式', exact: true })
  await expect(page.locator('select')).toHaveCount(0)
  await layout.focus()
  await page.keyboard.press('ArrowDown')
  await page.keyboard.press('ArrowDown')
  await expect(layout).toBeFocused()
  await expect(layout).toHaveAttribute('data-value', 'jis')
  await expect(layout).toHaveAttribute('aria-expanded', 'true')
  await page.keyboard.press('Escape')
  await expect(layout).toHaveAttribute('data-value', 'jis')
  await page.keyboard.type('work')
  await page.keyboard.press('Enter')
  await expect(layout).toHaveAttribute('data-value', 'workman')
  await page.keyboard.press('Home')
  await page.keyboard.press('Tab')
  await expect(layout).toHaveAttribute('data-value', 'jis')
  await layout.click()
  await page.keyboard.press('End')
  await expect(
    page.getByRole('option', { name: 'JIS かな', exact: true }),
  ).toHaveAttribute('data-active', 'true')
  await page.locator('.section-heading').click()
  await expect(page.getByRole('listbox')).toHaveCount(0)
  await expect(layout).toHaveAttribute('data-value', 'jis')
  await page.getByRole('button', { name: 'CPU対戦', exact: true }).click()
  const preset = page.getByRole('combobox', {
    name: 'CPUプリセット',
    exact: true,
  })
  await preset.focus()
  await page.keyboard.press('Home')
  await page.keyboard.press('PageDown')
  await page.keyboard.press('PageDown')
  await expect(
    page.getByRole('option', { name: 'チーター', exact: true }),
  ).toHaveAttribute('data-active', 'true')
  await page.keyboard.press('ArrowDown')
  await expect(
    page.getByRole('option', { name: 'チーター', exact: true }),
  ).toHaveAttribute('data-active', 'true')
  await page.keyboard.press('Escape')
  await page.setViewportSize({ width: 390, height: 844 })
  const set = page.getByRole('combobox', {
    name: '対戦の文章セット',
    exact: true,
  })
  await set.click()
  await page.keyboard.press('End')
  const list = page.getByRole('listbox')
  expect(
    await list.evaluate((el) => {
      const r = el.getBoundingClientRect()
      return (
        r.left >= 0 &&
        r.right <= innerWidth &&
        r.top >= 0 &&
        r.bottom <= innerHeight
      )
    }),
  ).toBe(true)
  const activeId = await set.getAttribute('aria-activedescendant')
  expect(
    await page.locator(`[id=${JSON.stringify(activeId)}]`).evaluate((el) => {
      const r = el.getBoundingClientRect(),
        host = el.parentElement!.getBoundingClientRect()
      return r.top >= host.top && r.bottom <= host.bottom
    }),
  ).toBe(true)
  await page.screenshot({
    path: 'artifacts/custom-select-mobile.png',
    fullPage: true,
    animations: 'disabled',
  })
  await page.keyboard.press('Escape')
  await page.getByRole('button', { name: 'CPUと対戦する', exact: true }).click()
  await expect(set).toHaveCount(0)
  await expect(page.getByRole('listbox')).toHaveCount(0)
  await page
    .getByRole('button', { name: '対戦をリセット', exact: true })
    .click()
  await expect(set).toBeEnabled()
})
test('custom menu pointer selection works on a touch surface', async ({
  browser,
}) => {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    isMobile: true,
  })
  const page = await context.newPage()
  try {
    await setup(page)
    const trigger = page.getByRole('combobox', {
      name: '入力方式',
      exact: true,
    })
    await trigger.tap()
    await page.getByRole('option', { name: 'Colemak', exact: true }).tap()
    await expect(trigger).toHaveAttribute('data-value', 'colemak')
    await expect(page.getByRole('listbox')).toHaveCount(0)
  } finally {
    await context.close()
  }
})
test('finishing opens the result face with point, errors, loss, full log and replay; retry preserves one saved result', async ({
  page,
}) => {
  await setup(page)
  const frame = page.locator('.mission-viewport'),
    height = await frame.evaluate((el) => el.clientHeight)
  await expect(
    page.getByRole('button', { name: '結果へ', exact: true }),
  ).toBeDisabled()
  await page
    .getByRole('button', { name: 'タイプウェル · 基本常用語', exact: true })
    .click()
  await page.getByLabel('シードを固定する', { exact: true }).check()
  await page.getByLabel('出題シード', { exact: true }).fill('result-screen')
  await page
    .getByRole('button', { name: 'このシードを使う', exact: true })
    .click()
  const doc = typewellDocument('typewell-basic', 'result-screen', 'jis', 2)
  await page.getByRole('button', { name: '入力へ進む', exact: true }).click()
  await page.getByRole('region', { name: /タイピング入力領域/ }).focus()
  await startPractice(page)
  await page.keyboard.type('%%%')
  await page.keyboard.type(doc.plan.reference)
  const result = page.getByRole('region', {
    name: 'セッションの結果',
    exact: true,
  })
  await expect(result).toBeVisible()
  await expect(result).toBeFocused()
  await expect(page.locator('[data-face="2"]')).toHaveAttribute('inert', '')
  await expect(
    page.getByRole('button', { name: '結果へ', exact: true }),
  ).toHaveAttribute('aria-current', 'step')
  await expect(result.locator('.result-metrics')).toContainText('400 / 3')
  await expect(result.locator('.result-table tbody tr')).toHaveCount(1)
  await expect(result.locator('.result-error')).toHaveText('%')
  await expect(
    result.getByRole('img', { name: '1秒ごとのKPMとミス' }),
  ).toBeVisible()
  expect(await frame.evaluate((el) => el.clientHeight)).toBe(height)
  await page.screenshot({
    path: 'artifacts/session-result-desktop.png',
    fullPage: true,
    animations: 'disabled',
  })
  await page.setViewportSize({ width: 390, height: 844 })
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true)
  await page.screenshot({
    path: 'artifacts/session-result-mobile.png',
    fullPage: true,
    animations: 'disabled',
  })
  await result
    .getByRole('button', { name: '全打鍵・リプレイを確認', exact: true })
    .click()
  await result.getByRole('button', { name: '全打鍵ログ', exact: true }).click()
  await expect(result.locator('.detail-scroll tbody tr')).toHaveCount(100)
  await result.getByRole('button', { name: 'リプレイ', exact: true }).click()
  await choose(
    result.getByRole('combobox', { name: 'リプレイ速度', exact: true }),
    '2',
  )
  await result.getByRole('button', { name: '次の1打鍵', exact: true }).click()
  await expect(result.locator('.replay-event')).toContainText('ミス')
  await expect(page.locator('select')).toHaveCount(0)
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          JSON.parse(localStorage.getItem('yohaku.history.v1') ?? '[]').length,
      ),
    )
    .toBe(1)
  await result.getByRole('button', { name: 'もう一度', exact: true }).click()
  await expect(page.locator('[data-face="2"]')).toHaveClass(/is-active/)
  await expect(page.locator('.current-paragraph')).toHaveAttribute(
    'data-text',
    doc.sentences[0].text,
  )
  expect(
    await page.evaluate(
      () => JSON.parse(localStorage.getItem('yohaku.history.v1')!).length,
    ),
  ).toBe(1)
})
test('CPU round result explains the 95% reversal and retains its own input log before the next countdown', async ({
  page,
}) => {
  await page.clock.install()
  await setup(page)
  await page.getByRole('button', { name: 'CPU対戦', exact: true }).click()
  await choose(
    page.getByRole('combobox', { name: 'CPUプリセット', exact: true }),
    'カメ',
  )
  await page.getByRole('button', { name: 'CPUと対戦する', exact: true }).click()
  await page.clock.fastForward(3100)
  await page
    .getByRole('region', { name: 'CPU対戦の入力領域', exact: true })
    .focus()
  for (let word = 0; word < 10; word++) {
    const input = (
      await page.locator('.duel-row-player .duel-cell').allTextContents()
    ).join('')
    if (!word) for (const key of input) await page.keyboard.type('%' + key)
    else await page.keyboard.type(input)
    if (word < 9) await page.clock.fastForward(700)
  }
  const round = page.locator('.cpu-results[data-result="round"]')
  await expect(round).toBeVisible()
  await expect(round).toContainText('CPUがラウンド獲得')
  await expect(round).toContainText('正確率95%ルールによる逆転')
  await expect(round.locator('.result-error')).not.toHaveCount(0)
  await expect(page.locator('.battle-arena')).toHaveCount(0)
  await page.screenshot({
    path: 'artifacts/cpu-round-result.png',
    fullPage: true,
    animations: 'disabled',
  })
  expect(
    await page.evaluate(
      () =>
        JSON.parse(localStorage.getItem('yohaku.history.v1') ?? '[]').length,
    ),
  ).toBe(0)
  await round.getByRole('button', { name: '次のラウンド', exact: true }).click()
  await expect(page.locator('.battle-countdown')).toBeVisible()
  await expect(page.getByTestId('cpu-rounds')).toHaveText('1')
})
test('page and carousel transitions animate and honor reduced motion', async ({
  page,
}) => {
  await setup(page, false)
  await expect(page.locator('.page-view')).toHaveCSS(
    'animation-name',
    'page-arrive',
  )
  await page.getByRole('button', { name: '入力へ進む', exact: true }).click()
  await expect(page.locator('.mission-face.is-active')).toHaveCSS(
    'animation-name',
    'mission-slide',
  )
  await expect(page.locator('.mission-face.is-active')).toHaveCSS(
    'transform',
    'none',
  )
  await page.getByRole('button', { name: '練習の記録', exact: true }).click()
  await expect(page.locator('.page-view')).toHaveCSS(
    'animation-name',
    'page-arrive',
  )
  await page.getByRole('button', { name: '環境設定', exact: true }).click()
  await choose(
    page.getByRole('combobox', { name: '画面切り替えのアニメーション' }),
    'system',
  )
  await page.getByRole('button', { name: '設定を閉じる', exact: true }).click()
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await expect(page.locator('.page-view')).toHaveCSS('animation-name', 'none')
  await page.getByRole('button', { name: 'タイピング', exact: true }).click()
  await expect(page.locator('.mission-face.is-active')).toHaveCSS(
    'animation-name',
    'none',
  )
})

test('navigation animates under OS reduced motion, can follow OS or stop, and persists', async ({
  page,
}) => {
  await setup(page)
  const shell = page.locator('.app-shell')
  await expect(shell).toHaveAttribute('data-navigation-motion', 'on')
  // Observe rendered intermediate frames, not merely a CSS animation name.
  const observe = async (selector: string, name: string) => {
    const frames = await page
      .locator(selector)
      .evaluate(async (element, name) => {
        const animation = element
          .getAnimations()
          .find((a) => a instanceof CSSAnimation && a.animationName === name)!
        animation.pause()
        animation.currentTime = 60
        await new Promise(requestAnimationFrame)
        const first = {
          opacity: getComputedStyle(element).opacity,
          transform: getComputedStyle(element).transform,
        }
        animation.currentTime = 140
        await new Promise(requestAnimationFrame)
        const second = {
          opacity: getComputedStyle(element).opacity,
          transform: getComputedStyle(element).transform,
        }
        animation.finish()
        return { first, second }
      }, name)
    expect(Number(frames.first.opacity)).toBeGreaterThan(0)
    if (name === 'page-arrive')
      expect(Number(frames.second.opacity)).toBeGreaterThan(
        Number(frames.first.opacity),
      )
    expect(frames.first.transform).not.toBe(frames.second.transform)
    await expect(page.locator(selector)).toHaveCSS('transform', 'none')
    return frames
  }
  for (const label of [
    '練習の記録',
    'CPU対戦',
    'タイピング',
    '練習の記録',
    'タイピング',
  ]) {
    await page.getByRole('button', { name: label, exact: true }).click()
    await observe('.page-view', 'page-arrive')
    await expect(page.locator('.hero')).toHaveCount(0)
  }
  const height = await page
    .locator('.mission-viewport')
    .evaluate((el) => el.clientHeight)
  await page.getByRole('button', { name: '全文確認へ', exact: true }).click()
  const forward = await observe('.mission-face.is-active', 'mission-slide')
  expect(Number(forward.first.transform.split(',')[4])).toBeGreaterThan(0)
  await page.getByRole('button', { name: '文章選択へ', exact: true }).click()
  const backward = await observe('.mission-face.is-active', 'mission-slide')
  expect(Number(backward.first.transform.split(',')[4])).toBeLessThan(0)
  await expect(page.locator('.mission-sweep')).toHaveCount(0)
  expect(
    await page.locator('.mission-viewport').evaluate((el) => el.clientHeight),
  ).toBe(height)
  const setMode = async (value: string) => {
    await page.getByRole('button', { name: '環境設定', exact: true }).click()
    await choose(
      page.getByRole('combobox', { name: '画面切り替えのアニメーション' }),
      value,
    )
    await page
      .getByRole('button', { name: '設定を閉じる', exact: true })
      .click()
  }
  await setMode('system')
  await page.getByRole('button', { name: '練習の記録', exact: true }).click()
  await expect(page.locator('.page-view')).toHaveCSS('animation-name', 'none')
  await page.emulateMedia({ reducedMotion: 'no-preference' })
  await page.getByRole('button', { name: 'タイピング', exact: true }).click()
  await observe('.page-view', 'page-arrive')
  await setMode('off')
  await page.getByRole('button', { name: '入力へ進む', exact: true }).click()
  await expect(page.locator('.mission-face.is-active')).toHaveCSS(
    'animation-name',
    'none',
  )
  await expect(page.locator('.mission-sweep')).toHaveCount(0)
  await page.getByRole('button', { name: '練習の記録', exact: true }).click()
  await expect(page.locator('.page-view')).toHaveCSS('animation-name', 'none')
  await page.reload()
  await expect(shell).toHaveAttribute('data-navigation-motion', 'off')
  await setMode('on')
  await page.setViewportSize({ width: 390, height: 844 })
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.getByRole('button', { name: '練習の記録', exact: true }).click()
  await observe('.page-view', 'page-arrive')
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true)
})
