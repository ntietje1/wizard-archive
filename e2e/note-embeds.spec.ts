import { fileURLToPath } from 'node:url'
import fs from 'node:fs'
import path from 'node:path'
import { expect, test } from '@playwright/test'
import { api } from 'convex/_generated/api'
import { createCampaign, deleteCampaign, navigateToCampaign } from './helpers/campaign-helpers'
import { getEditor, selectSlashMenuItem } from './helpers/editor-helpers'
import {
  createNote,
  openItem,
  selectableSidebarRow,
  sidebarLink,
  waitForFilesystemIdle,
} from './helpers/sidebar-helpers'
import { AUTH_STORAGE_PATH, testName } from './helpers/constants'
import {
  createE2EConvexClient,
  getCampaignIdFromRoute,
  getCampaignRouteFromUrl,
  getSidebarItemBySlug,
  getSidebarItemIdBySlug,
} from './helpers/convex-helpers'
import { makeYjsUpdateWithBlocks } from '../convex/_test/yjs.helper'
import type { Locator, Page, TestInfo } from '@playwright/test'
import type { CustomPartialBlock } from '../shared/editor-blocks/types'

const campaignName = testName('E2E NoteEmbeds')
const sourceNoteContent = `Embedded source content ${Date.now()}`
const testDir = path.dirname(fileURLToPath(import.meta.url))
const imageFileName = 'note-embed-upload.png'
const imageFilePath = path.join(testDir, imageFileName)

test.describe.serial('note embeds', () => {
  test.setTimeout(30_000)

  test.beforeAll(async ({ browser }) => {
    fs.writeFileSync(imageFilePath, createOnePixelPng())

    const context = await browser.newContext({ storageState: AUTH_STORAGE_PATH })
    const page = await context.newPage()
    await page.goto('/campaigns')
    await createCampaign(page, campaignName)
    await navigateToCampaign(page, campaignName)
    await waitForFilesystemIdle(page)

    await createNote(page, sourceNoteName())
    await persistSourceNoteContent(page)

    await page.close()
    await context.close()
  })

  test.afterAll(async ({ browser }) => {
    if (fs.existsSync(imageFilePath)) fs.unlinkSync(imageFilePath)

    const context = await browser.newContext({ storageState: AUTH_STORAGE_PATH })
    const page = await context.newPage()
    await page.goto('/campaigns')
    try {
      await deleteCampaign(page, campaignName)
    } finally {
      await page.close()
      await context.close()
    }
  })

  test('embeds a sidebar note through an empty embed block and persists after navigation', async ({
    page,
  }, testInfo) => {
    const hostName = uniqueName('Note Embed Host', testInfo)
    await openCampaign(page)
    await createNote(page, hostName)
    const block = await insertEmptyEmbedBlock(page)

    await dragSidebarItemToEmbed(page, sourceNoteName(), block)

    await expect(block.getByText(sourceNoteContent)).toBeVisible({ timeout: 15_000 })

    await openItem(page, sourceNoteName())
    await openItem(page, hostName)
    await expect(page.getByTestId('note-embed-block').getByText(sourceNoteContent)).toBeVisible({
      timeout: 15_000,
    })
  })

  test('keeps a note self-drop as an empty embed', async ({ page }, testInfo) => {
    const hostName = uniqueName('Self Embed Host', testInfo)
    await openCampaign(page)
    await createNote(page, hostName)
    const block = await insertEmptyEmbedBlock(page)

    await dragSidebarItemToEmbed(page, hostName, block)

    await expect(block.getByTestId('embed-empty-state')).toBeVisible()
    await expect(block.getByText('Drag and drop an item or file here')).toBeVisible()
  })

  test('links an external file from an empty note embed', async ({ page }, testInfo) => {
    await openCampaign(page)
    await createNote(page, uniqueName('External Embed Host', testInfo))
    const block = await insertEmptyEmbedBlock(page)

    await block.getByRole('button', { name: 'or link to an external file' }).click()
    await page
      .getByRole('textbox', { name: 'External file URL' })
      .fill('https://example.com/lore.wacz')
    await block.getByRole('button', { name: 'Link', exact: true }).click()

    await expect(block.getByTestId('external-url-embed-card')).toContainText('lore.wacz')
    await expect(block.getByRole('link', { name: 'Open file' })).toHaveAttribute(
      'href',
      'https://example.com/lore.wacz',
    )
  })

  test('uploads from an empty note embed into the Assets folder and embeds the file', async ({
    page,
  }, testInfo) => {
    await openCampaign(page)
    await createNote(page, uniqueName('Upload Embed Host', testInfo))
    const block = await insertEmptyEmbedBlock(page)

    const fileChooserPromise = page.waitForEvent('filechooser')
    await block.getByRole('button', { name: 'Upload' }).click()
    const fileChooser = await fileChooserPromise
    await fileChooser.setFiles(imageFilePath)

    await expect(sidebarLink(page, 'Assets')).toBeVisible({ timeout: 15_000 })
    await expectFileInAssetsFolder(page)
    await expect(block.getByRole('img', { name: imageFileName })).toBeVisible({ timeout: 15_000 })
  })

  test('moves an existing media embed block without duplicating it', async ({ page }, testInfo) => {
    const hostName = uniqueName('Internal Media Drag Host', testInfo)
    const beforeText = uniqueName('Before internal media drag', testInfo)
    const afterText = uniqueName('After internal media drag', testInfo)
    const embedName = 'movable-note-embed.png'

    await openCampaign(page)
    await createNote(page, hostName)
    await persistNoteBlocks(page, hostName, [
      paragraphBlock('internal-media-drag-before', beforeText),
      {
        id: 'internal-media-drag-source',
        type: 'embed',
        props: {
          targetKind: 'externalUrl',
          url: 'https://example.com/movable-note-embed.png',
          name: embedName,
          previewWidth: 320,
        },
        children: [],
      },
      {
        id: 'internal-media-drag-empty-target',
        type: 'embed',
        props: { targetKind: 'empty' },
        children: [],
      },
      paragraphBlock('internal-media-drag-after', afterText),
    ])
    await openItem(page, hostName)

    const embedBlocks = page.getByTestId('note-embed-block')
    await expect(embedBlocks).toHaveCount(2)
    await expect(embedBlocks.first().getByText(embedName)).toBeVisible({ timeout: 10_000 })
    await expect(embedBlocks.nth(1).getByTestId('embed-empty-state')).toBeVisible()

    await dragFirstEmbedSurfaceBelowText(page, afterText)

    await expect(embedBlocks).toHaveCount(2)
    await expect
      .poll(() => getEditorBlockOrder(page), { timeout: 10_000 })
      .toEqual(['text', 'embed', 'text', 'embed'])
  })

  test('moves an existing video embed block when dragging the video surface', async ({
    page,
  }, testInfo) => {
    const hostName = uniqueName('Video Surface Drag Host', testInfo)
    const beforeText = uniqueName('Before video surface drag', testInfo)
    const afterText = uniqueName('After video surface drag', testInfo)
    const embedName = 'movable-video.mp4'

    await openCampaign(page)
    await createNote(page, hostName)
    await persistNoteBlocks(page, hostName, [
      paragraphBlock('video-surface-drag-before', beforeText),
      {
        id: 'video-surface-drag-source',
        type: 'embed',
        props: {
          targetKind: 'externalUrl',
          url: 'https://example.com/movable-video.mp4',
          name: embedName,
          previewWidth: 320,
        },
        children: [],
      },
      {
        id: 'video-surface-drag-empty-target',
        type: 'embed',
        props: { targetKind: 'empty' },
        children: [],
      },
      paragraphBlock('video-surface-drag-after', afterText),
    ])
    await openItem(page, hostName)

    const embedBlocks = page.getByTestId('note-embed-block')
    await expect(embedBlocks).toHaveCount(2)
    await expect(embedBlocks.first().getByText(embedName)).toBeVisible({ timeout: 10_000 })
    await expect(embedBlocks.nth(1).getByTestId('embed-empty-state')).toBeVisible()

    await dragFirstVideoSurfaceBelowText(page, afterText)

    await expect(embedBlocks).toHaveCount(2)
    await expect
      .poll(() => getEditorBlockOrder(page), { timeout: 10_000 })
      .toEqual(['text', 'embed', 'text', 'embed'])
  })

  test('moves a focused video embed block when dragging the video surface', async ({
    page,
  }, testInfo) => {
    const hostName = uniqueName('Focused Video Drag Host', testInfo)
    const beforeText = uniqueName('Before focused video drag', testInfo)
    const afterText = uniqueName('After focused video drag', testInfo)
    const embedName = 'focused-video.mp4'

    await openCampaign(page)
    await createNote(page, hostName)
    await persistNoteBlocks(page, hostName, [
      paragraphBlock('focused-video-drag-before', beforeText),
      {
        id: 'focused-video-drag-source',
        type: 'embed',
        props: {
          targetKind: 'externalUrl',
          url: 'https://example.com/focused-video.mp4',
          name: embedName,
          previewWidth: 320,
        },
        children: [],
      },
      {
        id: 'focused-video-drag-empty-target',
        type: 'embed',
        props: { targetKind: 'empty' },
        children: [],
      },
      paragraphBlock('focused-video-drag-after', afterText),
    ])
    await openItem(page, hostName)

    const embedBlocks = page.getByTestId('note-embed-block')
    await expect(embedBlocks).toHaveCount(2)
    await selectFirstEmbedBlock(page)
    await page.getByRole('button', { name: `Play ${embedName}` }).click()

    await dragFirstVideoSurfaceBelowText(page, afterText)

    await expect(embedBlocks).toHaveCount(2)
    await expect
      .poll(() => getEditorBlockOrder(page), { timeout: 10_000 })
      .toEqual(['text', 'embed', 'text', 'embed'])
  })

  test('moves a focused audio embed block when dragging the audio player surface', async ({
    page,
  }, testInfo) => {
    const hostName = uniqueName('Focused Audio Drag Host', testInfo)
    const beforeText = uniqueName('Before focused audio drag', testInfo)
    const afterText = uniqueName('After focused audio drag', testInfo)
    const embedName = 'focused-audio.mp3'

    await openCampaign(page)
    await createNote(page, hostName)
    await persistNoteBlocks(page, hostName, [
      paragraphBlock('focused-audio-drag-before', beforeText),
      {
        id: 'focused-audio-drag-source',
        type: 'embed',
        props: {
          targetKind: 'externalUrl',
          url: 'https://example.com/focused-audio.mp3',
          name: embedName,
          previewWidth: 320,
        },
        children: [],
      },
      {
        id: 'focused-audio-drag-empty-target',
        type: 'embed',
        props: { targetKind: 'empty' },
        children: [],
      },
      paragraphBlock('focused-audio-drag-after', afterText),
    ])
    await openItem(page, hostName)

    const embedBlocks = page.getByTestId('note-embed-block')
    await expect(embedBlocks).toHaveCount(2)
    await selectFirstEmbedBlock(page)
    await page.getByRole('button', { name: `Play ${embedName}` }).click()
    const volumeButton = page.getByRole('button', { name: `Adjust volume ${embedName}` })
    await volumeButton.click()
    const compactVolumeSlider = page.getByTestId('compact-volume-slider')
    await expect(compactVolumeSlider).toBeVisible()
    const [volumeButtonBox, compactVolumeSliderBox] = await Promise.all([
      volumeButton.boundingBox(),
      compactVolumeSlider.boundingBox(),
    ])
    expect(volumeButtonBox).not.toBeNull()
    expect(compactVolumeSliderBox).not.toBeNull()
    expect(compactVolumeSliderBox!.y).toBeGreaterThan(volumeButtonBox!.y)
    expect(compactVolumeSliderBox!.y).toBeLessThan(
      volumeButtonBox!.y + volumeButtonBox!.height + 16,
    )
    expect(compactVolumeSliderBox!.x).toBeLessThanOrEqual(
      volumeButtonBox!.x + volumeButtonBox!.width,
    )
    expect(compactVolumeSliderBox!.x + compactVolumeSliderBox!.width).toBeGreaterThanOrEqual(
      volumeButtonBox!.x,
    )
    await volumeButton.click()
    await expect(compactVolumeSlider).not.toBeVisible()

    await dragFirstAudioSurfaceBelowText(page, afterText)

    await expect(embedBlocks).toHaveCount(2)
    await expect
      .poll(() => getEditorBlockOrder(page), { timeout: 10_000 })
      .toEqual(['text', 'embed', 'text', 'embed'])
  })
})

async function openCampaign(page: Page) {
  await page.goto('/campaigns')
  await navigateToCampaign(page, campaignName)
  await waitForFilesystemIdle(page)
}

async function persistSourceNoteContent(page: Page) {
  await persistNoteBlocksBySlug(page, 'embeddable-source-note', [
    {
      id: 'source-paragraph',
      type: 'paragraph',
      props: {},
      content: [{ type: 'text', text: sourceNoteContent, styles: {} }],
      children: [],
    },
  ])
}

async function persistNoteBlocks(page: Page, itemName: string, blocks: Array<CustomPartialBlock>) {
  const noteSlug = await getItemSlugFromSidebarLink(page, itemName)
  await persistNoteBlocksBySlug(page, noteSlug, blocks)
}

async function persistNoteBlocksBySlug(
  page: Page,
  noteSlug: string,
  blocks: Array<CustomPartialBlock>,
) {
  const { dmUsername, campaignSlug } = getCampaignRoute(page)
  const campaignId = await getCampaignIdFromRoute({ dmUsername, slug: campaignSlug })
  const sourceNoteId = await getSidebarItemIdBySlug({
    campaignId,
    slug: noteSlug,
  })
  const client = await createE2EConvexClient()
  await client.mutation(api.yjsSync.mutations.pushUpdate, {
    campaignId,
    documentId: sourceNoteId,
    update: makeYjsUpdateWithBlocks(blocks),
  })
  await client.action(api.notes.actions.persistNoteBlocks, {
    campaignId,
    documentId: sourceNoteId,
  })
}

function getCampaignRoute(page: Page): {
  dmUsername: string
  campaignSlug: string
} {
  return getCampaignRouteFromUrl(page.url())
}

async function insertEmptyEmbedBlock(page: Page) {
  await getEditor(page)
  await selectSlashMenuItem(page, /Embed a file, note, map, canvas, folder, or external URL/)
  const block = page.getByTestId('note-embed-block').last()
  await expect(block.getByTestId('embed-empty-state')).toBeVisible({ timeout: 10_000 })
  return block
}

async function dragSidebarItemToEmbed(page: Page, itemName: string, block: Locator) {
  const item = selectableSidebarRow(page, itemName)
  await expect(item).toBeVisible({ timeout: 10_000 })
  await item.dragTo(block)
}

async function dragFirstEmbedSurfaceBelowText(page: Page, text: string) {
  const sourceEmbed = page.getByTestId('note-embed-block').first()
  await expect(sourceEmbed).toBeVisible({ timeout: 5000 })
  const sourceBox = await sourceEmbed.boundingBox()
  if (!sourceBox) throw new Error('Expected source embed block to have a bounding box')

  const targetText = page.getByText(text, { exact: true })
  await expect(targetText).toBeVisible({ timeout: 5000 })
  const targetBlock = targetText.locator('xpath=ancestor::*[@data-node-type="blockContainer"][1]')
  const targetBox = await targetBlock.boundingBox()
  if (!targetBox) throw new Error(`Expected target block "${text}" to have a bounding box`)

  const startX = sourceBox.x + Math.min(sourceBox.width / 2, 120)
  const startY = sourceBox.y + Math.min(sourceBox.height / 2, 40)
  const endX = targetBox.x + targetBox.width / 2
  const endY = targetBox.y + targetBox.height + 16

  await page.mouse.move(startX, startY)
  await page.mouse.down()
  await page.mouse.move(startX, startY + 32, { steps: 8 })
  await page.mouse.move(endX, endY, { steps: 24 })
  await page.mouse.up()
}

async function dragFirstVideoSurfaceBelowText(page: Page, text: string) {
  const video = page.locator('video').first()
  await expect(video).toBeVisible({ timeout: 5000 })
  const sourceBox = await video.boundingBox()
  if (!sourceBox) throw new Error('Expected source video to have a bounding box')

  const targetText = page.getByText(text, { exact: true })
  await expect(targetText).toBeVisible({ timeout: 5000 })
  const targetBlock = targetText.locator('xpath=ancestor::*[@data-node-type="blockContainer"][1]')
  const targetBox = await targetBlock.boundingBox()
  if (!targetBox) throw new Error(`Expected target block "${text}" to have a bounding box`)

  const startX = sourceBox.x + sourceBox.width / 2
  const startY = sourceBox.y + Math.max(16, sourceBox.height / 3)
  const endX = targetBox.x + targetBox.width / 2
  const endY = targetBox.y + targetBox.height + 16

  await page.mouse.move(startX, startY)
  await page.mouse.down()
  await page.mouse.move(startX, startY + 32, { steps: 8 })
  await page.mouse.move(endX, endY, { steps: 24 })
  await page.mouse.up()
}

async function dragFirstAudioSurfaceBelowText(page: Page, text: string) {
  const audioPlayer = page.getByTestId('audio-embed-player').first()
  await expect(audioPlayer).toBeVisible({ timeout: 5000 })
  const sourceBox = await audioPlayer.boundingBox()
  if (!sourceBox) throw new Error('Expected source audio player to have a bounding box')

  const targetText = page.getByText(text, { exact: true })
  await expect(targetText).toBeVisible({ timeout: 5000 })
  const targetBlock = targetText.locator('xpath=ancestor::*[@data-node-type="blockContainer"][1]')
  const targetBox = await targetBlock.boundingBox()
  if (!targetBox) throw new Error(`Expected target block "${text}" to have a bounding box`)

  const startX = sourceBox.x + Math.min(72, sourceBox.width / 4)
  const startY = sourceBox.y + sourceBox.height / 2
  const endX = targetBox.x + targetBox.width / 2
  const endY = targetBox.y + targetBox.height + 16

  await page.mouse.move(startX, startY)
  await page.mouse.down()
  await page.mouse.move(startX, startY + 32, { steps: 8 })
  await page.mouse.move(endX, endY, { steps: 24 })
  await page.mouse.up()
}

async function selectFirstEmbedBlock(page: Page) {
  const block = page.getByTestId('note-embed-block').first()
  await expect(block.getByTestId('note-embed-visual-surface')).toBeVisible({ timeout: 5000 })
  await block.getByTestId('note-embed-visual-surface').click({ position: { x: 8, y: 8 } })
  await expect(block.getByTestId('note-embed-resize-wrapper')).toBeVisible({ timeout: 5000 })
}

async function getEditorBlockOrder(page: Page) {
  return page.locator('[data-node-type="blockContainer"]').evaluateAll((blocks) =>
    blocks
      .filter((block) => {
        const text = block.textContent?.trim() ?? ''
        return text || block.querySelector('[data-testid="note-embed-block"]')
      })
      .map((block) => (block.querySelector('[data-testid="note-embed-block"]') ? 'embed' : 'text')),
  )
}

function paragraphBlock(id: string, text: string): CustomPartialBlock {
  return {
    id,
    type: 'paragraph',
    props: {},
    content: [{ type: 'text', text, styles: {} }],
    children: [],
  }
}

async function expectFileInAssetsFolder(page: Page) {
  const assetsSlug = await getItemSlugFromSidebarLink(page, 'Assets')
  const fileSlug = await getItemSlugFromSidebarLink(page, imageFileName)
  const { dmUsername, campaignSlug } = getCampaignRoute(page)
  const campaignId = await getCampaignIdFromRoute({ dmUsername, slug: campaignSlug })
  const assets = await getSidebarItemBySlug({ campaignId, slug: assetsSlug })
  const file = await getSidebarItemBySlug({ campaignId, slug: fileSlug })
  expect(file.parentId).toBe(assets._id)
}

async function getItemSlugFromSidebarLink(page: Page, itemName: string) {
  const link = sidebarLink(page, itemName)
  await expect(link).toBeVisible({ timeout: 15_000 })
  const href = await link.getAttribute('href')
  const slug = href ? new URL(href, page.url()).searchParams.get('item') : null
  if (!slug) throw new Error(`Unable to resolve sidebar item slug for ${itemName}`)
  return slug
}

function sourceNoteName() {
  return 'Embeddable Source Note'
}

function uniqueName(prefix: string, testInfo: TestInfo) {
  return `${prefix} ${testInfo.workerIndex}-${testInfo.retry}-${Date.now()}`
}

function createOnePixelPng() {
  return Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADUlEQVR42mP8z8BQDwAFgwJ/l0S4YwAAAABJRU5ErkJggg==',
    'base64',
  )
}
