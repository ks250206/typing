import { startPractice } from './startPractice'
import { choose as pick } from './select'
import { test, expect } from '@playwright/test'
import { rtcDocument, rtcPassages } from '../src/domain/content/rtcWords'
import { RomanEngine } from '../src/domain/typing/engine'

test('replay steps actual spelling and mistakes, pauses, changes speed and seeks without adding records', async ({
  page,
}) => {
  await page.clock.install()
  await page.addInitScript(() => {
    localStorage.setItem(
      'yohaku.settings.v1',
      JSON.stringify({ background: false }),
    )
    const trace = {
      version: 1,
      elapsed: 1200,
      prompts: [
        {
          text: '鹿',
          reading: 'しか',
          start: 0,
          end: 1200,
          segments: [{ text: '鹿', reading: 'しか' }],
        },
      ],
      strokes: [
        {
          t: 100,
          dt: 100,
          key: 's',
          expected: 's',
          correct: true,
          prompt: 0,
          position: 0,
          character: '鹿',
        },
        {
          t: 200,
          dt: 100,
          key: 'i',
          expected: 'h',
          correct: true,
          prompt: 0,
          position: 0,
          character: '鹿',
        },
        {
          t: 500,
          dt: 300,
          key: 'z',
          expected: 'k',
          correct: false,
          prompt: 0,
          position: 1,
          character: '鹿',
        },
        {
          t: 700,
          dt: 200,
          key: 'k',
          expected: 'k',
          correct: true,
          prompt: 0,
          position: 1,
          character: '鹿',
        },
        {
          t: 800,
          dt: 100,
          key: 'a',
          expected: 'a',
          correct: true,
          prompt: 0,
          position: 1,
          character: '鹿',
        },
      ],
    }
    const record = {
      id: 'replay-fixture',
      passageId: 'fixture',
      title: 'リプレイ検証',
      layout: 'jis',
      date: new Date().toISOString(),
      elapsed: 1200,
      keys: 4,
      actualKeys: 4,
      misses: 1,
      rawMisses: 1,
      kpm: 200,
      accuracy: 80,
      hasTrace: true,
    }
    localStorage.setItem('yohaku.history.v1', JSON.stringify([record]))
    const request = indexedDB.open('galactype.telemetry.v1', 1)
    request.onupgradeneeded = () => request.result.createObjectStore('traces')
    request.onsuccess = () => {
      const db = request.result,
        tx = db.transaction('traces', 'readwrite')
      tx.objectStore('traces').put(trace, record.id)
      tx.oncomplete = () => db.close()
    }
  })
  await page.goto('/')
  await page.getByRole('button', { name: '練習の記録', exact: true }).click()
  await page.getByRole('tab', { name: '全記録', exact: true }).click()
  const before = await page.evaluate(() =>
    localStorage.getItem('yohaku.history.v1'),
  )
  await page
    .getByRole('button', { name: 'リプレイを見る', exact: true })
    .click()
  const replay = page.getByRole('region', { name: '記録リプレイ' })
  await expect(replay).toBeVisible()
  await expect(replay.locator('ruby rt')).toHaveText('しか')
  await replay.getByRole('button', { name: '次の1打鍵', exact: true }).click()
  await expect(replay.locator('.typed-roman')).toHaveText('s')
  await replay.getByRole('button', { name: '次の1打鍵', exact: true }).click()
  await expect(replay.locator('.typed-roman')).toHaveText('si')
  await replay.getByRole('button', { name: '次の1打鍵', exact: true }).click()
  await expect(replay.locator('.replay-stage')).toHaveClass(/replay-mistake/)
  await expect(replay.locator('.replay-event')).toContainText('入力 z / ミス')
  await expect(replay.locator('.replay-metrics')).toContainText(
    '累計 240.0 KPM',
  )
  await replay.getByRole('button', { name: '再生', exact: true }).click()
  await page.clock.runFor(100)
  await replay.getByRole('button', { name: '一時停止', exact: true }).click()
  const paused = await replay.getByLabel('リプレイ再生位置').inputValue()
  await page.clock.runFor(500)
  await expect(replay.getByLabel('リプレイ再生位置')).toHaveValue(paused)
  await pick(replay.getByLabel('リプレイ速度'), '2')
  await replay.getByRole('button', { name: '再生', exact: true }).click()
  await page.clock.runFor(400)
  await expect(replay.locator('.typed-roman')).toHaveText('sika')
  await expect(replay.getByLabel('リプレイ再生位置')).toHaveValue('1200')
  await expect(replay.locator('.replay-metrics')).toContainText(
    '累計 200.0 KPM',
  )
  await replay.getByRole('button', { name: '前の1打鍵', exact: true }).click()
  await expect(replay.locator('.typed-roman')).toHaveText('sik')
  await replay.getByLabel('リプレイ再生位置').focus()
  await page.keyboard.press('Home')
  await expect(replay.locator('.replay-event')).toContainText('入力前')
  await page.keyboard.press('End')
  await expect(replay.locator('.replay-event')).toContainText('5 / 5 打鍵')
  await page.screenshot({
    path: 'artifacts/replay-desktop.png',
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
    path: 'artifacts/replay-mobile.png',
    fullPage: true,
    animations: 'disabled',
  })
  await page.keyboard.type('zzz')
  expect(
    await page.evaluate(() => localStorage.getItem('yohaku.history.v1')),
  ).toBe(before)
  await replay.getByRole('button', { name: '先頭へ', exact: true }).click()
  await replay.getByRole('button', { name: '再生', exact: true }).click()
  await page.getByRole('button', { name: 'KPM・ミス推移', exact: true }).click()
  await page.clock.runFor(3000)
  await expect(page.getByRole('region', { name: '記録リプレイ' })).toHaveCount(
    0,
  )
  expect(
    await page.evaluate(() => localStorage.getItem('yohaku.history.v1')),
  ).toBe(before)
})

for (const setId of ['rtc-2025-all', 'rtc-2019-all', 'rtc-2023-all'])
  test(`${setId} generates seeded two-part sentences, completes 15 prompts and replays the stored input`, async ({
    page,
  }) => {
    const errors: string[] = []
    page.on('pageerror', (e) => errors.push(e.message))
    await page.goto('/')
    await page.getByLabel('3D 背景', { exact: true }).uncheck()
    const selected = rtcPassages.find((s) => s.id === setId)!
    await page
      .getByRole('button', { name: selected.title, exact: true })
      .click()
    await page.getByLabel('シードを固定する', { exact: true }).check()
    await page.getByLabel('出題シード', { exact: true }).fill('rtc-combine')
    await page
      .getByRole('button', { name: 'このシードを使う', exact: true })
      .click()
    const doc = rtcDocument(selected.id, 'rtc-combine')
    await page.getByRole('button', { name: '全文を読む', exact: true }).click()
    await expect(page.locator('#passage-full-text li')).toHaveCount(15)
    const text = await page
      .locator('#passage-full-text li p')
      .evaluateAll((nodes) =>
        nodes.map((n) =>
          [...n.querySelectorAll('.token-text')]
            .map((s) => s.textContent)
            .join(''),
        ),
      )
    expect(text).toEqual(doc.sentences.map((s) => s.text))
    await page.screenshot({
      path: 'artifacts/rtc-wordset.png',
      fullPage: true,
      animations: 'disabled',
    })
    await page.getByRole('button', { name: '入力へ進む', exact: true }).click()
    await expect(page.locator('[data-face="2"]')).toHaveCSS('transform', 'none')
    await page.getByRole('region', { name: /タイピング入力/ }).focus()
    await startPractice(page)
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
            JSON.parse(localStorage.getItem('yohaku.history.v1') ?? '[]')
              .length,
        ),
      )
      .toBe(1)
    await page.getByRole('button', { name: '練習の記録', exact: true }).click()
    await page.getByRole('tab', { name: '全記録', exact: true }).click()
    await page
      .getByRole('button', { name: 'リプレイを見る', exact: true })
      .click()
    const replay = page.getByRole('region', { name: '記録リプレイ' })
    await expect(replay.locator('.current-paragraph')).toHaveAttribute(
      'data-text',
      doc.sentences[0].text,
    )
    await replay.getByLabel('リプレイ再生位置').focus()
    await page.keyboard.press('End')
    await expect(replay.locator('.current-paragraph')).toHaveAttribute(
      'data-text',
      doc.sentences[14].text,
    )
    await expect(replay.locator('.replay-event')).toContainText('問題 15 / 15')
    await page.getByRole('button', { name: 'CPU対戦', exact: true }).click()
    await pick(page.getByLabel('対戦の文章セット'), selected.id)
    await page.getByLabel('対戦シードを固定する', { exact: true }).check()
    await page.getByLabel('対戦シード', { exact: true }).fill('rtc-combine')
    await page
      .getByRole('button', { name: 'CPUと対戦する', exact: true })
      .click()
    await expect(page.locator('.current-paragraph')).toHaveAttribute(
      'data-text',
      doc.sentences[0].text,
      { timeout: 7000 },
    )
    await expect(page.locator('.next-sentence')).toHaveCount(0)
    expect(errors).toEqual([])
  })
