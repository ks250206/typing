import { test, expect } from '@playwright/test'
import data from '../src/data/trainers.json' with { type: 'json' }
import { createTrainerOrder } from '../src/sakusaku'
import { RomanEngine } from '../src/engine'
import { choose } from './select'
import { startPractice } from './startPractice'

for (const set of data) {
  test(`${set.title}: complete HTML corpus, seeded timer record, replay, ghost and CPU selection`, async ({
    page,
  }) => {
    await page.clock.install()
    await page.addInitScript(() =>
      localStorage.setItem(
        'yohaku.settings.v1',
        JSON.stringify({ background: false, navigationMotion: 'off' }),
      ),
    )
    await page.goto('/')
    await page
      .getByRole('button', { name: '60秒トレーナー', exact: true })
      .click()
    await expect(page.locator('.story-card')).toHaveCount(3)
    const title = `打鍵トレーナー · ${set.title}`
    const card = page.getByRole('button', { name: title, exact: true })
    await expect(card).toContainText(
      `${set.entries.length}文 · 60秒 · シード再現`,
    )
    await card.click()
    await page.getByLabel('シードを固定する', { exact: true }).check()
    await page.getByLabel('出題シード', { exact: true }).fill('html-source')
    await page
      .getByRole('button', { name: 'このシードを使う', exact: true })
      .click()
    await expect(
      page.getByText(
        `全${set.entries.length}文を1周するごとに再シャッフルします。`,
        {
          exact: false,
        },
      ),
    ).toBeVisible()
    await expect(
      page.getByRole('link', { name: '出典：タイパー養成所 · 保存HTML' }),
    ).toHaveAttribute('href', set.source.url)
    await page.getByRole('button', { name: '全文を読む', exact: true }).click()
    const paragraphs = page.locator('#passage-full-text li p')
    await expect(paragraphs).toHaveCount(set.entries.length)
    const previewOrder = createTrainerOrder('html-source', set.entries.length)
    for (let i = 0; i < set.entries.length; i++) {
      const row = set.entries[previewOrder()]
      expect(
        (await paragraphs.nth(i).locator('.token-text').allTextContents()).join(
          '',
        ),
      ).toBe(row[0])
    }
    await page.getByRole('button', { name: '入力へ進む', exact: true }).click()
    await page.clock.pauseAt(
      new Date(await page.evaluate(() => Date.now() + 10000)),
    )
    await startPractice(page, true)
    const next = createTrainerOrder('html-source', set.entries.length)
    const first = set.entries[next()]
    await expect(page.locator('.current-paragraph')).toHaveAttribute(
      'data-text',
      first[0] as string,
    )
    await page.clock.runFor(200)
    const input = new RomanEngine(first[1] as string).hint
    await page.keyboard.type(input)
    await expect(page.locator('.current-paragraph')).toHaveAttribute(
      'data-text',
      set.entries[next()][0] as string,
    )
    await page.clock.runFor(60050)
    await expect(page.getByText('TIME UP', { exact: true })).toBeVisible()
    await expect
      .poll(() =>
        page.evaluate(
          () =>
            JSON.parse(localStorage.getItem('yohaku.history.v1') ?? '[]')
              .length,
        ),
      )
      .toBe(1)
    expect(
      await page.evaluate(
        () => JSON.parse(localStorage.getItem('yohaku.history.v1')!)[0],
      ),
    ).toMatchObject({
      passageId: set.id,
      mode: 'trainer',
      title,
      seed: 'html-source',
      elapsed: 60000,
      keys: input.length,
      replayVersion: 2,
    })
    await page.getByRole('button', { name: '練習の記録', exact: true }).click()
    await page
      .getByRole('button', { name: 'シード html-source を再現', exact: true })
      .click()
    await page.getByRole('button', { name: '入力へ進む', exact: true }).click()
    await expect(page.locator('.current-paragraph')).toHaveAttribute(
      'data-text',
      first[0] as string,
    )
    await page.getByRole('button', { name: '練習の記録', exact: true }).click()
    await page
      .getByRole('button', { name: 'リプレイを見る', exact: true })
      .click()
    const replay = page.getByRole('region', {
      name: '記録リプレイ',
      exact: true,
    })
    await expect
      .poll(async () => {
        await page.clock.runFor(350)
        return replay.isVisible()
      })
      .toBe(true)
    await replay.getByRole('button', { name: '次の1打鍵', exact: true }).click()
    await expect(replay.locator('.typed-roman')).toHaveText(input[0])
    await page
      .getByRole('button', { name: 'この記録のゴーストと対戦', exact: true })
      .click()
    const ghost = page.getByRole('region', { name: /ゴースト対戦の入力領域/ })
    await expect
      .poll(async () => {
        await page.clock.runFor(350)
        return ghost.isVisible()
      })
      .toBe(true)
    await ghost.focus()
    await page.keyboard.type(input[0])
    await expect(ghost.locator('.typed-roman')).toHaveText(input[0])
    await page.getByRole('button', { name: 'CPU対戦', exact: true }).click()
    await choose(
      page.getByRole('combobox', { name: '対戦の文章セット', exact: true }),
      set.id,
    )
    await page
      .getByRole('button', { name: 'CPUと対戦する', exact: true })
      .click()
    await page.clock.runFor(3100)
    expect(set.entries.map((r) => r[0])).toContain(
      await page.locator('.current-paragraph').getAttribute('data-text'),
    )
  })
}
