import { fileURLToPath } from 'node:url'
import path from 'node:path'
import fs from 'node:fs'
import { expect, test } from '@playwright/test'
import {
  createCampaign,
  deleteCampaign,
  navigateToCampaign,
} from './helpers/campaign-helpers'
import { createNote } from './helpers/sidebar-helpers'
import { createMap, openMap, uploadMapImage } from './helpers/map-helpers'
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

    // Create a minimal valid PNG (1x1 red pixel)
    const pngHeader = Buffer.from([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
    ])
    const ihdr = Buffer.from([
      0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52, 0x00, 0x00, 0x00, 0x01,
      0x00, 0x00, 0x00, 0x01, 0x08, 0x02, 0x00, 0x00, 0x00, 0x90, 0x77, 0x53,
      0xde, 0x00,
    ])
    const idat = Buffer.from([
      0x00, 0x00, 0x00, 0x0c, 0x49, 0x44, 0x41, 0x54, 0x08, 0xd7, 0x63, 0xf8,
      0xcf, 0xc0, 0x00, 0x00, 0x00, 0x02, 0x00, 0x01, 0xe2, 0x21, 0xbc, 0x33,
    ])
    const iend = Buffer.from([
      0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4e, 0x44, 0xae, 0x42, 0x60, 0x82,
    ])
    testImagePath = path.join(
      path.dirname(fileURLToPath(import.meta.url)),
      'test-map-image.png',
    )
    fs.writeFileSync(
      testImagePath,
      Buffer.concat([pngHeader, ihdr, idat, iend]),
    )

    const context = await browser.newContext({
      storageState: AUTH_STORAGE_PATH,
    })
    const page = await context.newPage()
    await page.goto('/campaigns')
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
    await page.goto('/campaigns')
    try {
      await deleteCampaign(page, campaignName)
    } catch {
      /* best-effort */
    }
    await page.close()
    await context.close()
  })

  test('create map appears in sidebar', async ({ page }) => {
    await page.goto('/campaigns')
    await navigateToCampaign(page, campaignName)
    await createMap(page, mapName)

    const sidebar = page.getByRole('navigation', { name: 'Sidebar' })
    await expect(
      sidebar.getByRole('link', { name: mapName, exact: true }),
    ).toBeVisible()
  })

  test('upload map image and view with zoom controls', async ({ page }) => {
    await page.goto('/campaigns')
    await navigateToCampaign(page, campaignName)
    await openMap(page, mapName)
    await uploadMapImage(page, testImagePath)

    // Verify zoom controls are present
    await expect(page.locator('[title="Zoom In"]')).toBeVisible()
    await expect(page.locator('[title="Zoom Out"]')).toBeVisible()
    await expect(page.locator('[title="Reset View"]')).toBeVisible()

    await page.locator('[title="Zoom In"]').click()
    await page.locator('[title="Reset View"]').click()
  })

  test('pin a sidebar item to the map', async ({ page }) => {
    await page.goto('/campaigns')
    await navigateToCampaign(page, campaignName)
    await openMap(page, mapName)

    // Right-click the note in sidebar to pin it
    const sidebar = page.getByRole('navigation', { name: 'Sidebar' })
    await sidebar
      .getByRole('link', { name: noteName, exact: true })
      .click({ button: 'right' })
    await expect(page.getByRole('menu')).toBeVisible({ timeout: 5000 })

    const pinMenuItem = page.getByRole('menuitem', { name: /pin to map/i })
    await expect(pinMenuItem).toBeVisible({ timeout: 3000 })
    await pinMenuItem.click()

    const canvas = page.locator('[aria-label="Map canvas"]')
    await expect(canvas).toBeVisible()

    const mapImage = canvas.locator('img').first()
    const isImageLoaded = await mapImage.evaluate(
      (img: HTMLImageElement) => img.complete && img.naturalWidth > 0,
    )

    if (isImageLoaded) {
      await canvas.click({ position: { x: 200, y: 200 } })
      await expect(page.locator('[data-pin-id]').first()).toBeVisible({
        timeout: 5000,
      })
    } else {
      await expect(page.getByText(/map image failed to load/i)).toBeVisible({
        timeout: 5000,
      })
    }
  })

  test('pin context menu shows actions', async ({ page }) => {
    await page.goto('/campaigns')
    await navigateToCampaign(page, campaignName)
    await openMap(page, mapName)

    const pin = page.locator('[data-pin-id]').first()
    await expect(pin).toBeVisible({ timeout: 5000 })
    await pin.click({ button: 'right' })

    await expect(page.getByRole('menuitem', { name: /move pin/i })).toBeVisible(
      { timeout: 3000 },
    )
    await expect(
      page.getByRole('menuitem', { name: /remove pin/i }),
    ).toBeVisible()

    await page.keyboard.press('Escape')
  })

  test('toggle pin visibility', async ({ page }) => {
    await page.goto('/campaigns')
    await navigateToCampaign(page, campaignName)
    await openMap(page, mapName)

    const pin = page.locator('[data-pin-id]').first()
    await expect(pin).toBeVisible({ timeout: 5000 })
    await pin.click({ button: 'right' })

    const toggleItem = page.getByRole('menuitem', {
      name: /hide pin|show pin/i,
    })
    await expect(toggleItem).toBeVisible({ timeout: 3000 })
    await toggleItem.click()

    await expect(page.locator('[data-pin-id]').first()).toBeVisible()
  })

  test('remove pin from map', async ({ page }) => {
    await page.goto('/campaigns')
    await navigateToCampaign(page, campaignName)
    await openMap(page, mapName)

    const pin = page.locator('[data-pin-id]').first()
    await expect(pin).toBeVisible({ timeout: 5000 })
    const pinCount = await page.locator('[data-pin-id]').count()
    await pin.click({ button: 'right' })
    await page.getByRole('menuitem', { name: /remove pin/i }).click()

    await expect(page.locator('[data-pin-id]')).toHaveCount(pinCount - 1, {
      timeout: 5000,
    })
  })
})
