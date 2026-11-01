import { expect, test, type Page } from '@playwright/test'
import { seededBattlePrompts } from '../src/domain/content/battleSets'
import { RomanEngine } from '../src/domain/typing/engine'
import { choose } from './select'

async function setup(page: Page, layout = 'jis') {
  await page.clock.install()
  await page.addInitScript(
    (value) =>
      localStorage.setItem(
        'yohaku.settings.v1',
        JSON.stringify({
          background: false,
          navigationMotion: 'off',
          layout: value,
        }),
      ),
    layout,
  )
  await page.goto('/')
  await page.getByRole('button', { name: 'CPU対戦', exact: true }).click()
}
async function configure(page: Page, id: string, seed: string) {
  await choose(page.getByLabel('対戦の文章セット', { exact: true }), id)
  await page.getByLabel('対戦シードを固定する', { exact: true }).check()
  await page.getByLabel('対戦シード', { exact: true }).fill(seed)
  await page.getByLabel('CPU速度 (KPM)', { exact: true }).fill('1800')
  await page.getByLabel('CPU反応時間 (ms)', { exact: true }).fill('100')
  await choose(page.getByLabel('CPUの打ち方'), 'constant')
}
async function start(page: Page) {
  await page.getByRole('button', { name: 'CPUと対戦する', exact: true }).click()
  await page.clock.runFor(3100)
  await page
    .getByRole('region', { name: 'CPU対戦の入力領域', exact: true })
    .focus()
}
for (const width of [1440, 390]) {
  test(`English CPU preserves literal case, spaces, guides and favorites at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 1000 })
    const errors: string[] = []
    page.on('pageerror', (error) => errors.push(error.message))
    await setup(page, 'kana')
    const set = page.getByLabel('対戦の文章セット', { exact: true })
    await set.click()
    await expect(
      page.getByRole('listbox').getByRole('option', { name: /^English ·/ }),
    ).toHaveCount(29)
    await page.keyboard.press('Escape')
    await configure(page, 'en-library', 'english-cpu-caps')
    await expect(page.getByLabel('1問の単語数', { exact: true })).toHaveCount(0)
    await expect(
      page.getByLabel('対戦の入力方式', { exact: true }),
    ).toHaveAttribute('data-value', 'jis')
    await page.getByLabel('対戦の入力方式', { exact: true }).click()
    await expect(
      page.getByRole('listbox').locator('[data-value="kana"]'),
    ).toHaveCount(0)
    await page.keyboard.press('Escape')
    await page
      .getByRole('button', { name: 'お気に入りに登録', exact: true })
      .click()
    await expect(
      page.getByRole('button', { name: 'お気に入りを解除', exact: true }),
    ).toBeVisible()
    await page.clock.pauseAt(await page.evaluate(() => Date.now() + 1000))
    await start(page)
    const text = seededBattlePrompts('en-library', 'english-cpu-caps')[0].text
    const paragraph = page.locator('.current-paragraph')
    await expect(paragraph).toHaveAttribute('data-text', text)
    expect(text[0]).toMatch(/[A-Z]/)
    await expect(page.locator('.kana-line')).toHaveAttribute(
      'aria-hidden',
      'true',
    )
    expect((await page.locator('.kana-line').innerText()).trim()).toBe('')
    expect(
      (await page.locator('.kana-line').boundingBox())!.height,
    ).toBeGreaterThan(10)
    await page.keyboard.type(text[0].toLowerCase())
    await expect(page.locator('.duel-row-player .typed-roman')).toHaveText('')
    await page.keyboard.type(text.slice(0, 5))
    await expect(page.locator('.duel-row-player .typed-roman')).toHaveText(
      text.slice(0, 5),
    )
    await page.screenshot({
      path: `artifacts/english-cpu-${width}.png`,
      fullPage: true,
      animations: 'disabled',
    })
    await page.keyboard.type(text.slice(5))
    await expect(page.getByTestId('player-points')).toHaveText('1')
    await expect(page.locator('.duel-row-player .typed-roman')).toHaveText(text)
    await expect(page.locator('.word-score')).toContainText('実打 1')
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true)
    expect(errors).toEqual([])
  })
}

test('English TypeWell preserves configurable word counts through storage, favorites and seeded v2 replay', async ({
  page,
}) => {
  await setup(page)
  await configure(page, 'en-typewell-01', 'five-english-words')
  const wordCount = page.getByLabel('1問の単語数', { exact: true })
  await expect(wordCount).toHaveValue('5')
  await page.screenshot({
    path: 'artifacts/cpu-typewell-options.png',
    fullPage: true,
    animations: 'disabled',
  })
  await wordCount.fill('3')
  await wordCount.press('Tab')
  await page.reload()
  await page.getByRole('button', { name: 'CPU対戦', exact: true }).click()
  await expect(wordCount).toHaveValue('3')
  await configure(page, 'en-typewell-01', 'five-english-words')
  await page
    .getByRole('button', { name: 'お気に入りに登録', exact: true })
    .click()
  expect(
    await page.evaluate(
      () =>
        JSON.parse(localStorage.getItem('galactype.favorites.v1') ?? '[]')[0]
          ?.wordsPerPrompt,
    ),
  ).toBe(3)

  await page.clock.pauseAt(await page.evaluate(() => Date.now() + 1000))
  await start(page)
  const prompt = seededBattlePrompts(
    'en-typewell-01',
    'five-english-words',
    2,
    3,
  )[0]
  await expect(page.locator('.current-paragraph')).toHaveAttribute(
    'data-text',
    prompt.text,
  )
  const boundary = prompt.text.indexOf(' ')
  await page.keyboard.type(prompt.text.slice(0, boundary))
  await expect(page.getByTestId('player-points')).toHaveText('0')
  await page.keyboard.press('Space')
  await expect(page.getByTestId('player-points')).toHaveText('0')
  await page.keyboard.type(prompt.text.slice(boundary + 1))
  await expect(page.getByTestId('player-points')).toHaveText('1')
  for (let round = 0; round < 4; round++) {
    await page.clock.fastForward(60000)
    if (round < 3)
      await page
        .getByRole('button', { name: '次のラウンド', exact: true })
        .click()
  }
  await expect(
    page.getByRole('region', { name: 'セッションの結果' }),
  ).toBeVisible()
  await expect
    .poll(async () =>
      page.evaluate(
        () =>
          JSON.parse(localStorage.getItem('yohaku.history.v1') ?? '[]')[0]
            ?.replayVersion,
      ),
    )
    .toBe(2)
  expect(
    await page.evaluate(
      () =>
        JSON.parse(localStorage.getItem('yohaku.history.v1') ?? '[]')[0]
          ?.cpuWordsPerPrompt,
    ),
  ).toBe(3)
  await page.clock.resume()
  await page.getByRole('button', { name: '練習の記録', exact: true }).click()
  await page.getByRole('tab', { name: '全記録', exact: true }).click()
  await page
    .getByRole('button', { name: /対戦シード five-english-words を再現/ })
    .click()
  await expect(wordCount).toHaveValue('3')
  await start(page)
  await expect(page.locator('.current-paragraph')).toHaveAttribute(
    'data-text',
    prompt.text,
  )
  await expect(page.locator('.battle-seed-info')).toContainText('RTC v2')
  await page
    .getByRole('button', { name: /お気に入りを開く：CPU対戦 .*3語\/問/ })
    .click()
  await expect(wordCount).toHaveValue('3')
  await expect(
    page.getByLabel('対戦シードを固定する', { exact: true }),
  ).not.toBeChecked()
  await expect(page.getByLabel('対戦シード', { exact: true })).not.toHaveValue(
    'five-english-words',
  )
  await expect(
    page.getByRole('button', { name: 'お気に入りを解除', exact: true }),
  ).toBeVisible()
})

test('Japanese TypeWell joins five entries and a saved v1 match retains the one-word prompts', async ({
  page,
}) => {
  await setup(page)
  await configure(page, 'typewell-basic', 'five-japanese-words')
  const wordCount = page.getByLabel('1問の単語数', { exact: true })
  await expect(wordCount).toHaveValue('5')
  await wordCount.fill('0')
  await wordCount.press('Tab')
  await expect(wordCount).toHaveValue('5')
  await page.clock.pauseAt(await page.evaluate(() => Date.now() + 1000))
  await start(page)
  const prompt = seededBattlePrompts(
    'typewell-basic',
    'five-japanese-words',
    2,
  )[0]
  await expect(page.locator('.current-paragraph')).toHaveAttribute(
    'data-text',
    prompt.text,
  )
  expect(prompt.wordStarts).toHaveLength(4)
  const hint = new RomanEngine(prompt.reading).hint
  await page.keyboard.type(hint.slice(0, hint.indexOf(' ')))
  await expect(page.getByTestId('player-points')).toHaveText('0')
  await page.keyboard.type(hint.slice(hint.indexOf(' ')))
  await expect(page.getByTestId('player-points')).toHaveText('1')
  await page
    .getByRole('button', { name: '対戦をリセット', exact: true })
    .click()
  await page.evaluate(() =>
    localStorage.setItem(
      'yohaku.history.v1',
      JSON.stringify([
        {
          id: 'legacy-typewell',
          title: '旧タイプウェル対戦',
          passageId: 'typewell-basic',
          layout: 'jis',
          mode: 'cpu',
          date: new Date().toISOString(),
          elapsed: 10000,
          keys: 100,
          misses: 0,
          kpm: 600,
          accuracy: 100,
          seed: 'legacy-typewell-seed',
          replayVersion: 1,
          cpuConfig: { kpm: 35, reactionMs: 1500, curve: 'constant' },
        },
      ]),
    ),
  )
  await page.clock.resume()
  await page.reload()
  await page.getByRole('button', { name: '練習の記録', exact: true }).click()
  await page.getByRole('tab', { name: '全記録', exact: true }).click()
  await page
    .getByRole('button', { name: /対戦シード legacy-typewell-seed を再現/ })
    .click()
  await start(page)
  await expect(page.locator('.current-paragraph')).toHaveAttribute(
    'data-text',
    seededBattlePrompts('typewell-basic', 'legacy-typewell-seed', 1)[0].text,
  )
  await expect(page.locator('.battle-seed-info')).toContainText('RTC v1')
})
