import { expect, test } from '@playwright/test'
import { themePassages, themeTrainers } from '../src/domain/content/themes'
import { typewellPassages } from '../src/domain/content/typewell'
import { rtcPassages } from '../src/domain/content/rtcWords'
import { choose } from './select'
import { startPractice } from './startPractice'
const added = [
  ...themePassages,
  ...themeTrainers,
  ...typewellPassages.filter((p) =>
    ['typewell-scientists', 'typewell-sf', 'typewell-sports'].includes(p.id),
  ),
  ...rtcPassages.filter((p) => p.id === 'rtc-ai-ml-llm'),
]
for (const set of added)
  test(`${set.title} is playable and selectable in CPU battle`, async ({
    page,
  }) => {
    await page.clock.install()
    await page.addInitScript(() =>
      localStorage.setItem(
        'yohaku.settings.v1',
        JSON.stringify({ background: false, navigationMotion: 'off' }),
      ),
    )
    await page.goto('/')
    await page.getByRole('button', { name: set.title, exact: true }).click()
    await page.getByRole('button', { name: '入力へ進む', exact: true }).click()
    await startPractice(page, true)
    const input = page.locator('.roman-current')
    const first = await input.textContent()
    expect(first).toBeTruthy()
    await page.keyboard.type(first!)
    await expect(page.locator('.typed-roman')).toHaveText(first!)
    if (set.id === 'theme-curie')
      await page.screenshot({
        path: 'artifacts/theme-curie.png',
        fullPage: true,
      })
    await page.keyboard.press('Escape')
    await page.getByRole('button', { name: 'CPU対戦', exact: true }).click()
    await choose(page.getByLabel('対戦の文章セット'), set.id)
    await expect(page.getByLabel('対戦の文章セット')).toHaveAttribute(
      'data-value',
      set.id,
    )
  })
