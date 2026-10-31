import { expect, test } from '@playwright/test'
import { choose } from './select'
import { startPractice } from './startPractice'
import { physicalType, pressPhysicalKey } from './physicalType'

for (const width of [1440, 390]) {
  test(`NOVA F5-Pair menu, JIS key legends, Shift, feedback and saved settings at ${width}px`, async ({
    page,
  }) => {
    const errors: string[] = []
    page.on('pageerror', (error) => errors.push(error.message))
    await page.setViewportSize({ width, height: 1100 })
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.clock.install()
    await page.addInitScript(() => {
      if (!localStorage.getItem('yohaku.settings.v1')) {
        localStorage.setItem(
          'yohaku.settings.v1',
          JSON.stringify({ background: false, navigationMotion: 'off' }),
        )
      }
    })
    await page.goto('/')
    await choose(page.getByLabel('入力方式', { exact: true }), 'nova-f5-pair')
    await expect(page.getByLabel('入力方式', { exact: true })).toContainText(
      'NOVA F5-Pair',
    )
    await page.reload()
    await expect(page.getByLabel('入力方式', { exact: true })).toHaveAttribute(
      'data-value',
      'nova-f5-pair',
    )
    await page.getByRole('button', { name: '入力へ進む', exact: true }).click()
    await expect(page.locator('.physical-keyboard')).toHaveClass(/is-jis/)
    await expect(page.locator('[data-code="Backquote"] > span')).toHaveText(
      '半角',
    )
    await expect(page.locator('[data-code="IntlYen"] > span')).toHaveText('¥')
    await expect(page.locator('[data-code="IntlYen"] > small')).toHaveText('^')
    await expect(page.locator('[data-code="IntlRo"] > span')).toHaveText('J')
    await expect(page.locator('[data-code="Backslash"] > span')).toHaveText('X')
    await expect(page.locator('[data-code="KeyB"] > small')).toHaveText('\\')
    await expect(page.locator('[data-code="Digit1"] > small')).toHaveCount(0)
    const area = page.getByRole('region', { name: /タイピング入力領域/ })
    await area.focus()
    await startPractice(page, true)
    await page.keyboard.press('Shift+Digit1')
    await expect(page.locator('.miss-stat')).toContainText('0')
    await expect(page.locator('.typed-roman')).toHaveText('')
    await expect(page.locator('[data-code="KeyI"]')).toHaveAttribute(
      'data-state',
      'next',
    )
    await pressPhysicalKey(page, 'IntlYen', true)
    await expect(page.locator('[data-code="IntlYen"]')).toHaveAttribute(
      'data-error',
      'true',
    )
    await expect(page.locator('.miss-stat')).toContainText('1')
    await expect(
      page.locator('[data-code="KeyI"] .next-key-pulse'),
    ).toHaveCount(1)
    await physicalType(page, 'heika', 'nova-f5-pair')
    await expect(page.locator('.typed-roman')).toHaveText('heika')
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true)
    await page.screenshot({
      path: `artifacts/nova-f5-pair-${width}.png`,
      fullPage: true,
      animations: 'disabled',
    })
    expect(errors).toEqual([])
  })
}
