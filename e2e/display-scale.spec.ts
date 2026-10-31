import { expect, test } from '@playwright/test'
import { choose } from './select'
for (const width of [1280, 400]) {
  test(`display scale persists and controls remain usable at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 })
    await page.addInitScript(() => {
      if (!localStorage.getItem('yohaku.settings.v1'))
        localStorage.setItem(
          'yohaku.settings.v1',
          JSON.stringify({ background: false, navigationMotion: 'off' }),
        )
    })
    await page.goto('/')
    await page.getByRole('button', { name: '環境設定', exact: true }).click()
    const scale = page.getByRole('combobox', { name: '画面の表示倍率' })
    for (const value of ['150', '75', '125']) {
      await choose(scale, value)
      await expect(page.locator('html')).toHaveCSS(
        'zoom',
        String(Number(value) / 100),
      )
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth + 1,
        ),
      ).toBe(true)
      await scale.click()
      const list = await page.getByRole('listbox').boundingBox()
      const trigger = await scale.boundingBox()
      expect(list!.x).toBeGreaterThanOrEqual(0)
      expect(list!.x + list!.width).toBeLessThanOrEqual(width + 1)
      expect(Math.abs(list!.x - trigger!.x)).toBeLessThan(20)
      await page.keyboard.press('Escape')
    }
    await page.screenshot({
      path: `artifacts/display-scale-${width}.png`,
      fullPage: true,
    })
    await page.reload()
    await expect(page.locator('html')).toHaveCSS('zoom', '1.25')
    await page.getByRole('button', { name: '環境設定', exact: true }).click()
    await page.getByRole('button', { name: '100%に戻す', exact: true }).click()
    await expect(page.locator('html')).toHaveCSS('zoom', '1')
    await page
      .getByRole('button', { name: '設定を閉じる', exact: true })
      .click()
    await expect(page.getByRole('dialog')).toHaveCount(0)
  })
}

import { startPractice } from './startPractice'
import { sentencesByPassage } from '../src/domain/content/sentences'
import { RomanEngine } from '../src/domain/typing/engine'
for (const displayScale of [75, 150]) {
  test(`typing cursor stays visible at ${displayScale}%`, async ({ page }) => {
    await page.clock.install()
    await page.addInitScript(
      (displayScale) =>
        localStorage.setItem(
          'yohaku.settings.v1',
          JSON.stringify({
            background: false,
            navigationMotion: 'off',
            displayScale,
          }),
        ),
      displayScale,
    )
    await page.goto('/')
    await page
      .getByRole('button', { name: 'キュリー夫人', exact: true })
      .click()
    await page.getByRole('button', { name: '入力へ進む', exact: true }).click()
    await startPractice(page, true)
    await page.keyboard.type(
      new RomanEngine(sentencesByPassage['theme-curie'][0].reading).hint.slice(
        0,
        180,
      ),
    )
    await page.clock.runFor(500)
    for (const selector of ['.kana-line', '.roman-line']) {
      await expect
        .poll(() =>
          page.locator(selector).evaluate((line) => {
            const cursor = line
              .querySelector('[data-guide-cursor], .roman-current')!
              .getBoundingClientRect()
            const box = line.getBoundingClientRect()
            return cursor.left >= box.left - 1 && cursor.right <= box.right + 1
          }),
        )
        .toBe(true)
    }
  })
}
