import { expect } from '@playwright/test'
import type { Page } from '@playwright/test'

export async function openShareMenu(page: Page) {
  await page.getByRole('button', { name: /private|shared/i }).click()
  await expect(page.getByText(/full access/i).first()).toBeVisible({
    timeout: 5000,
  })
}

export async function openSettingsPeopleTab(page: Page) {
  const userMenuBtn = page.getByRole('button', { name: 'User menu' })
  await expect(userMenuBtn).toBeVisible({ timeout: 5000 })

  let settingsOpened = false
  for (let attempt = 0; attempt < 3; attempt++) {
    await userMenuBtn.click()
    try {
      await page
        .getByRole('button', { name: /^settings$/i })
        .click({ timeout: 5000 })
      settingsOpened = true
      break
    } catch {
      await page.keyboard.press('Escape')
      await page.waitForTimeout(300)
    }
  }
  if (!settingsOpened) {
    throw new Error('Unable to open settings after 3 attempts')
  }

  const dialog = page.getByRole('dialog')
  await expect(dialog).toBeVisible({ timeout: 10000 })
  await dialog.getByRole('button', { name: /people/i }).click()
  await expect(dialog.getByText(/members/i).first()).toBeVisible({
    timeout: 5000,
  })
  return dialog
}
