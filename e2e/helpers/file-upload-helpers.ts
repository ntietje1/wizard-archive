import type { Page } from '@playwright/test'

export function uploadFileInput(page: Page) {
  return page.locator('input[type="file"][aria-label="Upload file"]')
}
