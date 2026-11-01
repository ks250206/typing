import { expect, test, type Locator } from '@playwright/test'
import { startPractice } from './startPractice'
import { choose } from './select'

async function inspectProgress(indicator: Locator) {
  return indicator.evaluate((element) => {
    const svg = element as SVGSVGElement
    const lines = [
      ...svg.querySelectorAll<SVGPathElement>('.perimeter-progress-line'),
    ]
    const glows = [
      ...svg.querySelectorAll<SVGPathElement>('.perimeter-progress-glow'),
    ]
    const fraction = Number(svg.dataset.progress) / 100
    const box = svg.viewBox.baseVal
    const inverse = svg.getCTM()!.inverse()
    const points = lines.map((path) => {
      const matrix = inverse.multiply(path.getCTM()!)
      const p = path
        .getPointAtLength(path.getTotalLength() * fraction)
        .matrixTransform(matrix)
      return { x: p.x, y: p.y }
    })
    const radius =
      parseFloat(getComputedStyle(svg.parentElement!).borderTopLeftRadius) - 1.5
    const first = lines[0]
    const vertical = box.height / 2 - 0.5 - radius
    const corner = [0, 0.5, 1].map((portion) => {
      const point = first.getPointAtLength(
        vertical + (portion * Math.PI * radius) / 2,
      )
      return { x: point.x, y: point.y }
    })
    return {
      width: box.width,
      height: box.height,
      fraction,
      radius,
      points,
      corner,
      lengths: lines.map((path) => path.getTotalLength()),
      offsets: lines.map((path) =>
        parseFloat(getComputedStyle(path).strokeDashoffset),
      ),
      durations: lines.map((path) => getComputedStyle(path).transitionDuration),
      haloMatches: glows.every(
        (path, index) =>
          path.getAttribute('d') === lines[index].getAttribute('d') &&
          path.style.strokeDashoffset === lines[index].style.strokeDashoffset &&
          getComputedStyle(path).strokeLinecap === 'butt' &&
          getComputedStyle(path).filter === 'none',
      ),
      markers: svg.querySelectorAll('circle, ellipse, marker, filter').length,
    }
  })
}

for (const width of [1440, 390]) {
  test(`symmetric perimeter follows rounded corners, pauses, resizes, completes and resets at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 1000 })
    await page.emulateMedia({ reducedMotion: 'reduce' })
    const errors: string[] = []
    page.on('pageerror', (error) => errors.push(error.message))
    await page.clock.install()
    await page.addInitScript(() =>
      localStorage.setItem(
        'yohaku.settings.v1',
        JSON.stringify({ background: false, navigationMotion: 'off' }),
      ),
    )
    await page.goto('/')
    await page
      .getByRole('button', {
        name: '打鍵トレーナー · 高速タイピング',
        exact: true,
      })
      .click()
    await page.getByRole('button', { name: '練習へ進む', exact: true }).click()
    const indicator = page.getByRole('progressbar', {
      name: '練習の進捗',
      exact: true,
    })
    await expect(indicator.locator('.perimeter-progress-line')).toHaveCount(4)
    await expect(indicator).toHaveAttribute('aria-valuenow', '0')
    await expect(indicator.locator('g').first()).toHaveAttribute('opacity', '0')
    await expect(page.locator('.progress-track')).toHaveCount(0)
    const base = await page
      .locator('.practice-main-perimeter')
      .evaluate((el) => getComputedStyle(el).borderColor)
    await page.screenshot({
      path: `artifacts/perimeter-0-${width}.png`,
      fullPage: true,
    })
    await page.clock.pauseAt(await page.evaluate(() => Date.now() + 1000))
    await startPractice(page, true)
    await page.keyboard.type(
      (await page.locator('.roman-current').textContent())!,
    )
    for (const percent of [25, 50, 75]) {
      await page.clock.runFor(15000)
      const state = await inspectProgress(indicator)
      expect(Math.abs(state.fraction * 100 - percent)).toBeLessThan(0.5)
      expect(state.markers).toBe(0)
      expect(state.haloMatches).toBe(true)
      expect(
        Math.max(...state.lengths) - Math.min(...state.lengths),
      ).toBeLessThan(0.001)
      const expectedLength =
        (state.width + state.height) / 2 -
        1 -
        2 * state.radius +
        (Math.PI * state.radius) / 2
      expect(Math.abs(state.lengths[0] - expectedLength)).toBeLessThan(0.1)
      const [lt, rt, lb, rb] = state.points
      expect(Math.abs(lt.x + rt.x - state.width)).toBeLessThan(0.1)
      expect(Math.abs(lb.x + rb.x - state.width)).toBeLessThan(0.1)
      expect(Math.abs(lt.y - rt.y)).toBeLessThan(0.1)
      expect(Math.abs(lb.y - rb.y)).toBeLessThan(0.1)
      expect(Math.abs(lt.y + lb.y - state.height)).toBeLessThan(0.1)
      expect(Math.abs(rt.y + rb.y - state.height)).toBeLessThan(0.1)
      for (const offset of state.offsets)
        expect(Math.abs(offset - (1 - state.fraction))).toBeLessThan(0.0001)
      expect(state.durations).toEqual(['0s', '0s', '0s', '0s'])
      const [start, middle, end] = state.corner
      expect(start.x).toBeCloseTo(0.5, 1)
      expect(start.y).toBeCloseTo(0.5 + state.radius, 1)
      expect(middle.x).toBeCloseTo(0.5 + state.radius * (1 - Math.SQRT1_2), 1)
      expect(middle.y).toBeCloseTo(middle.x, 1)
      expect(end.x).toBeCloseTo(0.5 + state.radius, 1)
      expect(end.y).toBeCloseTo(0.5, 1)
      expect(
        await page
          .locator('.practice-main-perimeter')
          .evaluate((el) => getComputedStyle(el).borderColor),
      ).toBe(base)
      await page.screenshot({
        path: `artifacts/perimeter-${percent}-${width}.png`,
        fullPage: true,
      })
    }
    await page.emulateMedia({ reducedMotion: 'no-preference' })
    await expect(
      indicator.locator('.perimeter-progress-line').first(),
    ).toHaveCSS('transition-duration', '0.16s')
    await page.clock.runFor(50)
    const moving = await inspectProgress(indicator)
    expect(
      Math.max(...moving.offsets) - Math.min(...moving.offsets),
    ).toBeLessThan(0.0001)
    await page.keyboard.press('Escape')
    const paused = await indicator.getAttribute('data-progress')
    await page.clock.runFor(60000)
    await expect(indicator).toHaveAttribute('data-progress', paused!)
    await expect(
      indicator.locator('.perimeter-progress-line').first(),
    ).toHaveCSS('transition-duration', '0s')
    await page.setViewportSize({
      width: width === 1440 ? 1100 : 440,
      height: 900,
    })
    await expect
      .poll(async () => (await inspectProgress(indicator)).width)
      .not.toBe(moving.width)
    if (width === 1440) {
      await page.getByRole('button', { name: '環境設定', exact: true }).click()
      await choose(page.getByLabel('画面の表示倍率', { exact: true }), '125')
      await page
        .getByRole('button', { name: '設定を閉じる', exact: true })
        .click()
    }
    const frame = await indicator.boundingBox()
    const main = await page.locator('.practice-main-perimeter').boundingBox()
    expect(Math.abs(frame!.width - main!.width)).toBeLessThan(3)
    expect(Math.abs(frame!.height - main!.height)).toBeLessThan(3)
    await page.getByRole('region', { name: /タイピング入力領域/ }).focus()
    await page.keyboard.press('Enter')
    await page.clock.runFor(16000)
    await expect(indicator).toHaveAttribute('aria-valuenow', '100')
    const complete = await inspectProgress(indicator)
    for (const p of complete.points)
      expect(p.x).toBeCloseTo(complete.width / 2, 1)
    expect(complete.points[0].y).toBeCloseTo(0.5, 1)
    expect(complete.points[2].y).toBeCloseTo(complete.height - 0.5, 1)
    await expect(page.locator('.mission-face.is-active')).toHaveCSS(
      'opacity',
      '1',
    )
    await expect(page.locator('.session-result')).toHaveCSS('opacity', '1')
    await page.screenshot({
      path: `artifacts/perimeter-100-${width}.png`,
      fullPage: true,
      animations: 'disabled',
    })
    await page.keyboard.press('r')
    await expect(indicator).toHaveAttribute('aria-valuenow', '0')
    await expect(indicator.locator('g').first()).toHaveAttribute('opacity', '0')
    await page.keyboard.press('c')
    await page.getByRole('button', { name: 'CPU対戦', exact: true }).click()
    await expect(indicator).toHaveCount(0)
    await page.setViewportSize({ width, height: 1000 })
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true)
    expect(errors).toEqual([])
  })
}
