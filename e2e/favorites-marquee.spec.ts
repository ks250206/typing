import { expect, test, type Locator, type Page } from '@playwright/test'

const items = [
  { kind: 'practice', passageId: 'rtc-ai-ml-llm', layout: 'jis' },
  {
    kind: 'cpu',
    passageId: 'rtc-ai-ml-llm',
    layout: 'jis',
    cpuConfig: { kpm: 1800, reactionMs: 1500, curve: 'ease-in' },
  },
  { kind: 'practice', passageId: 'etyping-spring', layout: 'jis' },
]

async function setup(page: Page) {
  await page.addInitScript((favorites) => {
    localStorage.setItem(
      'yohaku.settings.v1',
      JSON.stringify({ background: false, navigationMotion: 'off' }),
    )
    localStorage.setItem('galactype.favorites.v1', JSON.stringify(favorites))
  }, items)
  await page.goto('/')
  return page.getByRole('group', { name: 'お気に入り', exact: true })
}

async function positionAt(track: Locator, fraction: number) {
  return track.evaluate((element, progress) => {
    const animation = element.getAnimations()[0]
    animation.pause()
    animation.currentTime =
      Number(animation.effect!.getTiming().duration) * progress
    return new DOMMatrixReadOnly(getComputedStyle(element).transform).m41
  }, fraction)
}

test('each favorite line stays compact and only overflow loops on hover with a snap back', async ({
  page,
}) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  await page.setViewportSize({ width: 1440, height: 1000 })
  await page.emulateMedia({ reducedMotion: 'no-preference' })
  const menu = await setup(page)
  const rows = menu.locator('li')
  const title = rows.nth(1).locator('strong .favorite-marquee')
  const options = rows.nth(1).locator('small .favorite-marquee')
  const track = options.locator('.favorite-marquee-track')
  await expect(title).toHaveAttribute('data-overflow', 'true')
  await expect(options).toHaveAttribute('data-overflow', 'true')
  await expect(rows.nth(2).locator('.favorite-marquee')).toHaveAttribute(
    'data-overflow',
    'false',
  )
  for (const line of await menu.locator('strong, small').all()) {
    await expect(line).toHaveCSS('white-space', 'nowrap')
    expect(
      await line.evaluate(
        (el) =>
          el.getBoundingClientRect().height /
          parseFloat(getComputedStyle(el).lineHeight),
      ),
    ).toBeCloseTo(1, 1)
  }
  await expect(options).toHaveCSS('text-overflow', 'ellipsis')
  await page.screenshot({
    path: 'artifacts/favorites-marquee-desktop.png',
    fullPage: true,
  })
  await rows.nth(1).hover()
  await expect(track).toHaveCSS('animation-name', 'favorite-overflow-marquee')
  expect(await positionAt(track, 0.05)).toBe(0)
  expect(await positionAt(track, 0.6)).toBeLessThan(-5)
  const distance = await options.evaluate((el) =>
    parseFloat(
      (el as HTMLElement).style.getPropertyValue('--marquee-distance'),
    ),
  )
  expect(await positionAt(track, 0.89)).toBeCloseTo(-distance, 1)
  expect(await positionAt(track, 0.92)).toBe(0)
  expect(await positionAt(track, 1.6)).toBeLessThan(-5)
  await positionAt(title.locator('.favorite-marquee-track'), 0.89)
  await page.screenshot({
    path: 'artifacts/favorites-marquee-hover.png',
    fullPage: true,
  })
  await page.mouse.move(600, 300)
  await expect(track).toHaveCSS('animation-name', 'none')
  expect(
    await track.evaluate(
      (el) => new DOMMatrixReadOnly(getComputedStyle(el).transform).m41,
    ),
  ).toBe(0)
  await expect(options).toHaveCSS('text-overflow', 'ellipsis')
  await rows.nth(2).hover()
  await expect(rows.nth(2).locator('.favorite-marquee-track')).toHaveCSS(
    'animation-name',
    'none',
  )

  // Keyboard access reveals the same text. Pointer dragging always resets it.
  await page.mouse.move(600, 300)
  await rows.nth(1).locator('.favorite-open').focus()
  await page.keyboard.press('Tab')
  await expect(track).toHaveCSS('animation-name', 'favorite-overflow-marquee')
  const handle = rows.nth(1).locator('.favorite-drag-handle')
  await handle.hover()
  await page.mouse.down()
  await expect(rows.nth(1)).toHaveAttribute('data-dragging', 'true')
  await expect(track).toHaveCSS('animation-name', 'none')
  await page.keyboard.press('Escape')
  await page.mouse.up()
  await expect(menu.locator('[data-dragging=true]')).toHaveCount(0)
  await rows.nth(1).locator('.favorite-open').click()
  await expect(rows.nth(1)).toHaveAttribute('data-active', 'true')
  await expect(rows.nth(1).locator('.favorite-remove')).toBeVisible()
  expect(errors).toEqual([])
})

test('mobile opening and resizing remeasure overflow without horizontal page scrolling', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 })
  const menu = await setup(page)
  await page
    .getByRole('button', { name: 'お気に入りを表示', exact: true })
    .click()
  const title = menu.locator('li').first().locator('.favorite-marquee')
  await expect(title).toHaveAttribute('data-overflow', 'false')
  await expect(title).toHaveCSS('white-space', 'nowrap')
  await page.screenshot({
    path: 'artifacts/favorites-marquee-mobile.png',
    fullPage: true,
  })
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true)
  await page.setViewportSize({ width: 1440, height: 1000 })
  await expect(title).toHaveAttribute('data-overflow', 'true')
  await page.setViewportSize({ width: 390, height: 844 })
  await expect(title).toHaveAttribute('data-overflow', 'false')
  await menu.locator('.favorite-open').first().click()
  await expect(
    page.getByRole('button', { name: 'お気に入りを表示', exact: true }),
  ).toHaveAttribute('aria-expanded', 'false')
})

test('reduced motion retains ellipsis and complete accessible labels', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1000 })
  await page.emulateMedia({ reducedMotion: 'reduce' })
  const menu = await setup(page)
  const row = menu.locator('li').nth(1)
  await row.hover()
  for (const line of await row.locator('.favorite-marquee').all()) {
    await expect(line).toHaveCSS('text-overflow', 'ellipsis')
    await expect(line.locator('.favorite-marquee-track')).toHaveCSS(
      'animation-name',
      'none',
    )
    await expect(line).toHaveAttribute('title', await line.innerText())
  }
  await expect(row.locator('.favorite-open')).toHaveAccessibleName(
    /RTC風 · AI・機械学習・LLM.*1800 KPM · 1500 ms · イーズイン/,
  )
})
