import { expect, type Page } from '@playwright/test'
import type { Layout } from '../src/domain/typing/engine'
import { keyOutput, physicalKey } from '../src/domain/typing/physicalKeyboard'

export async function pressPhysicalKey(
  page: Page,
  code: string,
  shift = false,
  altGraph = false,
) {
  if (code === 'IntlRo' || code === 'IntlYen') {
    // Playwright's US key table has no JIS extra keys. Send native Chromium
    // events, retaining isTrusted and the physical code the app actually reads.
    const session = await page.context().newCDPSession(page)
    const event = {
      code,
      key: keyOutput(code, shift, 'jis')!,
      modifiers: shift ? 8 : 0,
    }
    try {
      await session.send('Input.dispatchKeyEvent', {
        ...event,
        type: 'keyDown',
      })
      await session.send('Input.dispatchKeyEvent', { ...event, type: 'keyUp' })
    } finally {
      await session.detach()
    }
  } else {
    await page.keyboard.press(
      `${altGraph ? 'AltGraph+' : ''}${shift ? 'Shift+' : ''}${code}`,
    )
  }
}

export async function physicalType(page: Page, text: string, layout: Layout) {
  for (const char of text) {
    const key = physicalKey(char, layout)
    expect(key, `${layout}/${char}`).toBeDefined()
    await pressPhysicalKey(page, key!.code, key!.shift, key!.altGraph)
  }
}
