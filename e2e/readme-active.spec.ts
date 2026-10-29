import { test, expect } from '@playwright/test'
import { startPractice } from './startPractice'
import { rtcPassages } from '../src/rtcWords'
import { choose } from './select'
test('new RTC sets are available in solo and CPU, and README shows real active input', async ({
  page,
}) => {
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(e.message))
  await page.setViewportSize({ width: 1440, height: 1100 })
  await page.emulateMedia({ reducedMotion: 'no-preference' })
  await page.addInitScript(() =>
    localStorage.setItem(
      'yohaku.settings.v1',
      JSON.stringify({ background: true, navigationMotion: 'off' }),
    ),
  )
  await page.goto('/')
  const sets = rtcPassages.filter((p) => /^rtc-(2019|2023)-/.test(p.id))
  expect(sets).toHaveLength(8)
  for (const set of sets)
    await expect(
      page.getByRole('button', { name: set.title, exact: true }),
    ).toBeVisible()
  await page.getByRole('button', { name: sets[0].title, exact: true }).click()
  await page.getByRole('button', { name: '入力へ進む', exact: true }).click()
  await startPractice(page)
  const text =
    ((await page.locator('.roman-current').textContent()) ?? '') +
    ((await page.locator('.remaining-roman').textContent()) ?? '')
  const typed = text.slice(0, Math.min(10, text.length - 1))
  await page.keyboard.type(typed)
  await expect(page.locator('.typed-roman')).toHaveText(typed)
  await expect(page.locator('.practice-overlay')).toHaveCount(0)
  await expect(page.getByText('IN THE FLOW', { exact: true })).toBeVisible()
  await expect(page.locator('.space-scene')).toBeVisible()
  await page.screenshot({
    path: 'artifacts/galactype-active-desktop.png',
    fullPage: true,
    animations: 'disabled',
  })
  await page.getByRole('button', { name: 'CPU対戦', exact: true }).click()
  for (const set of sets) {
    const selector = page.getByRole('combobox', {
      name: '対戦の文章セット',
      exact: true,
    })
    await choose(selector, set.id)
    await expect(selector).toHaveAttribute('data-value', set.id)
  }
  expect(errors).toEqual([])
})
