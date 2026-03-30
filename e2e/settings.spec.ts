import { expect, test } from '@playwright/test'

test('open settings from user menu', async ({ page }) => {
  await page.goto('/campaigns', { waitUntil: 'networkidle' })
  await page.getByRole('button', { name: 'User menu' }).click()
  await page.getByRole('button', { name: /settings/i }).click()
  await expect(page.getByRole('dialog', { name: /settings/i })).toBeVisible()
})

test('theme toggle changes html class', async ({ page }) => {
  await page.goto('/campaigns', { waitUntil: 'networkidle' })
  await page.getByRole('button', { name: 'User menu' }).click()
  await page.getByRole('button', { name: /settings/i }).click()
  await page.getByRole('button', { name: /preferences/i }).click()

  const initialClass = await page.locator('html').getAttribute('class')
  const targetTheme = initialClass?.includes('dark') ? /^light\b/i : /^dark\b/i
  await page.getByRole('button', { name: targetTheme }).click()
  const newClass = await page.locator('html').getAttribute('class')
  expect(newClass).not.toEqual(initialClass)
})
