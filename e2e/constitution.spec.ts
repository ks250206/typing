import { startPractice } from './startPractice'
import { test, expect } from '@playwright/test'
import { constitution } from '../src/constitution'
import { sentencesByPassage } from '../src/sentences'
import { RomanEngine } from '../src/engine'

test('the complete official preamble is selectable, readable, typable and saved', async ({
  page,
}) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  await page.goto('/')
  await page.getByLabel('3D 背景', { exact: true }).uncheck()
  await page
    .getByRole('button', { name: '日本国憲法 前文', exact: true })
    .click()
  await expect(page.locator('.passage-header')).toContainText('PUBLIC TEXT')
  await expect(
    page.getByRole('link', { name: '出典：衆議院：日本国憲法' }),
  ).toHaveAttribute('href', constitution.source!.url)
  await page.getByRole('button', { name: '全文を読む', exact: true }).click()
  const paragraphs = page.locator('#passage-full-text li p')
  await expect(paragraphs).toHaveCount(4)
  for (let i = 0; i < 4; i++)
    expect(
      await paragraphs.nth(i).locator('.token-text').allTextContents(),
    ).toEqual(constitution.paragraphs[i].segments!.map((s) => s.text))
  await page.getByRole('button', { name: '入力へ進む', exact: true }).click()
  await expect(page.locator('[data-face="2"]')).toHaveCSS('transform', 'none')
  await page.screenshot({
    path: 'artifacts/constitution-desktop.png',
    fullPage: true,
    animations: 'disabled',
  })
  await page.setViewportSize({ width: 390, height: 1000 })
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true)
  await expect(page.locator('.current-paragraph')).toHaveCSS(
    'white-space',
    'nowrap',
  )
  await page.screenshot({
    path: 'artifacts/constitution-mobile.png',
    fullPage: true,
    animations: 'disabled',
  })
  await page.getByRole('region', { name: /タイピング入力/ }).focus()
  await startPractice(page)
  for (const sentence of sentencesByPassage[constitution.id]) {
    await expect(page.locator('.current-paragraph')).toHaveAttribute(
      'data-text',
      sentence.text,
    )
    const engine = new RomanEngine(sentence.reading)
    let keys = ''
    while (!engine.done) {
      const key = engine.hint[0]
      keys += key
      engine.feed(key)
    }
    await page.keyboard.type(keys)
  }
  await expect(page.getByText('SESSION COMPLETE')).toBeVisible()
  await page.getByRole('button', { name: '練習の記録', exact: true }).click()
  await expect(page.locator('tbody')).toContainText('日本国憲法 前文')
  expect(errors).toEqual([])
})
