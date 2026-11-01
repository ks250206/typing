import { expect, test, type Page } from '@playwright/test'
import { englishDocument } from '../src/domain/content/english'
import { sentencePracticePool } from '../src/domain/content/sentencePracticePool'
import { RomanEngine } from '../src/domain/typing/engine'
import { physicalKey } from '../src/domain/typing/physicalKeyboard'
import { startPractice } from './startPractice'
import { choose } from './select'

async function setup(page: Page, sentence = false) {
  await page.clock.install()
  await page.addInitScript((sentenceMode) => {
    if (!localStorage.getItem('yohaku.settings.v1'))
      localStorage.setItem(
        'yohaku.settings.v1',
        JSON.stringify({
          background: false,
          navigationMotion: 'off',
          layout: 'jis',
        }),
      )
    if (sentenceMode && !localStorage.getItem('galactype.sentence-practice.v1'))
      localStorage.setItem(
        'galactype.sentence-practice.v1',
        JSON.stringify({
          passageId: 'en-library',
          targetKpm: 1000,
          maxMisses: 0,
        }),
      )
  }, sentence)
  await page.goto('/')
}

for (const width of [1440, 390]) {
  test(`English word colors and consumed words toggle independently, preserve progress and persist across modes at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 1000 })
    await setup(page, true)
    await page
      .getByRole('group', { name: '文章の言語' })
      .getByRole('button', { name: 'English', exact: true })
      .click()
    await page.getByRole('button', { name: '練習へ進む', exact: true }).click()
    const wordColors = page.getByRole('checkbox', {
      name: '単語の色分け',
      exact: true,
    })
    const colors = () =>
      page
        .locator('.typing-area .current-paragraph .pending-token .token-text')
        .evaluateAll((elements) => [
          ...new Set(
            elements
              .filter((el) => el.textContent?.trim())
              .map((el) => getComputedStyle(el).color),
          ),
        ])
    const text = sentencePracticePool('en-library', 'jis')[0].text
    await expect(wordColors).toBeChecked()
    expect((await colors()).length).toBeGreaterThan(1)
    await wordColors.uncheck()
    expect(await colors()).toHaveLength(1)
    await expect(
      page.locator('.typing-area .current-paragraph'),
    ).toHaveAttribute('data-text', text)
    expect(await page.locator('.typing-area .roman-line').innerText()).toBe(
      text,
    )
    const consume = page.getByRole('checkbox', {
      name: '入力済み単語を消す',
      exact: true,
    })
    await consume.check()
    await startPractice(page, true)
    await page.keyboard.type('A ')
    const typed = page.locator('.typing-area .typed-roman')
    await expect(typed.locator('[data-consumed=true]')).toHaveText('A ')
    await expect(typed.locator('[data-consumed=true]')).toHaveCSS(
      'visibility',
      'hidden',
    )
    await consume.uncheck()
    await expect(typed.locator('[data-consumed=true]')).toHaveCount(0)
    await expect(typed).toHaveText('A ')
    await consume.check()
    await page.getByRole('button', { name: '一文練習', exact: true }).click()
    await page.getByRole('button', { name: '練習へ進む', exact: true }).click()
    await expect(consume).toBeChecked()
    await expect(wordColors).not.toBeChecked()
    expect(await colors()).toHaveLength(1)
    await wordColors.check()
    expect((await colors()).length).toBeGreaterThan(1)
    const area = page.getByRole('region', {
      name: '一文練習の入力領域',
      exact: true,
    })
    await area.focus()
    await page.keyboard.type('A ')
    await expect(typed.locator('[data-consumed=true]')).toHaveText('A ')
    await wordColors.uncheck()
    await expect(area).toHaveAttribute('data-status', 'running')
    await expect(area.locator('.typed-roman')).toHaveText('A ')
    await consume.uncheck()
    await expect(typed.locator('[data-consumed=true]')).toHaveCount(0)
    await expect(typed).toHaveText('A ')
    await expect(wordColors).not.toBeChecked()
    await consume.check()
    await page.reload()
    await page.getByRole('button', { name: '一文練習', exact: true }).click()
    await page.getByRole('button', { name: '練習へ進む', exact: true }).click()
    await expect(wordColors).not.toBeChecked()
    await expect(consume).toBeChecked()
    expect(await colors()).toHaveLength(1)
    await wordColors.check()
    expect((await colors()).length).toBeGreaterThan(1)
  })

  test(`English library, literal input, blank kana spacing, pause, favorites and saved replay at ${width}px`, async ({
    page,
  }) => {
    const errors: string[] = []
    page.on('pageerror', (e) => errors.push(e.message))
    await page.setViewportSize({ width, height: 1000 })
    await setup(page)
    await page.getByRole('button', { name: '練習へ進む', exact: true }).click()
    const kanaHeight = await page
      .locator('.mission-face.is-active .kana-line')
      .evaluate((el) => el.getBoundingClientRect().height)
    await page.getByRole('button', { name: '文章選択へ', exact: true }).click()
    await page
      .getByRole('group', { name: '文章の言語' })
      .getByRole('button', { name: 'English', exact: true })
      .click()
    const library = page.getByRole('region', { name: '文章ライブラリ' })
    await expect(library.locator('.story-card')).toHaveCount(29)
    await expect(
      library.locator('[aria-label="文章のジャンル"] button'),
    ).toHaveText([
      'すべて',
      'オリジナル',
      'オリジナル長文',
      'e-typing',
      'タイプウェル',
    ])
    await library
      .getByRole('button', {
        name: 'お気に入りに登録：The Quiet Library',
        exact: true,
      })
      .click()
    await page.getByRole('button', { name: '練習へ進む', exact: true }).click()
    const area = page.getByRole('region', { name: /タイピング入力領域/ })
    const kana = area.locator('.kana-line')
    await expect(kana).toHaveAttribute('aria-hidden', 'true')
    expect((await kana.innerText()).trim()).toBe('')
    expect(
      await kana.evaluate((el) => el.getBoundingClientRect().height),
    ).toBeCloseTo(kanaHeight, 1)
    await expect(area.locator('[data-code="KeyA"]')).toHaveAttribute(
      'data-state',
      'next',
    )
    await expect(area.locator('[data-code="ShiftRight"]')).toHaveAttribute(
      'data-state',
      'next',
    )
    // Install alone still advances with real execution. Pause before starting,
    // then run only the active intervals so CI render/input speed is irrelevant.
    await page.clock.pauseAt(await page.evaluate(() => Date.now() + 1000))
    await startPractice(page, true)
    await page.screenshot({
      path: `artifacts/english-input-${width}.png`,
      fullPage: true,
    })
    await page.keyboard.type('a') // Uppercase A is required.
    const doc = englishDocument('en-library', 'unused')
    await page.keyboard.type(doc.sentences[0].text.slice(0, 10))
    await page.clock.runFor(1000)
    await page.keyboard.press('Escape')
    const pausedTime = await page
      .locator('.stat-grid strong')
      .last()
      .innerText()
    await page.clock.runFor(10000)
    await expect(page.locator('.stat-grid strong').last()).toHaveText(
      pausedTime,
    )
    await page.keyboard.press('Enter')
    await page.keyboard.type(doc.sentences[0].text.slice(10))
    for (const sentence of doc.sentences.slice(1)) {
      await page.clock.runFor(100)
      await page.keyboard.type(sentence.text)
    }
    await expect(
      page.getByText('SESSION COMPLETE', { exact: true }),
    ).toBeVisible()
    await expect
      .poll(() =>
        page.evaluate(
          () =>
            JSON.parse(localStorage.getItem('yohaku.history.v1') ?? '[]')[0]
              ?.passageId,
        ),
      )
      .toBe('en-library')
    const record = await page.evaluate(
      () => JSON.parse(localStorage.getItem('yohaku.history.v1')!)[0],
    )
    expect(record.passageId).toBe('en-library')
    expect(record.keys).toBe(
      doc.sentences.reduce((n, s) => n + s.text.length, 0),
    )
    expect(record.rawMisses).toBe(1)
    expect(record.elapsed).toBe(1500)
    // Resume ordinary UI timers for the lazy-loaded replay after measurement.
    await page.clock.resume()
    await page.getByRole('button', { name: '練習の記録', exact: true }).click()
    await page.getByRole('tab', { name: '全記録', exact: true }).click()
    await page
      .getByRole('button', { name: 'リプレイを見る', exact: true })
      .click()
    const replay = page.getByRole('region', { name: '記録リプレイ' })
    await expect(replay.getByLabel('英語入力ガイド')).toBeVisible()
    await replay.getByLabel('リプレイ再生位置').focus()
    await page.keyboard.press('End')
    await expect(replay.locator('.typed-roman')).toHaveText(
      doc.sentences.at(-1)!.text,
    )
    await page.reload()
    if (width < 800)
      await page
        .getByRole('button', { name: 'お気に入りを表示', exact: true })
        .click()
    await page
      .getByRole('button', {
        name: /お気に入りを開く：通常練習 · The Quiet Library/,
      })
      .click()
    await expect(
      page.getByRole('button', { name: '全文確認へ', exact: true }),
    ).toHaveAttribute('aria-current', 'step')
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true)
    expect(errors).toEqual([])
  })

  test(`one sentence judges the full five repetitions, reports success/failure and excludes paused time at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 1000 })
    await setup(page, true)
    await page.getByRole('button', { name: '一文練習', exact: true }).click()
    await page.getByRole('button', { name: '練習へ進む', exact: true }).click()
    await expect(page.getByLabel('連続回数', { exact: true })).toHaveValue('5')
    await page.clock.pauseAt(await page.evaluate(() => Date.now() + 1000))
    const area = page.getByRole('region', {
      name: '一文練習の入力領域',
      exact: true,
    })
    const text = sentencePracticePool('en-library', 'jis')[0].text
    const attempt = async (wrong = false, pause = false) => {
      await area.focus()
      if (wrong) await page.keyboard.type('zzz')
      await page.keyboard.type(text.slice(0, 5))
      await page.clock.runFor(500)
      if (pause) {
        await page.keyboard.press('Escape')
        await expect(
          page.getByRole('button', { name: '再開する', exact: true }),
        ).toBeVisible()
        await page.clock.runFor(10000)
        await page.keyboard.press('Enter')
      }
      await page.keyboard.type(text.slice(5))
    }
    const toast = page.getByRole('status', {
      name: '一文練習の判定',
      exact: true,
    })
    for (let i = 1; i <= 2; i++) {
      await attempt(false, i === 1)
      await expect(
        page.getByRole('status', { name: '練習回数' }),
      ).toContainText(`${i} / 5 回`)
      await expect(area).toHaveAttribute('data-status', 'running')
      await expect(area).toBeFocused()
      await expect(toast).toHaveCount(0)
    }
    await page.keyboard.type('z')
    await expect(
      page.getByRole('region', { name: 'セッションの結果' }),
    ).toContainText('CHALLENGE FAILED')
    await expect(page.getByRole('status', { name: '練習回数' })).toContainText(
      '2 / 5 回',
    )
    await expect(toast).toHaveCount(0)
    await expect(
      page
        .getByRole('region', { name: 'セッションの結果' })
        .locator('.result-metrics'),
    ).toContainText('1.00秒')
    await expect(
      page.getByRole('region', { name: 'セッションの結果' }),
    ).toContainText('合計ミス上限を超過')
    await page.getByRole('button', { name: 'もう一度', exact: true }).click()
    await expect(toast).toHaveCount(0)
    for (let i = 1; i <= 5; i++) {
      await attempt()
      await expect(
        page.getByRole('status', { name: '練習回数' }),
      ).toContainText(`${i} / 5 回`)
      if (i < 5) await expect(area).toHaveAttribute('data-status', 'running')
    }
    await expect(page.getByRole('status', { name: '練習回数' })).toContainText(
      'CHALLENGE CLEAR',
    )
    await expect(toast).toHaveCount(0)
    await expect(
      page
        .getByRole('region', { name: 'セッションの結果' })
        .locator('.result-metrics'),
    ).toContainText('2.50秒')
    await page.screenshot({
      path: `artifacts/sentence-result-${width}.png`,
      fullPage: true,
    })
    await page.clock.resume()
    await page.keyboard.press('Enter')
    await expect(area.locator('.current-paragraph')).toHaveAttribute(
      'data-text',
      sentencePracticePool('en-library', 'jis')[1].text,
    )
    await expect(page.getByRole('status', { name: '練習回数' })).toContainText(
      '0 / 5 回',
    )
    await page.keyboard.type('I')
    await page.getByRole('button', { name: 'CPU対戦', exact: true }).click()
    await page.getByRole('button', { name: '一文練習', exact: true }).click()
    await page.getByRole('button', { name: '練習へ進む', exact: true }).click()
    await expect(area).toHaveAttribute('data-status', 'ready')
    await expect(page.locator('.sentence-attempts')).toHaveCount(0)
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true)
    expect(
      await page.evaluate(() =>
        JSON.parse(localStorage.getItem('yohaku.history.v1') ?? '[]'),
      ),
    ).toEqual([])
  })
}

for (const id of ['en-etyping-05', 'en-typewell-01', 'en-long-observatory']) {
  test(`English set ${id} completes with reproducible input and seed`, async ({
    page,
  }) => {
    await setup(page)
    await page
      .getByRole('group', { name: '文章の言語' })
      .getByRole('button', { name: 'English', exact: true })
      .click()
    const docTitle = englishDocument(id, 'test').passage.title
    await page.getByRole('button', { name: '文章選択へ', exact: true }).click()
    await page.getByRole('button', { name: docTitle, exact: true }).click()
    const seed = id.startsWith('en-long')
      ? ''
      : await page.getByLabel('出題シード', { exact: true }).inputValue()
    const doc = englishDocument(id, seed)
    await page.getByRole('button', { name: '全文確認へ', exact: true }).click()
    if (!id.startsWith('en-long'))
      await expect(page.locator('.passage-header a')).toHaveAttribute(
        'href',
        'https://github.com/physics-HTFI/TypeLighter',
      )
    await page.getByRole('button', { name: '練習へ進む', exact: true }).click()
    await startPractice(page, true)
    for (const sentence of doc.sentences) {
      await page.clock.runFor(500)
      await page.keyboard.type(sentence.text)
    }
    await expect(
      page.getByText('SESSION COMPLETE', { exact: true }),
    ).toBeVisible()
    await expect
      .poll(() =>
        page.evaluate(
          () =>
            JSON.parse(localStorage.getItem('yohaku.history.v1') ?? '[]')[0]
              ?.passageId,
        ),
      )
      .toBe(id)
    const record = await page.evaluate(
      () => JSON.parse(localStorage.getItem('yohaku.history.v1')!)[0],
    )
    expect(record.passageId).toBe(id)
    expect(record.keys).toBe(
      doc.sentences.reduce((n, s) => n + s.text.length, 0),
    )
    if (id === 'en-typewell-01') {
      expect(record.keys).toBe(400)
      expect(record.seed).toBe(seed)
      await page
        .getByRole('button', { name: '練習の記録', exact: true })
        .click()
      await page.getByRole('tab', { name: '全記録', exact: true }).click()
      await page
        .getByRole('button', { name: `シード ${seed} を再現`, exact: true })
        .click()
      await page
        .getByRole('button', { name: '全文確認へ', exact: true })
        .click()
      await expect(page.locator('#passage-full-text p')).toHaveText(
        doc.sentences[0].text,
      )
    }
  })
}

test('Japanese one-sentence input, source selection, persisted goals, reset and invalid-value fallback', async ({
  page,
}) => {
  await setup(page)
  await page.getByRole('button', { name: '一文練習', exact: true }).click()
  await page.getByRole('button', { name: '練習へ進む', exact: true }).click()
  for (const [label, value] of [
    ['目標KPM', '10'],
    ['ミス上限', '2'],
    ['連続回数', '1'],
  ]) {
    const input = page.getByLabel(label, { exact: true })
    await input.fill(value)
    await input.press('Tab')
  }
  const area = page.getByRole('region', {
    name: '一文練習の入力領域',
    exact: true,
  })
  const sentence = sentencePracticePool('night-library', 'jis')[0]
  const consume = page.getByRole('checkbox', {
    name: '入力済み単語を消す',
    exact: true,
  })
  await consume.check()
  await area.focus()
  await page.keyboard.type(new RomanEngine(sentence.reading).hint.slice(0, 1))
  await page.clock.runFor(500)
  await page.keyboard.type(new RomanEngine(sentence.reading).hint.slice(1, 20))
  expect(
    await area.locator('.current-paragraph [data-consumed=true]').count(),
  ).toBeGreaterThan(0)
  await page.keyboard.type(new RomanEngine(sentence.reading).hint.slice(20))
  await expect(page.getByRole('status', { name: '練習回数' })).toContainText(
    'CHALLENGE CLEAR',
  )
  await consume.uncheck()
  await expect(page.getByRole('status', { name: '練習回数' })).toContainText(
    '1 / 1 回',
  )
  await expect(
    page.locator('.sentence-attempt [data-consumed=true]'),
  ).toHaveCount(0)
  await consume.check()
  await page.getByRole('button', { name: '文章選択へ', exact: true }).click()
  await page
    .getByRole('group', { name: '文章の言語' })
    .getByRole('button', { name: 'English', exact: true })
    .click()
  await page
    .getByRole('button', { name: 'TypeWell · 基本英単語', exact: true })
    .click()
  await expect(page.locator('.sentence-word-table')).toHaveAttribute(
    'aria-rowcount',
    '1501',
  )
  await page.getByRole('button', { name: '練習へ進む', exact: true }).click()
  await expect(area.locator('.current-paragraph')).toHaveAttribute(
    'data-text',
    sentencePracticePool('en-typewell-01', 'jis')[0].text,
  )
  await page.reload()
  await page.getByRole('button', { name: '一文練習', exact: true }).click()
  await page.getByRole('button', { name: '練習へ進む', exact: true }).click()
  await expect(page.getByLabel('連続回数', { exact: true })).toHaveValue('1')
  await expect(page.getByLabel('目標KPM', { exact: true })).toHaveValue('10')
  await expect(page.getByLabel('ミス上限', { exact: true })).toHaveValue('2')
  await expect(page.locator('.sentence-word-list')).toHaveAttribute(
    'data-passage-id',
    'en-typewell-01',
  )
  await page
    .getByRole('button', { name: '初期設定に戻す', exact: true })
    .click()
  await expect(page.getByLabel('連続回数', { exact: true })).toHaveValue('5')
  await expect(page.getByLabel('目標KPM', { exact: true })).toHaveValue('600')
  await expect(page.getByLabel('ミス上限', { exact: true })).toHaveValue('10')
  await page.evaluate(() =>
    localStorage.setItem(
      'galactype.sentence-practice.v1',
      JSON.stringify({
        passageId: 'unknown',
        targetKpm: -10,
        repetitions: 0,
        maxMisses: 'bad',
      }),
    ),
  )
  await page.reload()
  await page.getByRole('button', { name: '一文練習', exact: true }).click()
  await page.getByRole('button', { name: '練習へ進む', exact: true }).click()
  await expect(page.getByLabel('目標KPM', { exact: true })).toHaveValue('600')
  await expect(page.getByLabel('ミス上限', { exact: true })).toHaveValue('10')
  await expect(page.getByLabel('連続回数', { exact: true })).toHaveValue('5')
  await expect(page.locator('.sentence-word-list')).toHaveAttribute(
    'data-passage-id',
    'night-library',
  )
})

test('English switches out of kana, saves favorites with an alphabetic layout and accepts physical Dvorak capitals', async ({
  page,
}) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  await setup(page, true)
  await choose(page.getByLabel('入力方式', { exact: true }), 'kana')
  const language = page.getByRole('group', { name: '文章の言語' })
  await language.getByRole('button', { name: 'English', exact: true }).click()
  await expect(page.getByLabel('入力方式', { exact: true })).toHaveAttribute(
    'data-value',
    'jis',
  )
  await language.getByRole('button', { name: '日本語', exact: true }).click()
  await choose(page.getByLabel('入力方式', { exact: true }), 'kana')
  await page.getByRole('button', { name: '一文練習', exact: true }).click()
  await page.getByRole('button', { name: '練習へ進む', exact: true }).click()
  await page.getByRole('button', { name: '文章選択へ', exact: true }).click()
  await page
    .getByRole('button', {
      name: 'お気に入りに登録：The Quiet Library',
      exact: true,
    })
    .click()
  expect(
    await page.evaluate(
      () =>
        JSON.parse(localStorage.getItem('galactype.favorites.v1')!)[0].layout,
    ),
  ).toBe('jis')
  await page
    .getByRole('button', {
      name: /お気に入りを開く：通常練習 · The Quiet Library/,
    })
    .click()
  await expect(
    page.getByRole('button', { name: '全文確認へ', exact: true }),
  ).toHaveAttribute('aria-current', 'step')
  await expect(
    page.locator('.favorites-panel li[data-active=true]'),
  ).toHaveCount(1)
  await choose(page.getByLabel('入力方式', { exact: true }), 'dvorak')
  await page.getByRole('button', { name: '練習へ進む', exact: true }).click()
  await startPractice(page, true)
  const text = 'A small light'
  for (const character of text) {
    const key = physicalKey(character, 'dvorak')!
    await page.keyboard.press(`${key.shift ? 'Shift+' : ''}${key.code}`)
  }
  await expect(page.locator('.mission-face.is-active .typed-roman')).toHaveText(
    text,
  )
  await expect(page.locator('.miss-stat strong').first()).toHaveText('0')
  expect(errors).toEqual([])
})
