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
  await page.keyboard.press(`${await getBrowserPrimaryModifier(page)}+Shift+Z`)
}

export async function pressCopy(page: Page) {
  await page.keyboard.press(`${await getBrowserPrimaryModifier(page)}+C`)
}

export async function pressCut(page: Page) {
  await page.keyboard.press(`${await getBrowserPrimaryModifier(page)}+X`)
}

export async function pressPaste(page: Page) {
  await page.keyboard.press(`${await getBrowserPrimaryModifier(page)}+V`)
}
