import { test, expect } from '@playwright/test'
import { mapKey } from '../src/engine'
import { typewellDocument } from '../src/typewell'

const input = async (page: import('@playwright/test').Page) =>
  ((await page.locator('.roman-current').textContent()) ?? '') +
  ((await page.locator('.remaining-roman').textContent()) ?? '')
const choose = async (page: import('@playwright/test').Page) => {
  await page.goto('/')
  await page.getByLabel('3D 背景', { exact: true }).uncheck()
  await page
    .getByRole('button', { name: 'タイプウェル · 基本常用語', exact: true })
    .click()
  await page.getByLabel('シードを固定する').check()
  await page.getByLabel('出題シード').fill('replay-test')
  await page.getByRole('button', { name: 'このシードを使う' }).click()
}
const enter = async (page: import('@playwright/test').Page) => {
  await page.getByRole('button', { name: '入力へ進む', exact: true }).click()
  await expect(page.locator('[data-face="2"]')).toHaveCSS('transform', 'none')
}

test('word sets share the library and mission; seeded R run includes spaces, extra spellings, exact natural 400 cutoff and history replay', async ({
  page,
}) => {
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(e.message))
  await page.clock.install()
  await choose(page)
  await page.getByLabel('入力済み単語を消す', { exact: true }).check()
  await page.screenshot({
    path: 'artifacts/typewell-selection.png',
    fullPage: true,
    animations: 'disabled',
  })
  await page.getByRole('button', { name: '全文を読む', exact: true }).click()
  await expect(page.locator('[data-face="1"]')).toHaveCSS('transform', 'none')
  const preview = await page.locator('#passage-full-text').textContent()
  await enter(page)
  const guide = await input(page)
  expect(guide.length).toBe(400)
  expect(guide).toContain(' ')
  await page.getByRole('button', { name: '400打の計測を開始' }).click()
  await page.clock.runFor(3100)
  await expect(page.getByText('IN THE FLOW', { exact: true })).toBeVisible()
  const area = page.getByRole('region', { name: /タイピング入力/ })
  await area.focus()
  const first = guide[0]
  await page.keyboard.type(first === 'z' ? 'qqqqqq' : 'zzzzzz')
  const alternate = guide.includes('si') ? guide.replace('si', 'shi') : guide
  await page.keyboard.type(alternate.slice(0, -1))
  await expect(page.getByText('SESSION COMPLETE')).toHaveCount(0)
  await expect(page.locator('.reading-toolbar')).toContainText('399 / 400')
  expect(
    await page.locator('.typed-roman [data-consumed="true"]').count(),
  ).toBeGreaterThan(0)
  await page.screenshot({
    path: 'artifacts/typewell-input.png',
    fullPage: true,
    animations: 'disabled',
  })
  await page.keyboard.type(alternate.slice(-1))
  await expect(page.getByText('SESSION COMPLETE')).toBeVisible()
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          JSON.parse(localStorage.getItem('yohaku.history.v1') ?? '[]').length,
      ),
    )
    .toBe(1)
  const records = await page.evaluate(() =>
    JSON.parse(localStorage.getItem('yohaku.history.v1') ?? '[]'),
  )
  expect(records).toHaveLength(1)
  expect(records[0]).toMatchObject({
    keys: 400,
    actualKeys: alternate.length,
    seed: 'replay-test',
    strokeLimit: 400,
    scoreVersion: 3,
    missPenalty: 3.1,
    rawMisses: 6,
  })
  await page.keyboard.type('zzz')
  expect(
    await page.evaluate(
      () =>
        JSON.parse(localStorage.getItem('yohaku.history.v1') ?? '[]').length,
    ),
  ).toBe(1)
  await page.getByRole('button', { name: '練習の記録', exact: true }).click()
  await page.getByRole('button', { name: 'シード replay-test を再現' }).click()
  await expect(page.getByLabel('出題シード')).toHaveValue('replay-test')
  await page.getByRole('button', { name: '全文を読む', exact: true }).click()
  await expect(page.locator('#passage-full-text')).toHaveText(preview!)
  await enter(page)
  expect(await input(page)).toBe(guide)
  await page.getByRole('button', { name: '文章選択へ', exact: true }).click()
  await expect(page.locator('[data-face="0"]')).toHaveCSS('transform', 'none')
  await page.reload()
  await page
    .getByRole('button', { name: 'タイプウェル · 基本常用語', exact: true })
    .click()
  await expect(page.getByLabel('出題シード')).toHaveValue('replay-test')
  await expect(page.getByLabel('シードを固定する')).toBeChecked()
  await page.getByLabel('シードを固定する').uncheck()
  await page.getByRole('button', { name: '単語をシャッフル' }).click()
  await expect(page.getByLabel('出題シード')).not.toHaveValue('replay-test')
  for (const title of ['カタカナ語', '漢字', '慣用句・ことわざ']) {
    await page
      .getByRole('button', { name: `タイプウェル · ${title}`, exact: true })
      .click()
    await expect(
      page.getByRole('heading', {
        name: `タイプウェル · ${title}`,
        exact: true,
      }),
    ).toBeVisible()
  }
  expect(errors).toEqual([])
})

test('kana word set finishes at 280 including separate dakuten keys; mobile has no page overflow', async ({
  page,
}) => {
  await page.clock.install()
  await page.setViewportSize({ width: 390, height: 1000 })
  await choose(page)
  await page.getByLabel('入力方式', { exact: true }).selectOption('kana')
  await enter(page)
  const source = typewellDocument('typewell-basic', 'replay-test')
    .sentences[0].reading.normalize('NFD')
    .slice(0, 280)
  await page.getByRole('button', { name: '280打の計測を開始' }).click()
  await page.clock.runFor(3100)
  await page.getByRole('region', { name: /タイピング入力/ }).focus()
  const physical = new Map<string, { code: string; shiftKey: boolean }>()
  for (const code of [
    'Backquote',
    'Minus',
    'Equal',
    'BracketLeft',
    'BracketRight',
    'Semicolon',
    'Quote',
    'Backslash',
    'IntlRo',
    'IntlYen',
    'Comma',
    'Period',
    'Slash',
    'Space',
    ...Array.from({ length: 10 }, (_, i) => `Digit${i}`),
    ...'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('').map((c) => `Key${c}`),
  ]) {
    for (const shiftKey of [false, true]) {
      const key = mapKey({ code, key: '', shiftKey } as KeyboardEvent, 'kana')
      if (key) physical.set(key, { code, shiftKey })
    }
  }
  const cdp = await page.context().newCDPSession(page)
  const press = async (key: { code: string; shiftKey: boolean }) => {
    if (key.code.startsWith('Intl')) {
      await cdp.send('Input.dispatchKeyEvent', {
        type: 'keyDown',
        code: key.code,
        key: key.code === 'IntlYen' ? '¥' : '\\',
        modifiers: key.shiftKey ? 8 : 0,
      })
      await cdp.send('Input.dispatchKeyEvent', {
        type: 'keyUp',
        code: key.code,
        key: key.code === 'IntlYen' ? '¥' : '\\',
        modifiers: key.shiftKey ? 8 : 0,
      })
    } else
      await page.keyboard.press(`${key.shiftKey ? 'Shift+' : ''}${key.code}`)
  }
  for (const char of source.slice(0, 279)) {
    const key = physical.get(char)!
    expect(key, char).toBeTruthy()
    await press(key)
  }
  await expect(page.locator('.reading-toolbar')).toContainText('279 / 280')
  await page.clock.runFor(250)
  await expect
    .poll(async () => {
      const cursor = await page
        .locator('.current-paragraph .current-token')
        .boundingBox()
      const viewport = await page.locator('.current-paragraph').boundingBox()
      return (
        !!cursor &&
        !!viewport &&
        cursor.x < viewport.x + viewport.width &&
        cursor.x + cursor.width > viewport.x
      )
    })
    .toBe(true)
  await page.screenshot({
    path: 'artifacts/typewell-mobile.png',
    fullPage: true,
    animations: 'disabled',
  })
  const key = physical.get(source[279])!
  await press(key)
  await expect(page.getByText('SESSION COMPLETE')).toBeVisible()
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true)
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          JSON.parse(localStorage.getItem('yohaku.history.v1') ?? '[]').length,
      ),
    )
    .toBe(1)
  const records = await page.evaluate(() =>
    JSON.parse(localStorage.getItem('yohaku.history.v1') ?? '[]'),
  )
  expect(records[0]).toMatchObject({
    keys: 280,
    layout: 'kana',
    strokeLimit: 280,
    seed: 'replay-test',
  })
})
