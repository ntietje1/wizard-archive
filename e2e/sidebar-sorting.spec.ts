import { expect, test } from '@playwright/test'
import { createCampaign, deleteCampaign, navigateToCampaign } from './helpers/campaign-helpers'
import { createNote } from './helpers/sidebar-helpers'
import { AUTH_STORAGE_PATH, testName } from './helpers/constants'

const campaignName = testName('E2E Sorting')
let noteAlpha: string
let noteBeta: string
let noteCharlie: string

test.describe.serial('sidebar sorting', () => {
  test.beforeAll(async ({ browser }) => {
    const id = Date.now()
    noteAlpha = `Alpha ${id}-1`
    noteBeta = `Beta ${id}-2`
    noteCharlie = `Charlie ${id}-3`

    const context = await browser.newContext({
      storageState: AUTH_STORAGE_PATH,
    })
    const page = await context.newPage()
    await page.goto('/campaigns')
    await createCampaign(page, campaignName)
    await navigateToCampaign(page, campaignName)
    // Sequential creates with small delays to ensure distinct _creationTime values for date-sort tests
    await createNote(page, noteAlpha)
    await page.waitForTimeout(100)
    await createNote(page, noteBeta)
    await page.waitForTimeout(100)
    await createNote(page, noteCharlie)
    await page.close()
    await context.close()
  })

  test.afterAll(async ({ browser }) => {
    const context = await browser.newContext({
      storageState: AUTH_STORAGE_PATH,
    })
    const page = await context.newPage()
    await page.goto('/campaigns')
    try {
      await deleteCampaign(page, campaignName)
    } catch {
      /* best-effort */
    }
    await page.close()
    await context.close()
  })

  test('sort alphabetical ascending', async ({ page }) => {
    await page.goto('/campaigns')
    await navigateToCampaign(page, campaignName)

    const sidebar = page.getByRole('navigation', { name: 'Sidebar' })

    await page.getByRole('button', { name: 'Sort options' }).click()
    await page.getByRole('menuitemradio', { name: 'Alphabetical' }).click()
    await page.getByRole('menuitemradio', { name: 'Ascending' }).click()
    await page.keyboard.press('Escape')

    await expect(async () => {
      const texts = await sidebar.getByRole('link').allTextContents()
      const alphaIdx = texts.findIndex((t) => t.includes('Alpha'))
      const betaIdx = texts.findIndex((t) => t.includes('Beta'))
      const charlieIdx = texts.findIndex((t) => t.includes('Charlie'))
      expect(alphaIdx).toBeGreaterThanOrEqual(0)
      expect(alphaIdx).toBeLessThan(betaIdx)
      expect(betaIdx).toBeLessThan(charlieIdx)
    }).toPass({ timeout: 5000 })
  })

  test('sort alphabetical descending', async ({ page }) => {
    await page.goto('/campaigns')
    await navigateToCampaign(page, campaignName)

    await page.getByRole('button', { name: 'Sort options' }).click()
    await page.getByRole('menuitemradio', { name: 'Alphabetical' }).click()
    await page.getByRole('menuitemradio', { name: 'Descending' }).click()
    await page.keyboard.press('Escape')

    const sidebar = page.getByRole('navigation', { name: 'Sidebar' })

    await expect(async () => {
      const texts = await sidebar.getByRole('link').allTextContents()
      const alphaIdx = texts.findIndex((t) => t.includes('Alpha'))
      const betaIdx = texts.findIndex((t) => t.includes('Beta'))
      const charlieIdx = texts.findIndex((t) => t.includes('Charlie'))
      expect(alphaIdx).toBeGreaterThanOrEqual(0)
      expect(betaIdx).toBeGreaterThanOrEqual(0)
      expect(charlieIdx).toBeGreaterThanOrEqual(0)
      expect(charlieIdx).toBeLessThan(betaIdx)
      expect(betaIdx).toBeLessThan(alphaIdx)
    }).toPass({ timeout: 5000 })
  })

  test('sort by date created changes order', async ({ page }) => {
    await page.goto('/campaigns')
    await navigateToCampaign(page, campaignName)

    await page.getByRole('button', { name: 'Sort options' }).click()
    await page.getByRole('menuitemradio', { name: 'Date Created' }).click()
    await page.getByRole('menuitemradio', { name: 'Ascending' }).click()
    await page.keyboard.press('Escape')

    const sidebar = page.getByRole('navigation', { name: 'Sidebar' })

    await expect(async () => {
      const texts = await sidebar.getByRole('link').allTextContents()
      const alphaIdx = texts.findIndex((t) => t.includes('Alpha'))
      const betaIdx = texts.findIndex((t) => t.includes('Beta'))
      const charlieIdx = texts.findIndex((t) => t.includes('Charlie'))
      expect(alphaIdx).toBeGreaterThanOrEqual(0)
      expect(betaIdx).toBeGreaterThanOrEqual(0)
      expect(charlieIdx).toBeGreaterThanOrEqual(0)
      expect(alphaIdx).toBeLessThan(betaIdx)
      expect(betaIdx).toBeLessThan(charlieIdx)
    }).toPass({ timeout: 5000 })
  })
})
