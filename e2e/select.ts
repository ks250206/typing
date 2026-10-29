import type { Locator } from '@playwright/test'
export async function choose(
  locator: Locator,
  option: string | { label: string },
) {
  await locator.click()
  const list = locator.page().getByRole('listbox')
  const target =
    typeof option === 'string'
      ? list.locator(`[role="option"][data-value=${JSON.stringify(option)}]`)
      : list.getByRole('option', { name: option.label, exact: true })
  await target.click()
}
