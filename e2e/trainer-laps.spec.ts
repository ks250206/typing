import { test, expect } from '@playwright/test'
import data from '../src/data/generated/trainers.json' with { type: 'json' }
import { createTrainerOrder, sakusakuEntries } from '../src/domain/content/sakusaku'
import { RomanEngine } from '../src/domain/typing/engine'
import { startPractice } from './startPractice'

test('trainer previews only lap one, then plays three separately shuffled full laps and saves v2', async ({
  page,
}) => {
  test.setTimeout(120000)
  await page.clock.install()
  await page.addInitScript(() =>
    localStorage.setItem(
      'yohaku.settings.v1',
      JSON.stringify({ background: false, navigationMotion: 'off' }),
    ),
  )
  await page.goto('/')
  const library = page.getByRole('region', {
    name: '文章ライブラリ',
    exact: true,
  })
  for (const [category, count] of [
    ['オリジナル文章', 6],
    ['公的文書', 2],
    ['タイプウェル', 5],
  ] as const) {
    await library.getByRole('button', { name: category, exact: true }).click()
    await expect(library.locator('.story-card')).toHaveCount(count)
  }
  await expect(
    library.getByRole('button', { name: 'タイプウェル準拠', exact: true }),
  ).toHaveCount(0)
  await library
    .getByRole('button', { name: '60秒トレーナー', exact: true })
    .click()
  await page
    .getByRole('button', {
      name: '打鍵トレーナー · 高速タイピング',
      exact: true,
    })
    .click()
  await page.getByLabel('シードを固定する', { exact: true }).check()
  await page.getByLabel('出題シード', { exact: true }).fill('three-laps')
  await page
    .getByRole('button', { name: 'このシードを使う', exact: true })
    .click()
  const set = data.find((s) => s.id === 'trainer-high-speed')!
  const next = createTrainerOrder('three-laps', set.entries.length)
  const order = Array.from({ length: set.entries.length * 3 }, () => next())
  await page.getByRole('button', { name: '全文を読む', exact: true }).click()
  const rows = page.locator('#passage-full-text li')
  await expect(rows).toHaveCount(18)
  for (let i = 0; i < 18; i++)
    expect(
      (await rows.nth(i).locator('.token-text').allTextContents()).join(''),
    ).toBe(set.entries[order[i]][0])
  await page.getByRole('button', { name: '入力へ進む', exact: true }).click()
  await page.clock.pauseAt(
    new Date(await page.evaluate(() => Date.now() + 10000)),
  )
  await startPractice(page, true)
  let keys = 0
  for (const index of order) {
    const [text, reading] = set.entries[index]
    await expect(page.locator('.current-paragraph')).toHaveAttribute(
      'data-text',
      text as string,
    )
    const input = new RomanEngine(reading as string).hint
    await page.clock.runFor(100)
    await page.keyboard.type(input)
    keys += input.length
  }
  for (let lap = 0; lap < 3; lap++)
    expect(new Set(order.slice(lap * 18, (lap + 1) * 18)).size).toBe(18)
  expect(order.slice(18, 36)).not.toEqual(order.slice(0, 18))
  await page.clock.runFor(60050)
  await expect(page.getByText('TIME UP', { exact: true })).toBeVisible()
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          JSON.parse(localStorage.getItem('yohaku.history.v1') ?? '[]').length,
      ),
    )
    .toBe(1)
  expect(
    await page.evaluate(
      () => JSON.parse(localStorage.getItem('yohaku.history.v1')!)[0],
    ),
  ).toMatchObject({ keys, replayVersion: 2, seed: 'three-laps' })
  await page.getByRole('button', { name: '練習の記録', exact: true }).click()
  await page
    .getByRole('button', { name: 'シード three-laps を再現', exact: true })
    .click()
  await page.getByRole('button', { name: '全文を読む', exact: true }).click()
  await expect(rows).toHaveCount(18)
  expect(
    (await rows.first().locator('.token-text').allTextContents()).join(''),
  ).toBe(set.entries[order[0]][0])
})

test('a saved v1 trainer seed still recreates its original stream', async ({
  page,
}) => {
  await page.addInitScript(() => {
    localStorage.setItem(
      'yohaku.settings.v1',
      JSON.stringify({ background: false, navigationMotion: 'off' }),
    )
    localStorage.setItem(
      'yohaku.history.v1',
      JSON.stringify([
        {
          id: 'legacy-trainer',
          passageId: 'sakusaku-trainer',
          title: '打鍵トレーナー · さくさくタイピング',
          date: new Date().toISOString(),
          layout: 'jis',
          elapsed: 60000,
          keys: 1,
          misses: 0,
          kpm: 1,
          accuracy: 100,
          seed: 'retro',
          replayVersion: 1,
          mode: 'trainer',
        },
      ]),
    )
  })
  await page.goto('/')
  await page.getByRole('button', { name: '練習の記録', exact: true }).click()
  await page
    .getByRole('button', { name: 'シード retro を再現', exact: true })
    .click()
  await expect(
    page.getByText('旧記録の出題方式（v1）を再現しています。'),
  ).toBeVisible()
  await page.getByRole('button', { name: '入力へ進む', exact: true }).click()
  await expect(page.locator('.current-paragraph')).toHaveAttribute(
    'data-text',
    sakusakuEntries[createTrainerOrder('retro', 15, 1)()][0],
  )
})
