import { expect, test, type Page } from '@playwright/test'
import { sentencePracticePool } from '../src/domain/content/sentencePracticePool'

async function setup(page: Page, id = 'en-library', motion = 'off') {
  await page.clock.install()
  await page.addInitScript(
    ({ passageId, motion }) => {
      if (!localStorage.getItem('yohaku.settings.v1'))
        localStorage.setItem(
          'yohaku.settings.v1',
          JSON.stringify({ background: false, navigationMotion: motion }),
        )
      if (!localStorage.getItem('galactype.sentence-practice.v1'))
        localStorage.setItem(
          'galactype.sentence-practice.v1',
          JSON.stringify({
            passageId,
            targetKpm: 10,
            maxMisses: 10,
            repetitions: 4,
          }),
        )
    },
    { passageId: id, motion },
  )
  await page.goto('/')
  await page.getByRole('button', { name: '一文練習', exact: true }).click()
}

for (const width of [1440, 390]) {
  test(`sentence practice shares four faces, compact input, per-word statistics and an aggregate result at ${width}px`, async ({
    page,
  }) => {
    const errors: string[] = []
    page.on('pageerror', (error) => errors.push(error.message))
    await page.setViewportSize({ width, height: 1000 })
    await setup(page)
    const steps = page.getByRole('navigation', { name: '練習ステップ' })
    await expect(steps.getByRole('button')).toHaveText(
      ['01文章選択◇', '02全文確認◇', '03練習◇', '04結果◇'].map((s, i) =>
        i === 0 ? s.replace('◇', '◈') : s,
      ),
    )
    await expect(
      page.getByRole('button', { name: '結果へ', exact: true }),
    ).toBeDisabled()
    expect(
      (await page.locator('.sentence-practice .page-heading').boundingBox())!
        .height,
    ).toBeLessThan(115)
    await page.getByRole('button', { name: '全文を読む', exact: true }).click()
    await expect(
      page.getByRole('button', { name: '全文確認へ', exact: true }),
    ).toHaveAttribute('aria-current', 'step')
    await expect(page.locator('#passage-full-text li')).toHaveCount(6)
    await page
      .getByRole('button', { name: 'この文章でスタート', exact: true })
      .click()
    const area = page.getByRole('region', {
      name: '一文練習の入力領域',
      exact: true,
    })
    const inputStyle = page.getByRole('combobox', {
      name: '一文練習の入力方式',
      exact: true,
    })
    await expect(inputStyle).toHaveCSS('display', 'flex')
    // Read both boxes in one frame so scroll anchoring cannot move the card between reads.
    const geometry = await inputStyle.evaluate((element) => {
      const name = element.querySelector('span')!.getBoundingClientRect()
      const arrow = element.querySelector('svg')!.getBoundingClientRect()
      return {
        delta: Math.abs(name.y + name.height / 2 - arrow.y - arrow.height / 2),
        after: arrow.x > name.right,
      }
    })
    expect(geometry.delta).toBeLessThan(1)
    expect(geometry.after).toBe(true)
    const text = sentencePracticePool('en-library', 'jis')[0].text
    const table = page.getByRole('region', {
      name: '文章別の練習統計',
      exact: true,
    })
    await expect(table.locator('thead th')).toHaveText([
      '#',
      'Best KPM',
      'KPM',
      '秒',
      '試行',
      '打鍵',
      '文章 / ワード',
    ])
    const row = table.locator('tbody tr').first()
    await expect(row).toHaveAttribute('data-selected', 'true')
    await page.clock.pauseAt(await page.evaluate(() => Date.now() + 1000))
    const trial = async (duration: number, mistake = false) => {
      await area.focus()
      if (mistake) await page.keyboard.type('zzz')
      await page.keyboard.type(text[0])
      await page.clock.runFor(duration)
      await page.keyboard.type(text.slice(1))
    }
    await trial(1000)
    await expect(row.locator('td').nth(4)).toHaveText('1')
    await expect(row.locator('td').nth(1)).toHaveText(
      (text.length * 60).toFixed(1),
    )
    await expect(row.locator('td').nth(3)).toHaveText('1.00')
    await expect(row.locator('td').nth(5)).toHaveText(String(text.length))
    await page.getByRole('button', { name: '結果へ', exact: true }).click()
    await expect(
      page.getByRole('region', { name: 'セッションの結果' }),
    ).toContainText('INTERIM REPORT')
    await page.getByRole('button', { name: '練習へ進む', exact: true }).click()
    await page.keyboard.press('Enter')
    await trial(2000, true)
    await expect(page.getByRole('status', { name: '練習回数' })).toContainText(
      '2 / 4 回',
    )
    await expect(row.locator('td').nth(4)).toHaveText('2')
    await expect(row.locator('td').nth(1)).toHaveText(
      (text.length * 60).toFixed(1),
    )
    await page.keyboard.press('Enter')
    await trial(1000)
    await page.screenshot({
      path: `artifacts/sentence-flow-input-${width}.png`,
      fullPage: true,
      animations: 'disabled',
    })
    await page.keyboard.press('Enter')
    await trial(1000)
    await expect(
      page.getByRole('button', { name: '結果へ', exact: true }),
    ).toHaveAttribute('aria-current', 'step')
    const result = page.getByRole('region', { name: 'セッションの結果' })
    await expect(result).toContainText('CHALLENGE CLEAR')
    await expect(result.locator('.result-metrics')).toContainText('5.00秒')
    await expect(result.locator('.result-metrics')).toContainText(
      `${text.length * 4} / 3`,
    )
    await expect(row.locator('td').nth(4)).toHaveText('4')
    await page.clock.resume()
    await page.screenshot({
      path: `artifacts/sentence-flow-result-${width}.png`,
      fullPage: true,
      animations: 'disabled',
    })
    await result
      .getByRole('button', { name: '全打鍵・リプレイを確認', exact: true })
      .click()
    await page.getByRole('button', { name: 'リプレイ', exact: true }).click()
    await expect(
      page.getByRole('region', { name: '記録リプレイ' }),
    ).toBeVisible()
    await table.locator('tbody tr').nth(1).getByRole('button').click()
    await expect(area.locator('.current-paragraph')).toHaveAttribute(
      'data-text',
      sentencePracticePool('en-library', 'jis')[1].text,
    )
    await expect(
      page.getByRole('button', { name: '結果へ', exact: true }),
    ).toBeDisabled()
    await page.reload()
    await page.getByRole('button', { name: '一文練習', exact: true }).click()
    await expect(row.locator('td').nth(4)).toHaveText('4')
    await page.getByRole('button', { name: '環境設定', exact: true }).click()
    await page
      .getByRole('button', { name: '記録をすべて消去', exact: true })
      .click()
    await page.getByRole('button', { name: '削除する', exact: true }).click()
    await page
      .getByRole('button', { name: '設定を閉じる', exact: true })
      .click()
    await expect(row.locator('td').nth(4)).toHaveText('0')
    await expect(page.getByLabel('連続回数', { exact: true })).toHaveValue('4')
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true)
    expect(errors).toEqual([])
  })
}

test('selected long words use the shared snap-back marquee, stop on deselection and respect reduced motion', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1000 })
  await page.emulateMedia({ reducedMotion: 'no-preference' })
  await setup(page, 'en-long-observatory')
  const rows = page.locator('.sentence-word-table tbody tr')
  const longRow = rows.nth(1)
  await longRow.getByRole('button').click()
  const marquee = longRow.locator('.overflow-marquee')
  const track = marquee.locator('.overflow-marquee-track')
  await expect(marquee).toHaveAttribute('data-overflow', 'true')
  await expect(track).toHaveCSS('animation-name', 'favorite-overflow-marquee')
  const at = (fraction: number) =>
    track.evaluate((el, progress) => {
      const animation = el.getAnimations()[0]
      animation.pause()
      animation.currentTime =
        Number(animation.effect!.getTiming().duration) * progress
      return new DOMMatrixReadOnly(getComputedStyle(el).transform).m41
    }, fraction)
  expect(await at(0.89)).toBeLessThan(-5)
  await page
    .locator('.sentence-word-list')
    .screenshot({ path: 'artifacts/sentence-word-marquee.png' })
  expect(await at(0.92)).toBe(0)
  await rows.nth(2).getByRole('button').click()
  await expect(track).toHaveCSS('animation-name', 'none')
  await expect(marquee).toHaveCSS('text-overflow', 'ellipsis')
  await longRow.getByRole('button').click()
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await expect(track).toHaveCSS('animation-name', 'none')
  await expect(marquee).toHaveCSS('text-overflow', 'ellipsis')
  await page.setViewportSize({ width: 390, height: 1000 })
  await expect(marquee).toHaveCSS('white-space', 'nowrap')
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true)
})

test('sentence practice shares session controls, miss feedback, continuous repetitions and sentence crossfade', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await setup(page, 'en-library', 'on')
  await page.getByRole('button', { name: '練習へ進む', exact: true }).click()
  const area = page.getByRole('region', {
    name: '一文練習の入力領域',
    exact: true,
  })
  const aside = page.locator('.sentence-options')
  await expect(aside.locator('.tiny-label')).toHaveText([
    'THIS SESSION',
    'YOUR CHALLENGE',
    'INPUT STYLE',
  ])
  await expect(
    aside.getByRole('heading', { name: '達成条件', exact: true }),
  ).toHaveCount(0)
  await expect(aside.locator('label[for="layout"]')).toHaveCount(0)
  const styles = await aside
    .locator('.sentence-challenge > label')
    .evaluateAll((labels) =>
      labels.map((label) => {
        const style = getComputedStyle(label)
        const input = label.querySelector('input')!
        return {
          font: style.font,
          color: style.color,
          margin: style.margin,
          height: input.getBoundingClientRect().height,
          labelHeight: label.getBoundingClientRect().height,
        }
      }),
    )
  expect(styles).toHaveLength(3)
  expect(styles[0].labelHeight).toBe(styles[0].height)
  expect(styles[0].height).toBe(34)
  expect(styles[1]).toEqual(styles[0])
  expect(styles[2]).toEqual(styles[0])
  expect(
    await aside
      .locator('.point-panel')
      .evaluate((el) => getComputedStyle(el).minHeight),
  ).toBe('0px')
  await expect(aside).not.toContainText('最初の1打から計測します')
  await expect(aside).not.toContainText('参考：')
  await expect(aside).not.toContainText('IME を OFF')
  await expect(page.locator('.local-status')).toHaveCount(0)
  await expect(aside).not.toContainText('正打鍵KPM × 補正正確率²')
  const help = page.getByRole('button', { name: '採点方法を開く', exact: true })
  await help.click()
  const popup = page.getByRole('note', { name: '採点と称号', exact: true })
  await expect(popup).toContainText('入力後に精度称号を判定')
  await expect(popup).toContainText('正打鍵KPM × 補正正確率²')
  await expect(popup).toContainText(
    '連続ミス減点 1 / .75 / .5 / .35 / .25（5回〜）',
  )
  await page.screenshot({
    path: 'artifacts/scoring-help.png',
    animations: 'disabled',
  })
  await page.keyboard.press('Escape')
  await expect(popup).toHaveCount(0)
  await expect(help).toBeFocused()
  await help.click()
  await area.click()
  await expect(popup).toHaveCount(0)
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect(area.locator('.reading-toolbar')).toHaveCount(0)
  await expect(aside).toHaveCSS('position', 'static')
  await area.focus()
  await page.keyboard.type('z')
  await expect(page.locator('body > .damage-overlay')).toBeVisible()
  const overlay = await page.locator('body > .damage-overlay').boundingBox()
  expect(overlay!.width).toBe(1440)
  expect(overlay!.height).toBe(900)
  await page.keyboard.press('Escape')
  await expect(page.locator('.damage-overlay')).toHaveCount(0)
  await page.keyboard.press('Enter')
  const text = sentencePracticePool('en-library', 'jis')[0].text
  await page.keyboard.type(text)
  await expect(area).toHaveAttribute('data-status', 'running')
  await expect(area).toBeFocused()
  await page.keyboard.type(text.repeat(3))
  await expect(
    page.getByRole('region', { name: 'セッションの結果' }),
  ).toContainText('CHALLENGE CLEAR')
  await page.getByRole('button', { name: '次の文へ', exact: true }).click()
  await expect(area).toHaveAttribute('data-transition', 'true')
  await expect(page.locator('.sentence-crossfade-out')).toHaveCSS(
    'pointer-events',
    'none',
  )
  await expect(area.locator('.prose')).toHaveCSS(
    'animation-name',
    'sentence-crossfade-in',
  )
  await expect(area).toBeFocused()
  await expect(page.locator('.sentence-crossfade-out')).toHaveCount(0)
  await page.evaluate(() => window.scrollTo(0, 0))
  const beforeScroll = await aside.boundingBox()
  await page.evaluate(() => window.scrollTo(0, 320))
  const afterScroll = await aside.boundingBox()
  const scrollY = await page.evaluate(() => window.scrollY)
  expect(scrollY).toBeGreaterThan(0)
  expect(afterScroll!.y).toBeCloseTo(beforeScroll!.y - scrollY, 0)
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await expect(aside).toHaveCSS('animation-name', 'none')
  await page.setViewportSize({ width: 390, height: 844 })
  await expect(aside).toHaveCSS('position', 'static')
  await help.click()
  const mobilePopup = await popup.boundingBox()
  expect(mobilePopup!.x).toBeGreaterThanOrEqual(7)
  expect(mobilePopup!.x + mobilePopup!.width).toBeLessThanOrEqual(383)
  expect(mobilePopup!.y).toBeGreaterThanOrEqual(7)
  expect(mobilePopup!.y + mobilePopup!.height).toBeLessThanOrEqual(845)
  await popup.getByRole('button', { name: '採点ヘルプを閉じる' }).click()
  await expect(popup).toHaveCount(0)
  await expect(help).toBeFocused()
})
