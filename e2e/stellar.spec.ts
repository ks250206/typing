import { test, expect } from '@playwright/test'
import { RomanEngine } from '../src/engine'
import { sentencesByPassage } from '../src/sentences'

test('integrated guides track alternate spellings, misses, transitions and resets', async ({
  page,
}) => {
  await page.goto('/')
  await page.getByRole('button', { name: '入力へ進む', exact: true }).click()
  await expect(page.locator('[data-face="2"]')).toHaveCSS('transform', 'none')
  await page.getByLabel('3D 背景', { exact: true }).uncheck()
  const area = page.getByRole('region')
  await expect(page.locator('.input-dock')).toHaveCount(0)
  await expect(page.getByText(/現在の読み/)).toHaveCount(0)
  await expect(page.locator('.prose .kana-line')).toHaveCount(1)
  await expect(page.locator('.prose .roman-line')).toHaveCount(1)
  const ordering = await page.locator('.prose').evaluate((el) => {
    const main = el.querySelector('.current-paragraph')!.getBoundingClientRect()
    const kana = el.querySelector('.kana-line')!.getBoundingClientRect()
    const roman = el.querySelector('.roman-line')!.getBoundingClientRect()
    const next = el.querySelector('.next-sentence')!.getBoundingClientRect()
    return (
      main.bottom <= kana.top &&
      kana.bottom <= roman.top &&
      roman.bottom <= next.top
    )
  })
  expect(ordering).toBe(true)
  const guideTop = await page
    .locator('.sentence-guides')
    .evaluate((el) => el.getBoundingClientRect().top + scrollY)
  const current = page.locator('.kana-line .guide-current')
  await area.focus()
  const input = 'heikannohousougaowaruto,tosilyo'
  await page.keyboard.type(input)
  await expect(page.locator('.typed-roman')).toHaveText(input)
  await expect(current).toHaveText('し')
  await expect(page.locator('[aria-current="location"]')).toHaveText('図書室')
  expect(
    await page
      .locator('.sentence-guides')
      .evaluate((el) => el.getBoundingClientRect().top + scrollY),
  ).toBe(guideTop)
  const model = new RomanEngine(sentencesByPassage['night-library'][0].reading)
  for (const key of input) expect(model.feed(key)).toBe(true)
  await expect(page.locator('.roman-current')).toHaveText(model.hint[0])
  await page.keyboard.type('z')
  await expect(current).toHaveText('し')
  await expect(page.locator('.typed-roman')).toHaveText(input)
  await page.keyboard.type(model.hint)
  await expect(page.locator('.typed-roman')).toHaveText('')
  await expect(current).toHaveText('ま')
  await expect(page.locator('.current-paragraph')).toHaveAttribute(
    'data-text',
    sentencesByPassage['night-library'][1].text,
  )
  await page.getByRole('button', { name: 'やり直す', exact: true }).click()
  await expect(current).toHaveText('へ')
  await expect(page.locator('.roman-current')).toHaveText('h')
  await expect(page.getByLabel('入力ガイド', { exact: true })).toHaveCount(0)
  await expect(page.locator('.roman-line')).toHaveCount(1)
  await expect(page.locator('.kana-line')).toBeVisible()
  await page.getByLabel('入力方式', { exact: true }).selectOption('kana')
  await expect(page.locator('.roman-line')).toHaveCount(0)
  await area.focus()
  for (const key of [
    'Equal',
    'KeyE',
    'KeyT',
    'KeyY',
    'KeyK',
    'Minus',
    'Digit4',
    'KeyC',
    'Digit4',
    'KeyT',
  ])
    await page.keyboard.press(key)
  await expect(current).toHaveText('が')
  await expect(page.locator('.typed-kana')).toHaveText('へいかんのほうそう')
  await page.keyboard.press('BracketLeft')
  await expect(current).toHaveText('お')
})

test('damage covers the viewport, never blocks typing, clears and respects reduced motion', async ({
  page,
}) => {
  await page.goto('/')
  await page.getByRole('button', { name: '入力へ進む', exact: true }).click()
  await expect(page.locator('[data-face="2"]')).toHaveCSS('transform', 'none')
  await page.getByLabel('3D 背景', { exact: true }).uncheck()
  const area = page.getByRole('region')
  const damage = page.locator('.damage-overlay')
  await area.focus()
  await page.keyboard.type('zzzz')
  await expect(damage).toHaveCount(1)
  const layout = await damage.evaluate((el) => {
    const r = el.getBoundingClientRect()
    return {
      covers: r.width === innerWidth && r.height === innerHeight,
      pointerEvents: getComputedStyle(el).pointerEvents,
    }
  })
  expect(layout).toEqual({ covers: true, pointerEvents: 'none' })
  await page.keyboard.type('he')
  await expect(page.locator('.typed-roman')).toHaveText('he')
  await page.keyboard.press('Escape')
  await expect(damage).toHaveCount(0)
  await page.getByRole('button', { name: '再開する' }).click()
  await expect(area).toBeFocused()
  await page.keyboard.type('z')
  await expect(damage).toHaveCount(1)
  await expect(damage).toHaveCount(0, { timeout: 2000 })
  await page.keyboard.type('z')
  await page.getByRole('button', { name: 'やり直す', exact: true }).click()
  await expect(damage).toHaveCount(0)
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await area.focus()
  await page.keyboard.type('z')
  await expect(damage).toHaveCSS('animation-name', 'none')
  await expect(damage).toHaveCSS('background-image', 'none')
  await expect(page.locator('.damage-label')).toBeHidden()
  await page.keyboard.press('Escape')
  await expect(damage).toHaveCount(0)
})

test('stellar scene animates, freezes on reduced motion, resizes and releases its canvas', async ({
  page,
}) => {
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(e.message))
  await page.setViewportSize({ width: 1440, height: 1100 })
  await page.goto('/')
  await page.getByRole('button', { name: '入力へ進む', exact: true }).click()
  await expect(page.locator('[data-face="2"]')).toHaveCSS('transform', 'none')
  const scene = page.locator('.space-scene')
  await expect(scene).toHaveAttribute('data-rendering', 'webgl')
  const first = await scene.screenshot()
  await page.waitForTimeout(350) // Sample actual animation across two rendered frames.
  expect((await scene.screenshot()).equals(first)).toBe(false)
  await page.getByRole('region').focus()
  await page.keyboard.type('heikanno')
  await expect(page.locator('.typed-roman')).toHaveText('heikanno')
  await expect(page.locator('[aria-current="location"]')).toHaveText('放送')
  await page.keyboard.press('Escape')
  await page.emulateMedia({ reducedMotion: 'reduce' })
  const still = await scene.screenshot()
  await page.waitForTimeout(150)
  expect((await scene.screenshot()).equals(still)).toBe(true)
  await page.setViewportSize({ width: 390, height: 844 })
  await expect
    .poll(() =>
      page
        .locator('.space-scene canvas')
        .evaluate((el) => (el as HTMLCanvasElement).width),
    )
    .toBe(390)
  await page.screenshot({
    path: 'artifacts/stellar-mobile.png',
    fullPage: true,
  })
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true)
  await page.getByLabel('3D 背景', { exact: true }).uncheck()
  await expect(scene).toHaveCount(0)
  await page.getByLabel('3D 背景', { exact: true }).check()
  await expect(page.locator('.space-scene canvas')).toHaveCount(1)
  await expect(scene).toHaveAttribute('data-rendering', 'webgl')
  expect(errors).toEqual([])
})

test('CSS planets remain visible when WebGL is unavailable', async ({
  page,
}) => {
  await page.addInitScript(() => {
    const getContext = HTMLCanvasElement.prototype.getContext
    HTMLCanvasElement.prototype.getContext = function (type, ...args) {
      if (
        type === 'webgl' ||
        type === 'webgl2' ||
        type === 'experimental-webgl'
      )
        return null
      return Reflect.apply(getContext, this, [type, ...args])
    } as typeof getContext
  })
  await page.goto('/')
  await page.getByRole('button', { name: '入力へ進む', exact: true }).click()
  await expect(page.locator('[data-face="2"]')).toHaveCSS('transform', 'none')
  await expect(page.locator('.space-fallback')).toBeVisible()
  await expect(page.locator('.space-scene canvas')).toHaveCount(0)
  await page.getByRole('region').focus()
  await page.keyboard.type('hei')
  await expect(page.locator('.typed-roman')).toHaveText('hei')
  await page.getByLabel('3D 背景', { exact: true }).uncheck()
  await expect(page.locator('.space-fallback')).toHaveCount(0)
})

test('word-spaced guides are large, label-free and close to the main text on desktop and mobile', async ({
  page,
}) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  await page.goto('/')
  await page.getByRole('button', { name: '入力へ進む', exact: true }).click()
  await expect(page.locator('[data-face="2"]')).toHaveCSS('transform', 'none')
  await page.getByLabel('3D 背景', { exact: true }).uncheck()
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 1000 })
    await expect(page.locator('.guide-label')).toHaveCount(0)
    for (const selector of [
      '.current-paragraph',
      '.kana-line',
      '.roman-line',
    ]) {
      const gaps = page.locator(`${selector} .word-start`)
      expect(await gaps.count()).toBeGreaterThan(5)
      expect(
        await gaps
          .first()
          .evaluate((el) => parseFloat(getComputedStyle(el).marginInlineStart)),
      ).toBeGreaterThan(4)
    }
    const layout = await page.locator('.prose').evaluate((el) => {
      const main = el
        .querySelector('.current-paragraph')!
        .getBoundingClientRect()
      const kana = el.querySelector('.kana-line')!
      const roman = el.querySelector('.roman-line')!
      return {
        gap: kana.getBoundingClientRect().top - main.bottom,
        aligned:
          Math.abs(kana.getBoundingClientRect().left - main.left - 8) < 1,
        kanaSize: parseFloat(getComputedStyle(kana).fontSize),
        romanSize: parseFloat(getComputedStyle(roman).fontSize),
        overflow: document.documentElement.scrollWidth > innerWidth,
      }
    })
    expect(layout.gap).toBeLessThanOrEqual(4)
    expect(layout.aligned).toBe(true)
    expect(layout.kanaSize).toBeGreaterThanOrEqual(18)
    expect(layout.romanSize).toBeGreaterThanOrEqual(18)
    expect(layout.overflow).toBe(false)
    await page.screenshot({
      path: `artifacts/word-guides-${width}.png`,
      fullPage: true,
    })
  }
  await page.getByRole('region').focus()
  await page.keyboard.type('heikannnohousougaowaruto,tosilyo')
  await expect(page.locator('.typed-roman')).toHaveText(
    'heikannnohousougaowaruto,tosilyo',
  )
  await expect(page.locator('.kana-line .guide-current')).toHaveText('し')
  await expect(page.locator('[aria-current="location"]')).toHaveText('図書室')
  await expect(page.locator('.damage-overlay')).toHaveCount(0)
  expect(errors).toEqual([])
})
