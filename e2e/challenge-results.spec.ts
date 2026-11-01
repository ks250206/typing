import { expect, test } from '@playwright/test'
import { sentencePracticePool } from '../src/domain/content/sentencePracticePool'
import { sentencesByPassage } from '../src/domain/content/sentences'
import { RomanEngine } from '../src/domain/typing/engine'
import { startPractice } from './startPractice'

for (const width of [1440, 390]) {
  test(`normal perimeter progress follows the main frame at ${width}px`, async ({
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
    await page.getByRole('button', { name: '練習へ進む', exact: true }).click()
    const bar = page.getByRole('progressbar', {
      name: '練習の進捗',
      exact: true,
    })
    await expect(bar).toHaveAttribute('aria-valuenow', '0')
    await startPractice(page, true)
    await expect(page.locator('.typing-area')).toHaveCSS('box-shadow', 'none')
    await page.keyboard.type(
      new RomanEngine(
        sentencesByPassage['night-library'][0].reading,
      ).hint.slice(0, 16),
    )
    const box = await bar.boundingBox()
    const main = await page.locator('.practice-main-perimeter').boundingBox()
    expect(Math.abs(box!.width - main!.width)).toBeLessThan(3)
    expect(Math.abs(box!.height - main!.height)).toBeLessThan(3)
    await expect(bar.locator('.perimeter-progress-line')).toHaveCount(4)
    await expect(page.locator('.progress-track')).toHaveCount(0)
    expect(Number(await bar.getAttribute('aria-valuenow'))).toBeGreaterThan(0)
    await page.screenshot({
      path: `artifacts/normal-progress-${width}.png`,
      fullPage: true,
      animations: 'disabled',
    })
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true)
  })
}

test('challenge stops on every raw miss over the cap, preserves weighted points and judges total KPM at the end', async ({
  page,
}) => {
  await page.clock.install()
  await page.addInitScript(() => {
    localStorage.setItem(
      'yohaku.settings.v1',
      JSON.stringify({ background: false, navigationMotion: 'off' }),
    )
    localStorage.setItem(
      'galactype.sentence-practice.v1',
      JSON.stringify({
        passageId: 'en-library',
        targetKpm: 600,
        maxMisses: 2,
        repetitions: 3,
      }),
    )
  })
  await page.goto('/')
  await page.getByRole('button', { name: '一文練習', exact: true }).click()
  await page.getByRole('button', { name: '練習へ進む', exact: true }).click()
  await page.clock.pauseAt(await page.evaluate(() => Date.now() + 1000))
  const area = page.getByRole('region', {
    name: '一文練習の入力領域',
    exact: true,
  })
  const result = page.getByRole('region', { name: 'セッションの結果' })
  const text = sentencePracticePool('en-library', 'jis')[0].text
  const trial = async (duration: number, wrong = false) => {
    await area.focus()
    if (wrong) await page.keyboard.type('z')
    await page.keyboard.type(text[0])
    await page.clock.runFor(duration)
    await page.keyboard.type(text.slice(1))
  }
  await area.focus()
  await page.keyboard.type(text.slice(0, 5))
  await page.clock.runFor(1000)
  await page.keyboard.type('z')
  await expect(
    page.locator('.sentence-options .miss-stat strong').first(),
  ).toHaveText('1')
  await expect(result).toHaveCount(0)
  await page.keyboard.type('z')
  await expect(
    page.locator('.sentence-options .miss-stat strong').first(),
  ).toHaveText('2')
  await expect(result).toHaveCount(0)
  await page.keyboard.type('z')
  await expect(result).toContainText('CHALLENGE FAILED')
  await expect(result).toContainText('合計ミス上限を超過')
  await expect(result).not.toContainText('目標KPM未達成')
  await expect(
    page.locator('.sentence-options .miss-stat strong').first(),
  ).toHaveText('3')
  await expect(
    page.locator('.sentence-options .stat-grid strong').first(),
  ).toContainText('62.5')
  await expect(result.locator('.result-score > strong')).toContainText('142')
  await expect(result.locator('.result-metrics')).toContainText('62.5')
  await expect(page.getByRole('status', { name: '練習回数' })).toContainText(
    '0 / 3 回',
  )
  await expect(result).toContainText('入力途中で終了')
  await expect(
    page.locator('.sentence-word-table tbody tr').first().locator('td').nth(1),
  ).toHaveText('—')
  await page.screenshot({
    path: 'artifacts/challenge-total-misses.png',
    animations: 'disabled',
  })
  await page.getByLabel('連続回数', { exact: true }).fill('2')
  await page.getByLabel('連続回数', { exact: true }).press('Tab')
  await trial(9000)
  await expect(result).toHaveCount(0)
  await trial(1000)
  await expect(result).toContainText('CHALLENGE FAILED')
  await expect(result.locator('.result-metrics')).toContainText(
    String(text.length * 2 * 6),
  )
  await expect(result).toContainText('目標KPM未達成')
  await expect(result).not.toContainText('合計ミス上限を超過')
  await expect(page.locator('.challenge-toast')).toHaveCount(0)
})
