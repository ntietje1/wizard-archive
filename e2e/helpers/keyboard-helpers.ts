import type { Page } from '@playwright/test'

export async function getBrowserPrimaryModifier(page: Page): Promise<'Control' | 'Meta'> {
  const isMac = await page.evaluate(() => /Mac|iPhone|iPad|MacIntel/.test(navigator.platform))
  return isMac ? 'Meta' : 'Control'
}

export async function pressSelectAll(page: Page) {
  await page.keyboard.press(`${await getBrowserPrimaryModifier(page)}+A`)
}

export async function pressUndo(page: Page) {
  await page.keyboard.press(`${await getBrowserPrimaryModifier(page)}+Z`)
}

export async function pressRedo(page: Page) {
  const modifier = await getBrowserPrimaryModifier(page)
  await page.keyboard.press(modifier === 'Meta' ? 'Meta+Shift+Z' : 'Control+Y')
}
