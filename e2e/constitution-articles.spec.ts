import { test, expect } from '@playwright/test'
import { constitutionArticleDocument } from '../src/constitutionArticles'
import { RomanEngine } from '../src/engine'
import { startPractice } from './startPractice'

test('all 14 full articles are shuffled as intact blocks, previewed, completed, saved and reproduced by seed', async ({
  page,
}) => {
  test.setTimeout(120000)
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  await page.clock.install()
  await page.addInitScript(() =>
    localStorage.setItem(
      'yohaku.settings.v1',
      JSON.stringify({ background: false, navigationMotion: 'off' }),
    ),
  )
  await page.goto('/')
  await page
    .getByRole('button', { name: '日本国憲法 条文集', exact: true })
    .click()
  await expect(
    page.getByRole('button', { name: '日本国憲法 前文', exact: true }),
  ).toBeVisible()
  await page.getByLabel('シードを固定する', { exact: true }).check()
  await page.getByLabel('出題シード', { exact: true }).fill('articles-e2e')
  await page
    .getByRole('button', { name: 'このシードを使う', exact: true })
    .click()
  const doc = constitutionArticleDocument('articles-e2e')
  await page.getByRole('button', { name: '全文を読む', exact: true }).click()
  const rows = page.locator('#passage-full-text li')
  await expect(rows).toHaveCount(14)
  for (const [index, article] of doc.sentences.entries()) {
    await expect(rows.nth(index).locator('h3')).toHaveText(article.label)
    await expect(rows.nth(index).locator('small')).toContainText(
      article.keywords,
    )
    expect(
      (await rows.nth(index).locator('.token-text').allTextContents()).join(''),
    ).toBe(article.text)
  }
  await page.setViewportSize({ width: 390, height: 1000 })
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true)
  await page.screenshot({
    path: 'artifacts/constitution-articles-preview.png',
    fullPage: true,
  })
  await page.setViewportSize({ width: 1440, height: 1100 })
  await page.getByRole('button', { name: '入力へ進む', exact: true }).click()
  await page.clock.pauseAt(
    new Date(await page.evaluate(() => Date.now() + 10000)),
  )
  await startPractice(page, true)
  let keys = 0
  for (const [index, article] of doc.sentences.entries()) {
    await expect(page.locator('.current-paragraph')).toHaveAttribute(
      'data-text',
      article.text,
    )
    await expect(page.locator('.sentence-label').first()).toHaveText(
      article.label,
    )
    await expect(page.locator('.reading-toolbar')).toContainText(
      `${index + 1} / 14 条`,
    )
    await page.clock.runFor(2000)
    const input = new RomanEngine(article.reading).hint
    keys += input.length
    await page.keyboard.type(input)
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
    passageId: 'constitution-articles',
    seed: 'articles-e2e',
    replayVersion: 1,
    keys,
    misses: 0,
  })
  await page.getByRole('button', { name: '練習の記録', exact: true }).click()
  await page
    .getByRole('button', { name: 'シード articles-e2e を再現', exact: true })
    .click()
  await page.getByRole('button', { name: '全文を読む', exact: true }).click()
  await expect(rows).toHaveCount(14)
  await expect(rows.locator('h3')).toHaveText(doc.sentences.map((a) => a.label))
  await page.getByRole('button', { name: '文章選択へ', exact: true }).click()
  await page
    .getByLabel('出題シード', { exact: true })
    .fill('different-articles')
  await page
    .getByRole('button', { name: 'このシードを使う', exact: true })
    .click()
  await page.getByRole('button', { name: '全文を読む', exact: true }).click()
  await expect(rows.locator('h3')).toHaveText(
    constitutionArticleDocument('different-articles').sentences.map(
      (a) => a.label,
    ),
  )
  expect(errors).toEqual([])
})
