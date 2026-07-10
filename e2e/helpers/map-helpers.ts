import { expect } from '@playwright/test'
import fs from 'node:fs'
import zlib from 'node:zlib'
import { openItem, sidebarItem, waitForFilesystemIdle } from './sidebar-helpers'
import type { Page } from '@playwright/test'

export async function createMap(page: Page, name: string) {
  const mapButton = page.getByRole('button', { name: /map.*upload an image/i })
  await expect(mapButton).toBeVisible({ timeout: 10000 })
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      await mapButton.click({ timeout: 10000 })
      break
    } catch (error) {
      if (attempt === 2) throw error
      await expect(mapButton).toBeVisible({ timeout: 10000 })
    }
  }

  const textbox = page.getByRole('textbox', { name: 'Item name' })
  await expect(textbox).toHaveValue(/untitled/i, { timeout: 10000 })
  await textbox.click()
  await textbox.fill(name)
  await textbox.press('Enter')
  await expect(textbox).toHaveAttribute('readonly', '', { timeout: 5000 })

  await expect(sidebarItem(page, name)).toBeVisible({
    timeout: 10000,
  })
  await waitForFilesystemIdle(page)
}

export async function openMap(page: Page, name: string) {
  await openItem(page, name)
  await expect(page.getByRole('button', { name: /^zoom in$/i })).toBeVisible({ timeout: 30000 })
  if (
    await mapImage(page, name)
      .isVisible({ timeout: 1000 })
      .catch(() => false)
  ) {
    await waitForMapIdle(page)
  }
}

export async function uploadMapImage(page: Page, imagePath: string, mapName: string) {
  const fileInput = page.locator('input[type="file"]').first()
  await fileInput.setInputFiles(imagePath)
  await expect(mapImage(page, mapName)).toBeVisible({
    timeout: 15000,
  })
  await waitForMapIdle(page)
}

export function mapImage(page: Page, mapName: string) {
  return page.getByRole('img', { name: mapName, exact: true })
}

export function mapPlacementTarget(page: Page) {
  return page.getByRole('button', { name: 'Map canvas' })
}

async function waitForMapIdle(page: Page) {
  await expect(
    page
      .getByRole('status')
      .filter({ hasText: /^Loading$/ })
      .first(),
  ).not.toBeVisible({
    timeout: 30000,
  })
}

export function writeTestMapImage(imagePath: string) {
  fs.writeFileSync(imagePath, createTestPng(200, 200))
}

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
