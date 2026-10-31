import { expect, test, type Page } from '@playwright/test'
import { choose } from './select'
import { startPractice } from './startPractice'

const favorites = [
  { kind: 'practice', passageId: 'night-library', layout: 'jis' },
  { kind: 'practice', passageId: 'etyping-spring', layout: 'jis' },
  {
    kind: 'cpu',
    passageId: 'cpu-rtc',
    layout: 'jis',
    cpuConfig: { kpm: 100, reactionMs: 1500, curve: 'constant' },
  },
]
const savedOrder = (page: Page) =>
  page.evaluate(() =>
    JSON.parse(localStorage.getItem('galactype.favorites.v1') ?? '[]').map(
      (entry: { passageId: string }) => entry.passageId,
    ),
  )
async function setup(page: Page) {
  await page.addInitScript((items) => {
    localStorage.setItem(
      'yohaku.settings.v1',
      JSON.stringify({ background: false, navigationMotion: 'off' }),
    )
    if (!localStorage.getItem('galactype.favorites.v1'))
      localStorage.setItem('galactype.favorites.v1', JSON.stringify(items))
  }, favorites)
  await page.goto('/')
}

test('favorites drag order persists, cancels safely and synchronizes without navigation', async ({
  page,
  context,
}) => {
  await page.setViewportSize({ width: 1440, height: 1000 })
  await page.emulateMedia({ reducedMotion: 'no-preference' })
  await setup(page)
  const menu = page.getByRole('group', { name: 'お気に入り', exact: true })
  const handles = menu.locator('.favorite-drag-handle')
  const first = (await handles.nth(0).boundingBox())!
  const last = (await handles.nth(2).boundingBox())!
  const workspace = page.getByRole('button', {
    name: 'タイピング',
    exact: true,
  })
  await workspace.hover()
  const hoverBackground = await workspace.evaluate(
    (el) => getComputedStyle(el).backgroundImage,
  )
  await menu.locator('li').first().hover()
  await expect(menu.locator('li').first()).toHaveCSS(
    'background-image',
    hoverBackground,
  )
  await page.mouse.move(first.x + first.width / 2, first.y + first.height / 2)
  await page.mouse.down()
  await expect(menu).toBeFocused()
  await expect(menu).toHaveCSS('outline-width', '0px')
  await expect(handles.nth(0)).not.toBeFocused()
  await expect(menu.locator('li[data-dragging=true]')).not.toHaveCSS(
    'box-shadow',
    'none',
  )
  await page.mouse.move(last.x + last.width / 2, last.y + last.height / 2)
  expect(
    await menu
      .locator('li')
      .evaluateAll((rows) =>
        rows
          .flatMap((row) => row.getAnimations())
          .some(
            (animation) =>
              animation.effect instanceof KeyframeEffect &&
              animation.effect
                .getKeyframes()
                .some(
                  (frame) =>
                    typeof frame.transform === 'string' &&
                    frame.transform.includes('translateY'),
                ),
          ),
      ),
  ).toBe(true)
  await page.screenshot({
    path: 'artifacts/favorites-reorder-desktop.png',
    fullPage: true,
    animations: 'disabled',
  })
  // Preview is local until the pointer is released.
  expect(await savedOrder(page)).toEqual([
    'night-library',
    'etyping-spring',
    'cpu-rtc',
  ])
  await page.mouse.up()
  expect(await savedOrder(page)).toEqual([
    'etyping-spring',
    'cpu-rtc',
    'night-library',
  ])
  await expect(page.locator('.mission-carousel')).toHaveAttribute(
    'data-stage',
    '0',
  )
  const other = await context.newPage()
  await other.goto('/')
  await menu
    .getByRole('button', { name: /お気に入りを開く：タイピング · 春の言葉/ })
    .click()
  const seed = await page.getByLabel('出題シード', { exact: true }).inputValue()
  await handles.nth(0).focus()
  await page.keyboard.press('End')
  expect(await savedOrder(page)).toEqual([
    'cpu-rtc',
    'night-library',
    'etyping-spring',
  ])
  await page.keyboard.press('ArrowUp')
  expect(await savedOrder(page)).toEqual([
    'cpu-rtc',
    'etyping-spring',
    'night-library',
  ])
  await page.keyboard.press('ArrowDown')
  expect(await savedOrder(page)).toEqual([
    'cpu-rtc',
    'night-library',
    'etyping-spring',
  ])
  await expect(page.locator('.mission-carousel')).toHaveAttribute(
    'data-stage',
    '1',
  )
  expect(
    await page.getByLabel('出題シード', { exact: true }).inputValue(),
  ).toBe(seed)
  await expect(page.locator('.favorite-open.active')).toContainText('春の言葉')
  await expect
    .poll(() => other.locator('.favorite-open strong').allTextContents())
    .toEqual(['RTCオリジナル', '夜更けの図書室', '春の言葉'])
  await page.emulateMedia({ reducedMotion: 'reduce' })
  const source = (await handles.nth(0).boundingBox())!
  const target = (await handles.nth(2).boundingBox())!
  await page.mouse.move(
    source.x + source.width / 2,
    source.y + source.height / 2,
  )
  await page.mouse.down()
  await page.mouse.move(
    target.x + target.width / 2,
    target.y + target.height / 2,
    { steps: 20 },
  )
  expect(
    await menu
      .locator('li')
      .evaluateAll((rows) => rows.flatMap((row) => row.getAnimations()).length),
  ).toBe(0)
  await page.keyboard.press('Escape')
  await page.mouse.up()
  expect(await savedOrder(page)).toEqual([
    'cpu-rtc',
    'night-library',
    'etyping-spring',
  ])
  await page.reload()
  await expect(menu.locator('.favorite-open strong')).toHaveText([
    'RTCオリジナル',
    '夜更けの図書室',
    '春の言葉',
  ])
  await other.close()
})

test.describe('touch ordering', () => {
  test.use({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  })
  test('a touch drag reorders favorites without opening a document', async ({
    page,
  }) => {
    await setup(page)
    await page
      .getByRole('button', { name: 'お気に入りを表示', exact: true })
      .click()
    const handles = page.locator('.favorite-drag-handle')
    const first = (await handles.nth(0).boundingBox())!
    const last = (await handles.nth(2).boundingBox())!
    const x = first.x + first.width / 2
    const startY = first.y + first.height / 2
    const endY = last.y + last.height / 2
    const cdp = await page.context().newCDPSession(page)
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchStart',
      touchPoints: [{ x, y: startY, id: 1 }],
    })
    for (let step = 1; step <= 12; step++)
      await cdp.send('Input.dispatchTouchEvent', {
        type: 'touchMove',
        touchPoints: [{ x, y: startY + ((endY - startY) * step) / 12, id: 1 }],
      })
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchEnd',
      touchPoints: [],
    })
    expect(await savedOrder(page)).toEqual([
      'etyping-spring',
      'cpu-rtc',
      'night-library',
    ])
    await expect(page.locator('.mission-carousel')).toHaveAttribute(
      'data-stage',
      '0',
    )
    await page.screenshot({
      path: 'artifacts/favorites-reorder-mobile.png',
      fullPage: true,
      animations: 'disabled',
    })
    await page.reload()
    await page
      .getByRole('button', { name: 'お気に入りを表示', exact: true })
      .click()
    await expect(page.locator('.favorite-open strong')).toHaveText([
      '春の言葉',
      'RTCオリジナル',
      '夜更けの図書室',
    ])
    await cdp.detach()
  })
})

for (const width of [1440, 390]) {
  test(`CPU and practice use the same pause presentation and resume controls at ${width}px`, async ({
    page,
  }) => {
    const errors: string[] = []
    page.on('pageerror', (error) => errors.push(error.message))
    await page.clock.install()
    await page.setViewportSize({ width, height: 900 })
    await setup(page)
    await page.getByRole('button', { name: 'CPU対戦', exact: true }).click()
    await choose(page.getByLabel('CPUプリセット', { exact: true }), 'カメ')
    await page
      .getByRole('button', { name: 'CPUと対戦する', exact: true })
      .click()
    await page.clock.runFor(3100)
    const arena = page.getByRole('region', {
      name: 'CPU対戦の入力領域',
      exact: true,
    })
    await expect(arena).toHaveCSS('outline-width', '0px')
    await page.keyboard.type(
      (await page.locator('.roman-current').textContent())!,
    )
    await expect(arena).toHaveCSS('outline-width', '0px')
    const overlay = page.getByRole('group', { name: '一時停止中', exact: true })
    await page.keyboard.press('Escape')
    await expect(overlay).toBeVisible()
    await expect(overlay).toContainText('PAUSED')
    await expect(arena).toHaveCSS('outline-width', '0px')
    await expect(overlay).toContainText(
      'Space / Esc / Enter で再開 · R でやり直す',
    )
    const stats = await page.locator('.session-card').innerText()
    await page.clock.runFor(5000)
    expect(await page.locator('.session-card').innerText()).toBe(stats)
    await page.screenshot({
      path: `artifacts/cpu-pause-${width}.png`,
      fullPage: true,
    })
    await overlay.getByRole('button', { name: '再開する', exact: true }).click()
    await expect(overlay).toHaveCount(0)
    for (const key of ['Enter', 'Space', 'Escape']) {
      await page.getByRole('button', { name: '一時停止', exact: true }).click()
      await expect(overlay).toBeVisible()
      await page.keyboard.press(key)
      await expect(overlay).toHaveCount(0)
    }
    await page.getByRole('button', { name: 'タイピング', exact: true }).click()
    await page.getByRole('button', { name: '入力へ進む', exact: true }).click()
    await startPractice(page, true)
    await page.keyboard.press('Escape')
    await expect(overlay).toBeVisible()
    await expect(
      overlay.getByRole('button', { name: '再開する', exact: true }),
    ).toHaveClass('practice-start-button')
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true)
    expect(errors).toEqual([])
  })
}
