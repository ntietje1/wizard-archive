import { fileURLToPath } from 'node:url'
import path from 'node:path'
import fs from 'node:fs'
import zlib from 'node:zlib'
import { expect, test } from '@playwright/test'
import {
  createCampaign,
  deleteCampaign,
  navigateToCampaign,
} from './helpers/campaign-helpers'
import { createNote } from './helpers/sidebar-helpers'
import { createMap, openMap, uploadMapImage } from './helpers/map-helpers'
import { AUTH_STORAGE_PATH, testName } from './helpers/constants'

function crc32(buf: Buffer): number {
  let crc = 0xffffffff
  for (const byte of buf) {
    crc ^= byte
    for (let j = 0; j < 8; j++) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0)
  }
  return (crc ^ 0xffffffff) >>> 0
}

function pngChunk(type: string, data: Buffer): Buffer {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length)
  const typeData = Buffer.concat([Buffer.from(type), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(typeData))
  return Buffer.concat([len, typeData, crc])
}

function createTestPng(w: number, h: number): Buffer {
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(w, 0)
  ihdr.writeUInt32BE(h, 4)
  ihdr[8] = 8
  ihdr[9] = 2
  const raw = Buffer.alloc(h * (1 + w * 3), 0)
  for (let y = 0; y < h; y++) raw[y * (1 + w * 3)] = 0
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', zlib.deflateSync(raw)),
    pngChunk('IEND', Buffer.alloc(0)),
  ])
}

const campaignName = testName('E2E Maps')
let mapName: string
let noteName: string

test.describe.serial('game maps', () => {
  let testImagePath: string

  test.beforeAll(async ({ browser }) => {
    const id = Date.now()
    mapName = `Test Map ${id}`
    noteName = `Pin Target ${id}`

    testImagePath = path.join(
      path.dirname(fileURLToPath(import.meta.url)),
      'test-map-image.png',
    )
    fs.writeFileSync(testImagePath, createTestPng(200, 200))

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
    await expect(mapImage).toBeVisible({ timeout: 10000 })
    const isImageLoaded = await mapImage.evaluate(
      (img: HTMLImageElement) => img.complete && img.naturalWidth > 0,
    )
    if (!isImageLoaded) {
      throw new Error('Map image failed to load — cannot place pin')
    }

    await mapImage.click({ force: true })
    await expect(page.locator('[data-pin-id]').first()).toBeVisible({
      timeout: 10000,
    })
  })

  test('pin context menu shows actions', async ({ page }) => {
    await page.goto('/campaigns')
    await navigateToCampaign(page, campaignName)
    await openMap(page, mapName)

    const pin = page.locator('[data-pin-id]').first()
    await expect(pin).toBeVisible({ timeout: 15000 })
    await pin.click({ button: 'right' })

    await expect(
      page.getByRole('menuitem', { name: 'Move Pin', exact: true }),
    ).toBeVisible({ timeout: 3000 })
    await expect(
      page.getByRole('menuitem', { name: 'Remove Pin', exact: true }),
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
    await page.goto('/campaigns')
    await navigateToCampaign(page, campaignName)
    await openMap(page, mapName)

    const pin = page.locator('[data-pin-id]').first()
    await expect(pin).toBeVisible({ timeout: 5000 })
    const pinCount = await page.locator('[data-pin-id]').count()
    await pin.click({ button: 'right' })
    await page
      .getByRole('menuitem', { name: 'Remove Pin', exact: true })
      .click()

    await expect(page.locator('[data-pin-id]')).toHaveCount(pinCount - 1, {
      timeout: 5000,
    })
  })
})
