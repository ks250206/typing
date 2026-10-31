import { expect, test } from '@playwright/test'

test('pages share CPU typography and translucent surfaces at desktop and mobile widths', async ({
  page,
}) => {
  await page.addInitScript(() =>
    localStorage.setItem(
      'yohaku.settings.v1',
      JSON.stringify({ background: false, navigationMotion: 'off' }),
    ),
  )
  await page.goto('/')
  await page.getByRole('button', { name: 'CPU対戦', exact: true }).click()
  const reference = await page.locator('.cpu-battle').evaluate((root) => {
    const title = getComputedStyle(root.querySelector('.page-heading h2')!),
      eyebrow = getComputedStyle(root.querySelector('.page-heading .eyebrow')!)
    return {
      background: getComputedStyle(root).backgroundImage,
      title: [
        title.fontSize,
        title.lineHeight,
        title.fontWeight,
        title.marginTop,
        title.marginBottom,
        title.color,
      ],
      eyebrow: [eyebrow.fontSize, eyebrow.letterSpacing, eyebrow.color],
    }
  })
  expect(reference.background).toContain('0.91')
  for (const width of [1280, 390]) {
    await page.setViewportSize({ width, height: 900 })
    for (const [label, selector] of [
      ['タイピング', '.practice-main'],
      ['練習の記録', '.history-workspace'],
      ['苦手ワード練習', '.weak-workspace'],
    ] as const) {
      await page.getByRole('button', { name: label, exact: true }).click()
      const root = page.locator(selector).first()
      await expect(root.locator('.page-heading .eyebrow')).toBeVisible()
      const appearance = await root.evaluate((root) => {
        const title = getComputedStyle(root.querySelector('.page-heading h2')!),
          eyebrow = getComputedStyle(
            root.querySelector('.page-heading .eyebrow')!,
          )
        return {
          background: getComputedStyle(root).backgroundImage,
          title: [
            title.fontSize,
            title.lineHeight,
            title.fontWeight,
            title.marginTop,
            title.marginBottom,
            title.color,
          ],
          eyebrow: [eyebrow.fontSize, eyebrow.letterSpacing, eyebrow.color],
        }
      })
      expect(appearance).toEqual(reference)
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true)
      await page.screenshot({
        path: `artifacts/page-${selector.slice(1)}-${width}.png`,
        fullPage: true,
        animations: 'disabled',
      })
    }
  }
})
