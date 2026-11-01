import { expect, test } from '@playwright/test'
import { englishDocument } from '../src/domain/content/english'
import { startPractice } from './startPractice'
import { choose } from './select'

for (const width of [1440, 390]) {
  test(`public accuracy counts repeated raw misses while pt keeps weighting at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 1000 })
    await page.clock.install()
    await page.addInitScript(() =>
      localStorage.setItem(
        'yohaku.settings.v1',
        JSON.stringify({ background: false, navigationMotion: 'off' }),
      ),
    )
    await page.goto('/')
    await page
      .getByRole('group', { name: '文章の言語' })
      .getByRole('button', { name: 'English', exact: true })
      .click()
    const document = englishDocument('en-library', '')
    await page
      .getByRole('button', { name: document.passage.title, exact: true })
      .click()
    await page.getByRole('button', { name: '練習へ進む', exact: true }).click()
    await page.clock.pauseAt(await page.evaluate(() => Date.now() + 1000))
    await startPractice(page, true)
    const first = document.sentences[0].text
    await page.keyboard.type(first.slice(0, 5))
    await page.clock.runFor(1000)
    const wrong = first[5] === 'z' ? 'q' : 'z'
    await page.keyboard.type(wrong.repeat(3))
    const card = page.locator('.practice-session-card')
    await expect(
      card.locator('.stat-grid > div').first().locator('strong'),
    ).toHaveText('62.5%')
    await expect(card.locator('.point-panel > strong')).toHaveText('142 pt')
    await expect(card.locator('.point-panel')).not.toContainText('実ミス率')
    await page.screenshot({
      path: `artifacts/raw-accuracy-${width}.png`,
      fullPage: true,
      animations: 'disabled',
    })
    await page.keyboard.type(first.slice(5))
    for (const sentence of document.sentences.slice(1))
      await page.keyboard.type(sentence.text)
    await expect(
      page.getByRole('region', { name: 'セッションの結果' }),
    ).toBeVisible()
    const keys = document.sentences.reduce(
      (sum, sentence) => sum + sentence.text.length,
      0,
    )
    const expected = Number(((keys * 100) / (keys + 3)).toFixed(2))
    await expect
      .poll(() =>
        page.evaluate(
          () =>
            JSON.parse(localStorage.getItem('yohaku.history.v1') ?? '[]')[0]
              ?.accuracy,
        ),
      )
      .toBe(expected)
    await expect(page.locator('.result-metrics > div').nth(2)).toContainText(
      `${expected}%`,
    )
    await page.getByRole('button', { name: '練習の記録', exact: true }).click()
    await page.getByRole('tab', { name: '全記録', exact: true }).click()
    await expect(page.locator('.history-table')).toContainText(`${expected}%`)

    await page.getByRole('button', { name: 'CPU対戦', exact: true }).click()
    await choose(page.getByLabel('対戦の文章セット'), 'en-library')
    await page.getByLabel('CPU速度 (KPM)', { exact: true }).fill('35')
    await page
      .getByRole('button', { name: 'CPUと対戦する', exact: true })
      .click()
    await page.clock.runFor(3100)
    await page.getByRole('region', { name: 'CPU対戦の入力領域' }).focus()
    const text = (await page
      .locator('.current-paragraph')
      .getAttribute('data-text'))!
    await page.keyboard.type(text.slice(0, 5))
    await page.keyboard.type((text[5] === 'z' ? 'q' : 'z').repeat(3))
    await expect(page.locator('.word-score')).toContainText('正確率 62.5%')
    await expect(page.locator('.battle-sidebar .stat-grid')).toContainText(
      '62.5%',
    )
    await expect(
      page.locator('.battle-sidebar .point-panel'),
    ).not.toContainText('実ミス率')
    await expect(page.locator('.battle-actions')).not.toContainText('実ミス率')
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true)
  })
}
