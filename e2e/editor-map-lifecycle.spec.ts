import zlib from 'node:zlib'
import { expect, test } from '@playwright/test'
import { createCampaign, deleteCampaign, navigateToCampaign } from './helpers/campaign-helpers'
import { AUTH_STORAGE_PATH, testName } from './helpers/constants'
import type { Page } from '@playwright/test'

const campaignName = testName('Map Lifecycle')
const mapName = 'Moonwell Map'
const noteName = 'Pin Target'

test.describe.serial('canonical map lifecycle', () => {
  test.beforeAll(async ({ browser }) => {
    const context = await browser.newContext({ storageState: AUTH_STORAGE_PATH })
    const page = await context.newPage()
    await page.goto('/campaigns', { waitUntil: 'commit' })
    await createCampaign(page, campaignName)
    await context.close()
  })

  test.afterAll(async ({ browser }) => {
    const context = await browser.newContext({ storageState: AUTH_STORAGE_PATH })
    const page = await context.newPage()
    await page.goto('/campaigns', { waitUntil: 'commit' })
    try {
      await deleteCampaign(page, campaignName)
    } catch {
      // Cleanup is best-effort so a failed assertion keeps its original evidence.
    }
    await context.close()
  })

  test.beforeEach(async ({ page }) => {
    await page.goto('/campaigns', { waitUntil: 'commit' })
    await navigateToCampaign(page, campaignName)
  })

  test('creates a map, attaches and replaces verified image bytes, and exposes transforms', async ({
    page,
  }) => {
    await createResource(page, 'Note', noteName)
    await createResource(page, 'Map', mapName)

    const map = page.getByLabel('Map content')
    await expect(map).toBeVisible()
    await map.getByLabel('Choose map image').setInputFiles({
      name: 'moonwell.png',
      mimeType: 'image/png',
      buffer: createPng(200, 160, 0x33),
    })

    const image = map.getByRole('img', { name: `${mapName} map` })
    await expect(image).toBeVisible({ timeout: 15_000 })
    const originalUrl = await image.getAttribute('src')
    await map.getByRole('button', { name: 'Zoom in' }).click()
    await map.getByRole('button', { name: 'Zoom out' }).click()
    await map.getByRole('button', { name: 'Fit map' }).click()

    await map.getByLabel('Choose map image').setInputFiles({
      name: 'moonwell-replacement.png',
      mimeType: 'image/png',
      buffer: createPng(240, 180, 0x66),
    })
    await expect.poll(() => image.getAttribute('src')).not.toBe(originalUrl)

    await map.click({ button: 'right', position: { x: 40, y: 80 } })
    const menu = page.getByRole('menu', { name: 'Map image actions' })
    await expect(menu.getByRole('menuitem', { name: 'Fit map' })).toBeVisible()
    await expect(menu.getByRole('menuitem', { name: 'Replace image' })).toBeVisible()
  })

  test('creates a UUID pin by sidebar drop and restores move, visibility, readonly, and removal', async ({
    page,
  }) => {
    await page.getByRole('button', { name: mapName, exact: true }).click()
    const map = page.getByLabel('Map content')
    const image = map.getByRole('img', { name: `${mapName} map` })
    await expect(image).toBeVisible({ timeout: 15_000 })

    const target = page.getByRole('button', { name: noteName, exact: true })
    const canvas = map.getByRole('region', { name: 'Map canvas' })
    await target.dragTo(canvas, {
      targetPosition: { x: 80, y: 70 },
    })
    await expect(map.getByRole('status')).toContainText('Pin created')

    let pin = map.getByRole('button', { name: noteName, exact: true })
    await expect(pin).toBeVisible()
    const originalPosition = await pin.getAttribute('style')
    await pin.click({ button: 'right' })
    await page.getByRole('menuitem', { name: 'Move pin', exact: true }).click()
    await expect(map.getByText('Click the map to move the pin')).toBeVisible()
    await canvas.click({ position: { x: 140, y: 100 } })
    await expect(map.getByRole('status')).toContainText('Pin moved')
    await expect.poll(() => pin.getAttribute('style')).not.toBe(originalPosition)

    await pin.click({ button: 'right' })
    await page.getByRole('menuitem', { name: 'Hide pin' }).click()
    await expect(map.getByRole('status')).toContainText('Pin hidden')
    pin = map.getByRole('button', { name: `${noteName} (hidden)`, exact: true })
    await expect(pin).toBeVisible()

    await page.getByRole('button', { name: 'Viewer' }).click()
    await expect(map.getByText('Viewing map — changes are disabled')).toBeVisible()
    await expect(pin).toBeHidden()
    await expect(map.getByLabel('Choose map image')).toBeHidden()

    await page.getByRole('button', { name: 'Editor' }).click()
    pin = map.getByRole('button', { name: `${noteName} (hidden)`, exact: true })
    await pin.click({ button: 'right' })
    await page.getByRole('menuitem', { name: 'Show pin' }).click()
    pin = map.getByRole('button', { name: noteName, exact: true })
    await expect(pin).toBeVisible()

    await pin.dblclick()
    await expect(page.getByRole('heading', { name: noteName })).toBeVisible()
    await page.getByRole('button', { name: mapName, exact: true }).click()
    pin = page.getByLabel('Map content').getByRole('button', { name: noteName, exact: true })
    await pin.click({ button: 'right' })
    await page.getByRole('menuitem', { name: 'Remove pin' }).click()
    await expect(page.getByLabel('Map content').getByRole('status')).toContainText('Pin removed')
    await expect(pin).toBeHidden()
  })
})

async function createResource(page: Page, kind: 'Map' | 'Note', title: string) {
  await page.getByRole('button', { name: 'Create resource', exact: true }).click()
  await page.getByRole('textbox', { name: 'New resource title' }).fill(title)
  await page.getByRole('menuitem', { name: kind, exact: true }).click()
  await expect(page.getByRole('button', { name: title, exact: true })).toBeVisible({
    timeout: 15_000,
  })
}

function createPng(width: number, height: number, value: number): Buffer {
  const header = Buffer.alloc(13)
  header.writeUInt32BE(width, 0)
  header.writeUInt32BE(height, 4)
  header[8] = 8
  header[9] = 2
  const scanlines = Buffer.alloc(height * (1 + width * 3), value)
  for (let row = 0; row < height; row += 1) scanlines[row * (1 + width * 3)] = 0
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk('IHDR', header),
    pngChunk('IDAT', zlib.deflateSync(scanlines)),
    pngChunk('IEND', Buffer.alloc(0)),
  ])
}

function pngChunk(type: string, data: Buffer): Buffer {
  const length = Buffer.alloc(4)
  length.writeUInt32BE(data.length)
  const body = Buffer.concat([Buffer.from(type), data])
  const checksum = Buffer.alloc(4)
  checksum.writeUInt32BE(crc32(body))
  return Buffer.concat([length, body, checksum])
}

function crc32(bytes: Buffer): number {
  let checksum = 0xffffffff
  for (const byte of bytes) {
    checksum ^= byte
    for (let bit = 0; bit < 8; bit += 1) {
      checksum = (checksum >>> 1) ^ (checksum & 1 ? 0xedb88320 : 0)
    }
  }
  return (checksum ^ 0xffffffff) >>> 0
}
