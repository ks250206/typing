import { expect, test } from '@playwright/test'

for (const width of [1440, 390]) {
  test(`practice favorite registers with default motion and all faces at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 })
    await page.goto('/')
    for (const name of ['文章選択へ', '全文確認へ', '入力へ進む']) {
      await page.getByRole('button', { name, exact: true }).click()
      const add = page.getByRole('button', {
        name: 'お気に入りに登録',
        exact: true,
      })
      await add.click()
      await expect(
        page.getByRole('button', { name: 'お気に入りを解除', exact: true }),
      ).toHaveAttribute('aria-pressed', 'true')
      expect(
        await page.evaluate(
          () =>
            JSON.parse(localStorage.getItem('galactype.favorites.v1') ?? '[]')
              .length,
        ),
      ).toBe(1)
      await page
        .getByRole('button', { name: 'お気に入りを解除', exact: true })
        .click()
      expect(
        await page.evaluate(
          () =>
            JSON.parse(localStorage.getItem('galactype.favorites.v1') ?? '[]')
              .length,
        ),
      ).toBe(0)
    }
  })
}

for (const width of [1440, 390]) {
  test(`document cards register and remove favorites without selecting the document at ${width}px`, async ({
    page,
  }) => {
    const errors: string[] = []
    page.on('pageerror', (error) => errors.push(error.message))
    await page.addInitScript(() =>
      localStorage.setItem(
        'yohaku.settings.v1',
        JSON.stringify({ background: false, navigationMotion: 'off' }),
      ),
    )
    await page.setViewportSize({ width, height: 1000 })
    await page.goto('/')
    const selected = await page
      .locator('.story-card[aria-pressed=true]')
      .getAttribute('aria-label')
    const search = page.getByRole('searchbox', {
      name: '文章を検索',
      exact: true,
    })
    for (const title of ['春の言葉', '大好きなおやつ']) {
      await search.fill(title)
      const button = page.getByRole('button', {
        name: `お気に入りに登録：${title}`,
        exact: true,
      })
      if (title === '春の言葉') {
        await button.focus()
        await page.keyboard.press('Enter')
      } else await button.click()
      await expect(
        page.getByRole('button', {
          name: `お気に入りを解除：${title}`,
          exact: true,
        }),
      ).toHaveAttribute('aria-pressed', 'true')
      await expect(
        page.getByRole('button', { name: title, exact: true }),
      ).toHaveAttribute('aria-pressed', 'false')
    }
    const saved = () =>
      page.evaluate(() =>
        JSON.parse(localStorage.getItem('galactype.favorites.v1') ?? '[]'),
      )
    expect(await saved()).toEqual([
      { kind: 'practice', passageId: 'etyping-spring', layout: 'jis' },
      { kind: 'practice', passageId: 'etyping-favorite-snacks', layout: 'jis' },
    ])
    const toggle = page.getByRole('button', {
      name: 'お気に入りを表示',
      exact: true,
    })
    if (width === 390) await toggle.click()
    const menu = page.getByRole('group', { name: 'お気に入り', exact: true })
    const heading = menu.getByRole('heading', {
      name: 'FAVORITES',
      exact: true,
    })
    await expect(heading).toBeVisible()
    await expect(menu.locator('li')).toHaveCount(2)
    expect(await menu.innerText()).not.toMatch(/QWERTY|JIS|jis/i)
    if (width === 1440) {
      const style = await page
        .locator('.sidebar > .nav-label')
        .evaluate((element) => {
          const style = getComputedStyle(element)
          return {
            fontSize: style.fontSize,
            fontWeight: style.fontWeight,
            color: style.color,
            letterSpacing: style.letterSpacing,
            x: element.getBoundingClientRect().x,
          }
        })
      for (const [name, value] of [
        ['font-size', style.fontSize],
        ['font-weight', style.fontWeight],
        ['color', style.color],
        ['letter-spacing', style.letterSpacing],
      ])
        await expect(heading).toHaveCSS(name, value)
      expect((await heading.boundingBox())!.x).toBe(style.x)
      const divider = page.locator('.sidebar-separator')
      await expect(divider).toBeVisible()
      await expect(divider).toHaveCSS('border-top-width', '1px')
      const nav = (await page.locator('.sidebar > nav').boundingBox())!
      const line = (await divider.boundingBox())!
      expect(line.y).toBeGreaterThan(nav.y + nav.height)
      expect(line.y).toBeLessThan((await heading.boundingBox())!.y)
    }
    await page.screenshot({
      path: `artifacts/favorites-cards-${width}.png`,
      fullPage: true,
      animations: 'disabled',
    })
    if (width === 390) await page.keyboard.press('Escape')
    await page.reload()
    await search.fill('大好きなおやつ')
    await expect(
      page.getByRole('button', {
        name: 'お気に入りを解除：大好きなおやつ',
        exact: true,
      }),
    ).toHaveAttribute('aria-pressed', 'true')
    await page
      .getByRole('button', {
        name: 'お気に入りを解除：大好きなおやつ',
        exact: true,
      })
      .click()
    expect(await saved()).toEqual([
      { kind: 'practice', passageId: 'etyping-spring', layout: 'jis' },
    ])
    await search.fill('')
    await expect(
      page.locator('.story-card[aria-pressed=true]'),
    ).toHaveAttribute('aria-label', selected!)
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true)
    await page.getByRole('button', { name: 'CPU対戦', exact: true }).click()
    if (width === 390) await toggle.click()
    await menu
      .getByRole('button', { name: /お気に入りを開く：タイピング · 春の言葉/ })
      .click()
    await expect(page.locator('.mission-carousel')).toHaveAttribute(
      'data-stage',
      '1',
    )
    await expect(
      page.getByRole('button', { name: '全文確認へ', exact: true }),
    ).toHaveAttribute('aria-current', 'step')
    await expect(page.locator('#passage-full-text li')).toHaveCount(15)
    await expect(page.locator('.favorite-open.active')).toHaveAttribute(
      'aria-current',
      'page',
    )
    await expect(page.locator('.favorite-open.active')).toContainText(
      '春の言葉',
    )
    await expect(
      page.getByRole('button', { name: 'タイピング', exact: true }),
    ).not.toHaveClass(/active/)
    if (width === 390) await toggle.click()
    await page.screenshot({
      path: `artifacts/favorites-preview-${width}.png`,
      fullPage: true,
      animations: 'disabled',
    })
    if (width === 390) await page.keyboard.press('Escape')
    await page.getByRole('button', { name: '文章選択へ', exact: true }).click()
    await expect(
      page.getByRole('button', { name: '春の言葉', exact: true }),
    ).toHaveAttribute('aria-pressed', 'true')
    await page.getByRole('button', { name: 'タイピング', exact: true }).click()
    await expect(
      page.getByRole('button', { name: 'タイピング', exact: true }),
    ).toHaveClass(/active/)
    await expect(page.locator('.favorite-open.active')).toHaveCount(0)
    expect(errors).toEqual([])
  })
}
