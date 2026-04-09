import { expect, test } from '@playwright/test'

test.describe.serial('account settings', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/campaigns')

    const userMenuButton = page.getByRole('button', { name: 'User menu' })
    await expect(userMenuButton).toBeVisible({ timeout: 10000 })
    await userMenuButton.click()

    await page.getByRole('button', { name: /settings/i }).click()

    await expect(page.getByRole('dialog', { name: /settings/i })).toBeVisible({
      timeout: 10000,
    })
  })

  test('open settings dialog and verify profile tab', async ({ page }) => {
    const dialog = page.getByRole('dialog', { name: /settings/i })
    await expect(dialog.getByLabel(/preferred name/i)).toBeVisible()
  })

  test('preferred name input is editable', async ({ page }) => {
    const dialog = page.getByRole('dialog', { name: /settings/i })
    const nameInput = dialog.getByLabel(/preferred name/i)
    await expect(nameInput).toBeVisible()
    await expect(nameInput).toBeEditable()
    await expect(nameInput).toHaveValue(/.+/)
  })

  test('change username dialog opens and closes', async ({ page }) => {
    const dialog = page.getByRole('dialog', { name: /settings/i })
    await dialog.getByRole('button', { name: /change username/i }).click()

    const usernameDialog = page.getByRole('dialog', {
      name: /change username/i,
    })
    await expect(usernameDialog).toBeVisible({ timeout: 5000 })

    await page.keyboard.press('Escape')
    await expect(usernameDialog).not.toBeVisible({ timeout: 5000 })
  })

  test('account security section is visible', async ({ page }) => {
    const dialog = page.getByRole('dialog', { name: /settings/i })
    await expect(dialog.getByRole('heading', { name: /account security/i })).toBeVisible()
    await expect(dialog.getByText(/email/i).first()).toBeVisible()
  })

  test('user ID section with copy button exists', async ({ page }) => {
    const dialog = page.getByRole('dialog', { name: /settings/i })
    await expect(dialog.getByRole('heading', { name: 'User ID' })).toBeVisible()
    await expect(dialog.getByRole('button', { name: /copy/i })).toBeVisible()
  })
})
