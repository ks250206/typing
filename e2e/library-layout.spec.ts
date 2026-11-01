import { expect, test } from '@playwright/test'

for (const width of [1440, 390]) {
  for (const mode of ['通常練習', '一文練習']) {
    test(`${mode} library groups language on the left and search on the right at ${width}px`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height: 1000 })
      const errors: string[] = []
      page.on('pageerror', (error) => errors.push(error.message))
      page.on('console', (message) => {
        if (message.type() === 'error') errors.push(message.text())
      })
      await page.addInitScript(() =>
        localStorage.setItem(
          'yohaku.settings.v1',
          JSON.stringify({ background: false, navigationMotion: 'off' }),
        ),
      )
      await page.goto('/')
      await page.getByRole('button', { name: mode, exact: true }).click()
      const library = page.getByRole('region', {
        name: '文章ライブラリ',
        exact: true,
      })
      const language = library.getByRole('group', {
        name: '文章の言語',
        exact: true,
      })
      const search = library.getByRole('searchbox', {
        name: '文章を検索',
        exact: true,
      })
      const heading = library.getByRole('heading', {
        name: '文章ライブラリ',
        exact: true,
      })
      expect(
        await heading.evaluate((el) =>
          parseFloat(getComputedStyle(el).fontSize),
        ),
      ).toBeGreaterThanOrEqual(width > 600 ? 24 : 20)
      const left = await language.boundingBox()
      const right = await library.locator('.library-search').boundingBox()
      expect(
        Math.abs(left!.y + left!.height / 2 - (right!.y + right!.height / 2)),
      ).toBeLessThan(2)
      expect(left!.x + left!.width).toBeLessThan(right!.x)
      expect((await heading.boundingBox())!.y).toBeLessThan(left!.y)
      expect(
        await library.locator('.library-toolbar').getByRole('group').count(),
      ).toBe(1)
      await page.screenshot({
        path: `artifacts/library-${mode === '通常練習' ? 'normal' : 'sentence'}-${width}.png`,
        fullPage: true,
        animations: 'disabled',
      })
      await search.fill('一致しない文章検索')
      await expect(library.getByRole('status')).toContainText(
        '一致する文章がありません',
      )
      await expect(library.locator('.story-card')).toHaveCount(0)
      const english = language.getByRole('button', {
        name: 'English',
        exact: true,
      })
      await english.focus()
      await page.keyboard.press('Enter')
      await expect(english).toHaveAttribute('aria-pressed', 'true')
      await expect(english).toBeFocused()
      await expect(search).toHaveValue('')
      await expect(library.locator('.story-card')).toHaveCount(29)
      await search.fill('Quiet Library')
      await expect(library.locator('.story-card')).toHaveCount(1)
      await expect(
        library.getByRole('button', { name: 'The Quiet Library', exact: true }),
      ).toBeVisible()
      await search.fill('')
      await library
        .getByRole('button', { name: 'オリジナル長文', exact: true })
        .click()
      await expect(library.locator('.story-card')).toHaveCount(2)
      await language
        .getByRole('button', { name: '日本語', exact: true })
        .click()
      await expect(search).toHaveValue('')
      await expect(
        library.getByRole('button', { name: 'すべて', exact: true }),
      ).toHaveAttribute('aria-pressed', 'true')
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true)
      expect(errors).toEqual([])
    })
  }
}
