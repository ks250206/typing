import { test, expect, type Page } from '@playwright/test'
import { TypingTrace } from '../src/domain/records/telemetry'
import { RomanEngine } from '../src/domain/typing/engine'
import type { RecordEntry } from '../src/domain/records/types'
import { passages } from '../src/domain/content/passages'

const fixture = () => {
  const t = new TypingTrace(),
    e = new RomanEngine('しか')
  t.begin(
    {
      text: '鹿',
      reading: 'しか',
      segments: [{ text: '鹿', reading: 'しか' }],
    },
    0,
    'jis',
  )
  for (const [i, key] of [...'sizka'].entries()) {
    const pos = e.position,
      expected = e.hint[0]
    t.add(key, expected, pos, e.feed(key), [100, 200, 400, 600, 900][i])
  }
  t.begin(
    { text: 'あ', reading: 'あ', segments: [{ text: 'あ', reading: 'あ' }] },
    900,
    'jis',
  )
  t.add('a', 'a', 0, true, 1600)
  const record: RecordEntry = {
    id: 'ghost-fixture',
    passageId: 'rtc-fixture',
    title: 'ゴースト検証',
    layout: 'jis',
    date: '2026-10-29T00:00:00Z',
    elapsed: 1900,
    keys: 5,
    actualKeys: 5,
    misses: 1,
    rawMisses: 1,
    kpm: 158,
    accuracy: 83.3,
    seed: 'ghost-seed',
    replayVersion: 1,
    hasTrace: true,
  }
  return { record, trace: t.finish(1900) }
}
async function prepare(
  page: Page,
  kind: 'normal' | 'missing' | 'corrupt' = 'normal',
) {
  const data = fixture()
  if (kind === 'corrupt') data.trace.strokes[0].position = 2
  await page.addInitScript(
    ({ record, trace, kind }) => {
      localStorage.setItem(
        'yohaku.settings.v1',
        JSON.stringify({
          background: false,
          layout: 'us',
          wordColors: true,
          guide: true,
        }),
      )
      localStorage.setItem('yohaku.history.v1', JSON.stringify([record]))
      if (kind === 'missing') return
      const r = indexedDB.open('galactype.telemetry.v1', 1)
      r.onupgradeneeded = () => r.result.createObjectStore('traces')
      r.onsuccess = () => {
        const db = r.result,
          tx = db.transaction('traces', 'readwrite')
        tx.objectStore('traces').put(trace, record.id)
        tx.oncomplete = () => db.close()
      }
    },
    { ...data, kind },
  )
  await page.goto('/')
  await page.getByRole('button', { name: '練習の記録', exact: true }).click()
  await page
    .getByRole('button', { name: 'ゴーストと対戦', exact: true })
    .click()
  return data
}
test('races recorded timing, alternate spellings and mistakes, pauses both clocks, saves independently and retries', async ({
  page,
}) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  await page.clock.install({ time: new Date('2026-10-29T00:00:00Z') })
  const { record, trace } = await prepare(page)
  const race = page.getByRole('region', { name: 'ゴースト対戦', exact: true })
  const player = page.getByRole('region', { name: /ゴースト対戦の入力領域/ })
  const ghost = page.getByRole('region', {
    name: 'ゴーストの入力',
    exact: true,
  })
  await expect(race).toContainText('固定シード: ghost-seed')
  await expect(race).toContainText('jis') // The saved layout wins over the current US setting.
  await page.clock.pauseAt(new Date('2026-10-29T00:01:00Z'))
  await player.focus()
  await page.clock.runFor(1000)
  await expect(
    race.getByRole('progressbar', { name: 'ゴーストの進捗' }),
  ).toHaveAttribute('value', '0')
  await page.keyboard.type('s')
  await page.clock.runFor(220)
  await expect(ghost.locator('.typed-roman')).toHaveText('si')
  await page.keyboard.type('z')
  await expect(player).toHaveClass(/replay-mistake/)
  await page.clock.runFor(220)
  await expect(ghost.locator('[data-ghost-event]')).toContainText(
    '入力 z / ミス',
  )
  await expect(ghost).toHaveClass(/replay-mistake/)
  await race
    .getByRole('button', { name: '対戦を一時停止', exact: true })
    .click()
  const frozen = await race.locator('.ghost-scoreboard').innerText()
  await page.clock.runFor(2000)
  expect(await race.locator('.ghost-scoreboard').innerText()).toBe(frozen)
  await player.focus()
  await page.keyboard.type('a')
  await expect(player.locator('.typed-roman')).toHaveText('s')
  await race.getByRole('button', { name: '対戦を再開', exact: true }).click()
  await page.keyboard.type('hika')
  await expect(player.locator('.current-paragraph')).toHaveAttribute(
    'data-text',
    'あ',
  )
  await expect(ghost.locator('.current-paragraph')).toHaveAttribute(
    'data-text',
    '鹿',
  )
  await page.screenshot({
    path: 'artifacts/ghost-desktop.png',
    fullPage: true,
    animations: 'disabled',
  })
  await page.setViewportSize({ width: 390, height: 844 })
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true)
  await page.screenshot({
    path: 'artifacts/ghost-mobile.png',
    fullPage: true,
    animations: 'disabled',
  })
  await player.focus()
  await page.keyboard.type('a')
  await expect(race).toContainText('YOU WIN')
  await expect
    .poll(() =>
      page.evaluate(
        () => JSON.parse(localStorage.getItem('yohaku.history.v1')!).length,
      ),
    )
    .toBe(2)
  const saved = await page.evaluate(() =>
    JSON.parse(localStorage.getItem('yohaku.history.v1')!),
  )
  expect(saved.find((r: RecordEntry) => r.id === record.id)).toEqual(record)
  expect(saved.find((r: RecordEntry) => r.mode === 'ghost')).toMatchObject({
    seed: 'ghost-seed',
    layout: 'jis',
    ghostSourceId: record.id,
    actualKeys: 6,
    rawMisses: 1,
  })
  expect(
    await page.evaluate(async (id) => {
      const db = await new Promise<IDBDatabase>((resolve) => {
        const r = indexedDB.open('galactype.telemetry.v1', 1)
        r.onsuccess = () => resolve(r.result)
      })
      return await new Promise((resolve) => {
        const r = db.transaction('traces').objectStore('traces').get(id)
        r.onsuccess = () => {
          resolve(r.result)
          db.close()
        }
      })
    }, record.id),
  ).toEqual(trace)
  await race
    .getByRole('button', { name: '同じゴーストと再挑戦', exact: true })
    .click()
  await expect(race).toContainText('入力待ち')
  await player.focus()
  await page.keyboard.type('s')
  await page.clock.runFor(1700)
  await expect(ghost.locator('.typed-roman')).toHaveText('a')
  await page.keyboard.type('hikaa')
  await expect(race).toContainText('GHOST WIN')
  await race.getByRole('button', { name: '記録へ戻る', exact: true }).click()
  await page.clock.runFor(2000)
  await expect(page.locator('.history-table tbody tr')).toHaveCount(3)
  expect(errors).toEqual([])
})
test('ghost entry in record details reports unavailable or inconsistent logs without inventing a race', async ({
  page,
}) => {
  await prepare(page, 'missing')
  await expect(
    page.getByText('この記録には打鍵ログがないため、ゴースト対戦できません。'),
  ).toBeVisible()
  await page.getByRole('button', { name: '記録へ戻る', exact: true }).click()
  await page.getByRole('button', { name: '詳細を見る', exact: true }).click()
  await expect(page.getByText(/この記録には打鍵ログがありません/)).toBeVisible()
})
test('corrupt source logs show an error and leave the history untouched', async ({
  page,
}) => {
  await prepare(page, 'corrupt')
  await expect(
    page.getByText('保存された入力位置を再現できません。'),
  ).toBeVisible()
  expect(
    await page.evaluate(
      () => JSON.parse(localStorage.getItem('yohaku.history.v1')!).length,
    ),
  ).toBe(1)
})
test('unified selection filters and searches the library; briefing wraps while typing stays one line at a fixed frame height', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.addInitScript(() =>
    localStorage.setItem(
      'yohaku.settings.v1',
      JSON.stringify({ background: false }),
    ),
  )
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/')
  const library = page.getByRole('region', {
    name: '文章ライブラリ',
    exact: true,
  })
  await expect(library).toBeVisible()
  await expect(
    page
      .locator('.sidebar')
      .getByRole('button', { name: '文章ライブラリ', exact: true }),
  ).toHaveCount(0)
  const height = await page
    .locator('.mission-viewport')
    .evaluate((el) => el.getBoundingClientRect().height)
  await library
    .getByRole('button', { name: 'オリジナル', exact: true })
    .click()
  await expect(library.locator('.story-card')).toHaveCount(6)
  await library
    .getByRole('button', { name: '星の光が届くまで', exact: true })
    .click()
  await expect(
    library.getByRole('button', { name: '星の光が届くまで', exact: true }),
  ).toHaveAttribute('aria-pressed', 'true')
  await library.getByRole('button', { name: 'すべて', exact: true }).click()
  await library
    .getByRole('searchbox', { name: '文章を検索', exact: true })
    .fill('一致しない検索')
  await expect(library.getByRole('status')).toContainText(
    '一致する文章がありません',
  )
  await library
    .getByRole('searchbox', { name: '文章を検索', exact: true })
    .fill('憲法')
  await expect(library.locator('.story-card')).toHaveCount(
    passages.filter((p) => p.title.includes('憲法')).length,
  )
  const constitution = passages.find((p) => p.title.includes('憲法'))!
  await library
    .getByRole('button', { name: constitution.title, exact: true })
    .focus()
  await page.keyboard.press('Enter')
  await expect(page.locator('.passage-header')).toContainText(
    constitution.title,
  )
  await page.screenshot({
    path: 'artifacts/unified-library-mobile.png',
    fullPage: true,
    animations: 'disabled',
  })
  await page.getByRole('button', { name: '全文を読む', exact: true }).click()
  const first = page.locator('#passage-full-text p').first()
  await expect(first).toHaveCSS('white-space', 'normal')
  expect(await first.evaluate((p) => p.scrollWidth <= p.clientWidth + 1)).toBe(
    true,
  )
  expect(
    await first.evaluate(
      (p) =>
        p.getBoundingClientRect().height >
        parseFloat(getComputedStyle(p).lineHeight) * 2,
    ),
  ).toBe(true)
  expect(
    await page
      .locator('.mission-viewport')
      .evaluate((el) => el.getBoundingClientRect().height),
  ).toBe(height)
  await page.screenshot({
    path: 'artifacts/briefing-wrap-mobile.png',
    fullPage: true,
    animations: 'disabled',
  })
  await page.getByRole('button', { name: '入力へ進む', exact: true }).click()
  await expect(page.locator('.sentence-stream')).toHaveCSS(
    'white-space',
    'nowrap',
  )
  expect(
    await page
      .locator('.mission-viewport')
      .evaluate((el) => el.getBoundingClientRect().height),
  ).toBe(height)
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true)
  await page.setViewportSize({ width: 1440, height: 1000 })
  await page.getByRole('button', { name: '文章選択へ', exact: true }).click()
  await expect(library).toBeVisible()
  await library
    .getByRole('searchbox', { name: '文章を検索', exact: true })
    .fill('')
  await page.screenshot({
    path: 'artifacts/unified-library-desktop.png',
    fullPage: true,
    animations: 'disabled',
  })
})
