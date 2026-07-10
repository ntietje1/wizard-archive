import { fileURLToPath } from 'node:url'
import path from 'node:path'
import fs from 'node:fs'
import { expect, test } from '@playwright/test'
import { createCampaign, deleteCampaign, navigateToCampaign } from './helpers/campaign-helpers'
import { createNote } from './helpers/sidebar-helpers'
import {
  createMap,
  mapImage,
  mapPlacementTarget,
  openMap,
  uploadMapImage,
  writeTestMapImage,
} from './helpers/map-helpers'
import { AUTH_STORAGE_PATH, testName } from './helpers/constants'

const campaignName = testName('E2E Maps')
let mapName: string
let noteName: string

test.describe.serial('game maps', () => {
  let testImagePath: string

  test.beforeAll(async ({ browser }) => {
    const id = Date.now()
    mapName = `Test Map ${id}`
    noteName = `Pin Target ${id}`

    testImagePath = path.join(path.dirname(fileURLToPath(import.meta.url)), 'test-map-image.png')
    writeTestMapImage(testImagePath)

    const context = await browser.newContext({
      storageState: AUTH_STORAGE_PATH,
    })
    const page = await context.newPage()
    await page.goto('/campaigns', { waitUntil: 'commit' })
    await createCampaign(page, campaignName)
    await navigateToCampaign(page, campaignName)
    await createNote(page, noteName)
    await page.close()
    await context.close()
  })

  test.afterAll(async ({ browser }) => {
    if (testImagePath && fs.existsSync(testImagePath)) {
      fs.unlinkSync(testImagePath)
    }
    const context = await browser.newContext({
      storageState: AUTH_STORAGE_PATH,
    })
    const page = await context.newPage()
    await page.goto('/campaigns', { waitUntil: 'commit' })
    try {
      await deleteCampaign(page, campaignName)
    } catch {
      /* best-effort */
    }
    await page.close()
    await context.close()
  })

  test('create map appears in sidebar', async ({ page }) => {
    await page.goto('/campaigns', { waitUntil: 'commit' })
    await navigateToCampaign(page, campaignName)
    await createMap(page, mapName)

    const sidebar = page.getByRole('navigation', { name: 'Sidebar' })
    await expect(sidebar.getByRole('button', { name: mapName, exact: true })).toBeVisible()
  })

  test('upload map image and view with zoom controls', async ({ page }) => {
    await page.goto('/campaigns', { waitUntil: 'commit' })
    await navigateToCampaign(page, campaignName)
    await openMap(page, mapName)
    await uploadMapImage(page, testImagePath, mapName)

    await expect(page.getByRole('button', { name: /^zoom in$/i })).toBeVisible()
    await expect(page.getByRole('button', { name: /^zoom out$/i })).toBeVisible()
    await expect(page.getByRole('button', { name: /^reset view$/i })).toBeVisible()

    await page.getByRole('button', { name: /^zoom in$/i }).click()
    await page.getByRole('button', { name: /^reset view$/i }).click()
  })

  test('pin a sidebar item to the map', async ({ page }) => {
    await page.goto('/campaigns', { waitUntil: 'commit' })
    await navigateToCampaign(page, campaignName)
    await openMap(page, mapName)

    // Right-click the note in sidebar to pin it
    const sidebar = page.getByRole('navigation', { name: 'Sidebar' })
    await sidebar.getByRole('button', { name: noteName, exact: true }).click({ button: 'right' })
    await expect(page.getByRole('menu')).toBeVisible({ timeout: 5000 })

    const pinMenuItem = page.getByRole('menuitem', { name: /pin to map/i })
    await expect(pinMenuItem).toBeVisible({ timeout: 3000 })
    await pinMenuItem.click()

    const canvas = mapPlacementTarget(page)
    await expect(canvas).toBeVisible()

    const image = mapImage(page, mapName)
    await image.waitFor({ state: 'visible', timeout: 10000 })
    await page.waitForFunction(
      (el) => {
        const img = el as HTMLImageElement | null
        return img != null && img.complete && img.naturalWidth > 0
      },
      await image.elementHandle(),
      { timeout: 10000 },
    )

    await canvas.click({ force: true })
    await expect(page.locator('[data-pin-id]').first()).toBeVisible({
      timeout: 10000,
    })
  })

  test('pin context menu shows actions', async ({ page }) => {
    await page.goto('/campaigns', { waitUntil: 'commit' })
    await navigateToCampaign(page, campaignName)
    await openMap(page, mapName)

    const pin = page.locator('[data-pin-id]').first()
    await expect(pin).toBeVisible({ timeout: 15000 })
    await pin.click({ button: 'right' })

    await expect(page.getByRole('menuitem', { name: 'Move Pin', exact: true })).toBeVisible({
      timeout: 3000,
    })
    await expect(page.getByRole('menuitem', { name: 'Remove Pin', exact: true })).toBeVisible()

    await page.keyboard.press('Escape')
  })

  test('toggle pin visibility', async ({ page }) => {
    await page.goto('/campaigns', { waitUntil: 'commit' })
    await navigateToCampaign(page, campaignName)
    await openMap(page, mapName)

    const pin = page.locator('[data-pin-id]').first()
    await expect(pin).toBeVisible({ timeout: 5000 })
    await pin.click({ button: 'right' })

    const toggleItem = page.getByRole('menuitem', {
      name: /hide pin|show pin/i,
    })
    await expect(toggleItem).toBeVisible({ timeout: 3000 })
    const label = await toggleItem.textContent()
    const wasHiding = /hide/i.test(label ?? '')
    await toggleItem.click()

    if (wasHiding) {
      await expect(pin).toBeHidden({ timeout: 5000 })

      // Restore pin visibility for subsequent tests
      await pin.click({ button: 'right', force: true })
      const showItem = page.getByRole('menuitem', { name: /show pin/i })
      await expect(showItem).toBeVisible({ timeout: 3000 })
      await showItem.click()
      await expect(pin).toBeVisible({ timeout: 5000 })
    } else {
      await expect(pin).toBeVisible({ timeout: 5000 })
    }
  })

  test('remove pin from map', async ({ page }) => {
    await page.goto('/campaigns', { waitUntil: 'commit' })
    await navigateToCampaign(page, campaignName)
    await openMap(page, mapName)

    const pin = page.locator('[data-pin-id]').first()
    await expect(pin).toBeVisible({ timeout: 5000 })
    const pinCount = await page.locator('[data-pin-id]').count()
    await pin.click({ button: 'right' })
    await page.getByRole('menuitem', { name: 'Remove Pin', exact: true }).click()

    await expect(page.locator('[data-pin-id]')).toHaveCount(pinCount - 1, {
      timeout: 5000,
    })
  })
})
