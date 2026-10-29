import { startPractice } from './startPractice'
import { choose as pick } from './select'
import { test, expect, type Page } from '@playwright/test'
import { etypingDocument, etypingPassages } from '../src/domain/content/etyping'
import { KanaEngine, RomanEngine } from '../src/domain/typing/engine'
import { physicalKey } from '../src/domain/typing/physicalKeyboard'

const choose = async (page: Page, title: string, seed: string) => {
  await page.getByRole('button', { name: title, exact: true }).click()
  await page.getByLabel('シードを固定する').check()
  await page.getByLabel('出題シード').fill(seed)
  await page.getByRole('button', { name: 'このシードを使う' }).click()
}
const preview = async (page: Page) => {
  await page.getByRole('button', { name: '全文を読む', exact: true }).click()
  await expect(page.locator('#passage-full-text li')).toHaveCount(15)
  return page
    .locator('#passage-full-text li p')
    .evaluateAll((nodes) =>
      nodes.map((node) =>
        [...node.querySelectorAll('.token-text')]
          .map((n) => n.textContent)
          .join(''),
      ),
    )
}
const enter = async (page: Page) => {
  await page.getByRole('button', { name: '入力へ進む', exact: true }).click()
  await expect(page.locator('[data-face="2"]')).toHaveCSS('transform', 'none')
  await page.getByRole('region', { name: /タイピング入力/ }).focus()
  await startPractice(page)
}

test('all six clean titles provide seeded 15-question previews; completing 15 saves the seed and replays the same order', async ({
  page,
}) => {
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(e.message))
  await page.goto('/')
  await page.getByLabel('3D 背景', { exact: true }).uncheck()
  const seed = 'xml-replay-test'
  for (const passage of etypingPassages) {
    await choose(page, passage.title, seed)
    const expected = etypingDocument(passage.id, seed)
    expect(await preview(page)).toEqual(expected.sentences.map((s) => s.text))
    await page.getByRole('button', { name: '文章選択へ', exact: true }).click()
  }
  await expect(
    page.getByRole('button', { name: 'バレンタイン', exact: true }),
  ).toHaveCount(1)
  await choose(page, '春の言葉', seed)
  const doc = etypingDocument('etyping-spring', seed)
  expect(await preview(page)).toEqual(doc.sentences.map((s) => s.text))
  await enter(page)
  await page.screenshot({
    path: 'artifacts/etyping-desktop.png',
    fullPage: true,
    animations: 'disabled',
  })
  await page.setViewportSize({ width: 390, height: 1000 })
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true)
  await page.screenshot({
    path: 'artifacts/etyping-mobile.png',
    fullPage: true,
    animations: 'disabled',
  })
  for (const sentence of doc.sentences) {
    await expect(page.locator('.current-paragraph')).toHaveAttribute(
      'data-text',
      sentence.text,
    )
    await page.keyboard.type(new RomanEngine(sentence.reading).hint)
  }
  await expect(
    page.getByText('SESSION COMPLETE', { exact: true }),
  ).toBeVisible()
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
  ).toMatchObject({
    passageId: 'etyping-spring',
    seed,
    replayVersion: 1,
    mode: 'practice',
  })
  await page.getByRole('button', { name: '練習の記録', exact: true }).click()
  await page
    .getByRole('button', { name: `シード ${seed} を再現`, exact: true })
    .click()
  expect(await preview(page)).toEqual(doc.sentences.map((s) => s.text))
  await page.getByRole('button', { name: '文章選択へ', exact: true }).click()
  await page.getByLabel('出題シード').fill('different-seed')
  await page.getByRole('button', { name: 'このシードを使う' }).click()
  expect(await preview(page)).not.toEqual(doc.sentences.map((s) => s.text))
  expect(errors).toEqual([])
})

test('JIS kana accepts literal numeric positions and continues into kana; changing layout keeps the seeded questions', async ({
  page,
}) => {
  await page.goto('/')
  await page.getByLabel('3D 背景', { exact: true }).uncheck()
  let seed = ''
  for (let i = 0; i < 2000; i++) {
    if (
      etypingDocument(
        'etyping-valentine',
        String(i),
      ).sentences[0].reading.startsWith('1')
    ) {
      seed = String(i)
      break
    }
  }
  expect(seed).not.toBe('')
  await choose(page, 'バレンタイン', seed)
  const expected = etypingDocument('etyping-valentine', seed)
  await pick(page.getByLabel('入力方式', { exact: true }), 'kana')
  expect(await preview(page)).toEqual(expected.sentences.map((s) => s.text))
  await enter(page)
  const engine = new KanaEngine(expected.sentences[0].reading)
  let accepted = 0
  for (const character of engine.target) {
    const key = physicalKey(character, 'kana')!
    await page.keyboard.press(`${key.shift ? 'Shift+' : ''}${key.code}`)
    engine.feed(character)
    accepted++
  }
  await expect(page.locator('.current-paragraph')).toHaveAttribute(
    'data-text',
    expected.sentences[1].text,
  )
  await expect(page.locator('.miss-stat')).toContainText(`打鍵${accepted}`)
  await expect(page.locator('.miss-stat')).toContainText('ミス0')
})
