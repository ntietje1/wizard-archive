import fs from 'node:fs'
import path from 'node:path'
import { expect, test } from '@playwright/test'
import { api } from 'convex/_generated/api'
import { createCampaign, deleteCampaign, navigateToCampaign } from './helpers/campaign-helpers'
import { getEditor, newParagraphAtEnd, selectSlashMenuItem } from './helpers/editor-helpers'
import { pressCopy, pressPaste, pressRedo, pressUndo } from './helpers/keyboard-helpers'
import {
  createNote,
  openItem,
  selectableSidebarRow,
  sidebarItem,
  waitForFilesystemIdle,
} from './helpers/sidebar-helpers'
import { AUTH_STORAGE_PATH, testName } from './helpers/constants'
import {
  createE2EConvexClient,
  getCampaignIdFromRoute,
  getCampaignRouteFromUrl,
  getSidebarItemByName,
  getSidebarItemBySlug,
  getSidebarItemIdBySlug,
} from './helpers/convex-helpers'
import { makeYjsUpdateWithBlocks } from '../convex/_test/yjs.helper'
import type { Locator, Page, TestInfo } from '@playwright/test'
import type { PartialNoteBlock } from '@wizard-archive/editor/notes/document-contract'
import { testNoteBlockId } from 'shared/test/note-block-id'

const campaignName = testName('E2E NoteEmbeds')
const sourceNoteContent = `Embedded source content ${Date.now()}`
const fixtureDir = path.resolve('test-results/fixtures')
const imageFileName = 'note-embed-upload.png'
const imageFilePath = path.join(fixtureDir, imageFileName)
let campaignEditorPath: string | null = null

test.describe.serial('note embeds', () => {
  test.setTimeout(30_000)

  test.beforeAll(async ({ browser }) => {
    fs.mkdirSync(fixtureDir, { recursive: true })
    fs.writeFileSync(imageFilePath, createOnePixelPng())

    const context = await browser.newContext({ storageState: AUTH_STORAGE_PATH })
    const page = await context.newPage()
    await page.goto('/campaigns', { waitUntil: 'commit' })
    await createCampaign(page, campaignName)
    await navigateToCampaign(page, campaignName)
    campaignEditorPath = new URL(page.url()).pathname
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
    await page.goto('/campaigns', { waitUntil: 'commit' })
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

  test('inserts an empty embed without leaving a blank slash paragraph before it', async ({
    page,
  }, testInfo) => {
    await openCampaign(page)
    await createNote(page, uniqueName('Embed Insert Host', testInfo))

    await insertEmptyEmbedBlock(page)

    await expect.poll(() => getEditorBlocksBeforeFirstEmbed(page)).toEqual([])
  })

  test('does not show an editor drop cursor while hovering a sidebar item over an empty embed block', async ({
    page,
  }, testInfo) => {
    await openCampaign(page)
    await createNote(page, uniqueName('Drop Cursor Host', testInfo))
    const block = await insertEmptyEmbedBlock(page)

    await holdSidebarItemDragOverEmptyEmbed(page, sourceNoteName(), block)
    await testInfo.attach('drop-cursor-browser-screenshot', {
      body: await page.screenshot({ fullPage: true }),
      contentType: 'image/png',
    })

    expect(await dragOverlayIncludesText(page, 'Embed item here')).toBe(true)
    expect(await emptyEmbedHasDropTargetChrome(page)).toBe(true)
    expect(await getVisibleDropCursorLikeCount(page)).toBe(0)

    await finishHeldSidebarItemDrag(page)
    expect(await hasHeldSidebarItemDrag(page)).toBe(false)
  })

  test('does not show a ProseMirror drop cursor while hovering a native file over an empty embed block', async ({
    page,
  }, testInfo) => {
    await openCampaign(page)
    await createNote(page, uniqueName('File Drop Cursor Host', testInfo))
    const block = await insertEmptyEmbedBlock(page)

    await dispatchNativeFileDragOverEmbed(page, block)
    await testInfo.attach('native-file-drop-cursor-browser-screenshot', {
      body: await page.screenshot({ fullPage: true }),
      contentType: 'image/png',
    })

    expect(await emptyEmbedHasDropTargetChrome(page)).toBe(true)
    expect(await getVisibleDropCursorLikeCount(page)).toBe(0)
  })

  test('keeps a note self-drop as an empty embed', async ({ page }, testInfo) => {
    const hostName = uniqueName('Self Embed Host', testInfo)
    await openCampaign(page)
    await createNote(page, hostName)
    const block = await insertEmptyEmbedBlock(page)

    await dragSidebarItemToEmbed(page, hostName, block)

    await expect(block.getByTestId('embed-empty-state')).toBeVisible()
    await expect(block.getByText('Drag and drop an item or file here')).toBeVisible()
    await expect
      .poll(() => getFirstPersistedEmbedTargetKind(page, hostName), { timeout: 10_000 })
      .toBe('empty')
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

    await expect(sidebarItem(page, 'Assets')).toBeVisible({ timeout: 15_000 })
    await expectFileInAssetsFolder(page)
    await expect(block.getByRole('img', { name: imageFileName })).toBeVisible({ timeout: 15_000 })
  })

  test('selects embed blocks when dragging a text range across them', async ({
    page,
  }, testInfo) => {
    const hostName = uniqueName('Embed Range Selection Host', testInfo)
    const beforeText = uniqueName('Before embed selection', testInfo)
    const afterText = uniqueName('After embed selection', testInfo)
    const externalEmbedName = 'selectable-embed.png'

    await openCampaign(page)
    await createNote(page, hostName)
    await persistNoteBlocks(page, hostName, [
      paragraphBlock('embed-selection-before', beforeText),
      {
        id: testNoteBlockId('embed-selection-empty'),
        type: 'embed',
        props: { targetKind: 'empty' },
        children: [],
      },
      {
        id: testNoteBlockId('embed-selection-external'),
        type: 'embed',
        props: {
          targetKind: 'externalUrl',
          url: 'https://example.com/selectable-embed.png',
          name: externalEmbedName,
          previewWidth: 320,
        },
        children: [],
      },
      paragraphBlock('embed-selection-after', afterText),
    ])
    await openItem(page, hostName)

    await expect(page.getByText(beforeText)).toBeVisible({ timeout: 10_000 })
    await expect(page.getByTestId('note-embed-block')).toHaveCount(2)
    await expect(page.getByText(afterText)).toBeVisible({ timeout: 10_000 })

    await installEditorCopyRecorder(page, {
      afterText,
      beforeText,
    })
    await dragTextSelectionAcrossEmbeds(page, beforeText, afterText)

    await expect
      .poll(() => getEmbedSelectionSnapshot(page, beforeText, afterText), { timeout: 5_000 })
      .toMatchObject({
        intersectingEmbedCount: 2,
        selectedTextIncludesAfter: true,
        selectedTextIncludesBefore: true,
      })
    await expect(page.getByTestId('note-embed-resize-outline')).toHaveCount(2)

    await page
      .getByTestId('note-embed-visual-surface')
      .last()
      .click({ button: 'right', position: { x: 8, y: 8 } })
    await expect(page.getByRole('menuitem', { name: /^(Share|Unshare) 4 Blocks$/ })).toBeVisible()
    await page.keyboard.press('Escape')

    await pressCopy(page)
    await expect
      .poll(() => getRecordedEditorCopy(page), { timeout: 5_000 })
      .toMatchObject({
        htmlIncludesEmbedBlock: true,
        plainTextIncludesAfter: true,
        plainTextIncludesBefore: true,
      })

    await newParagraphAtEnd(page)
    await pressPaste(page)

    await expect
      .poll(async () => (await getEditorBlockOrder(page)).filter((kind) => kind === 'embed').length)
      .toBe(4)
  })

  test('can select a text range through an embed block endpoint', async ({ page }, testInfo) => {
    const hostName = uniqueName('Embed Range Endpoint Host', testInfo)
    const beforeText = uniqueName('Before embed endpoint', testInfo)

    await openCampaign(page)
    await createNote(page, hostName)
    await persistNoteBlocks(page, hostName, [
      paragraphBlock('embed-endpoint-before', beforeText),
      {
        id: testNoteBlockId('embed-endpoint-empty'),
        type: 'embed',
        props: { targetKind: 'empty' },
        children: [],
      },
      {
        id: testNoteBlockId('embed-endpoint-external'),
        type: 'embed',
        props: {
          targetKind: 'externalUrl',
          url: 'https://example.com/endpoint-embed.png',
          name: 'endpoint-embed.png',
          previewWidth: 320,
        },
        children: [],
      },
    ])
    await openItem(page, hostName)

    await expect(page.getByText(beforeText)).toBeVisible({ timeout: 10_000 })
    await expect(page.getByTestId('note-embed-block')).toHaveCount(2)

    await dragTextSelectionThroughLastEmbed(page, beforeText)

    await expect
      .poll(() => getEmbedEndpointSelectionSnapshot(page, beforeText), { timeout: 5_000 })
      .toMatchObject({
        intersectingEmbedCount: 2,
        selectedTextIncludesBefore: true,
      })
    await expect(page.getByTestId('note-embed-resize-outline')).toHaveCount(2)
  })

  test('copies, pastes, undoes, and redoes a text range containing an embedded note', async ({
    page,
  }, testInfo) => {
    const hostName = uniqueName('Embedded Note Clipboard Host', testInfo)
    const beforeText = uniqueName('Before embedded note clipboard', testInfo)
    const afterText = uniqueName('After embedded note clipboard', testInfo)

    await openCampaign(page)
    await createNote(page, hostName)
    const sourceNoteId = await getSourceNoteId(page)
    await persistNoteBlocks(page, hostName, [
      paragraphBlock('embedded-note-clipboard-before', beforeText),
      {
        id: testNoteBlockId('embedded-note-clipboard-target'),
        type: 'embed',
        props: {
          targetKind: 'resource',
          resourceId: sourceNoteId,
          previewWidth: 320,
        },
        children: [],
      },
      paragraphBlock('embedded-note-clipboard-after', afterText),
    ])
    await openItem(page, hostName)

    await expect(page.getByText(beforeText)).toBeVisible({ timeout: 10_000 })
    await expect(page.getByTestId('note-embed-block')).toHaveCount(1)
    await expect(page.getByTestId('note-embed-block').getByText(sourceNoteContent)).toBeVisible({
      timeout: 15_000,
    })
    await expect(page.getByText(afterText)).toBeVisible({ timeout: 10_000 })

    await installEditorCopyRecorder(page, {
      afterText,
      beforeText,
    })
    await dragTextSelectionAcrossEmbeds(page, beforeText, afterText)

    await expect
      .poll(() => getEmbedSelectionSnapshot(page, beforeText, afterText), { timeout: 5_000 })
      .toMatchObject({
        intersectingEmbedCount: 1,
        selectedTextIncludesAfter: true,
        selectedTextIncludesBefore: true,
      })

    await pressCopy(page)
    await expect
      .poll(() => getRecordedEditorCopy(page), { timeout: 5_000 })
      .toMatchObject({
        blocknoteHtmlIncludesEmbedBlock: true,
        htmlIncludesEmbedBlock: true,
        htmlIncludesEmbedExternalAttribute: true,
        plainTextIncludesAfter: true,
        plainTextIncludesBefore: true,
      })

    await newParagraphAtEnd(page)
    await pressPaste(page)
    await expect.poll(() => page.getByTestId('note-embed-block').count()).toBe(2)
    await expect
      .poll(() => page.getByTestId('note-embed-block').getByText(sourceNoteContent).count())
      .toBe(2)

    await pressUndo(page)
    await expect.poll(() => page.getByTestId('note-embed-block').count()).toBe(1)
    await expect
      .poll(() => page.getByTestId('note-embed-block').getByText(sourceNoteContent).count())
      .toBe(1)

    await pressRedo(page)
    await expect.poll(() => page.getByTestId('note-embed-block').count()).toBe(2)
    await expect
      .poll(() => page.getByTestId('note-embed-block').getByText(sourceNoteContent).count())
      .toBe(2)
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
        id: testNoteBlockId('internal-media-drag-source'),
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
        id: testNoteBlockId('internal-media-drag-empty-target'),
        type: 'embed',
        props: { targetKind: 'empty' },
        children: [],
      },
      paragraphBlock('internal-media-drag-after', afterText),
    ])
    await openItem(page, hostName)

    const embedBlocks = page.getByTestId('note-embed-block')
    await expect(embedBlocks).toHaveCount(2)
    await expect(embedBlocks.first().getByRole('heading', { name: embedName })).toBeVisible({
      timeout: 10_000,
    })
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
    const videoUrl = 'https://example.com/movable-video.mp4'

    await openCampaign(page)
    await routePendingVideo(page, videoUrl)
    await createNote(page, hostName)
    await persistNoteBlocks(page, hostName, [
      paragraphBlock('video-surface-drag-before', beforeText),
      {
        id: testNoteBlockId('video-surface-drag-source'),
        type: 'embed',
        props: {
          targetKind: 'externalUrl',
          url: videoUrl,
          name: embedName,
          previewWidth: 320,
        },
        children: [],
      },
      {
        id: testNoteBlockId('video-surface-drag-empty-target'),
        type: 'embed',
        props: { targetKind: 'empty' },
        children: [],
      },
      paragraphBlock('video-surface-drag-after', afterText),
    ])
    await openItem(page, hostName)

    const embedBlocks = page.getByTestId('note-embed-block')
    await expect(embedBlocks).toHaveCount(2)
    await expect(embedBlocks.first().getByRole('heading', { name: embedName })).toBeVisible({
      timeout: 10_000,
    })
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
    const videoUrl = 'https://example.com/focused-video.mp4'

    await openCampaign(page)
    await routePendingVideo(page, videoUrl)
    await createNote(page, hostName)
    await persistNoteBlocks(page, hostName, [
      paragraphBlock('focused-video-drag-before', beforeText),
      {
        id: testNoteBlockId('focused-video-drag-source'),
        type: 'embed',
        props: {
          targetKind: 'externalUrl',
          url: videoUrl,
          name: embedName,
          previewWidth: 320,
        },
        children: [],
      },
      {
        id: testNoteBlockId('focused-video-drag-empty-target'),
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
    const embedName = 'focused-audio.wav'
    const audioUrl = 'https://example.com/focused-audio.wav'

    await openCampaign(page)
    await routeSilentAudio(page, audioUrl)
    await createNote(page, hostName)
    await persistNoteBlocks(page, hostName, [
      paragraphBlock('focused-audio-drag-before', beforeText),
      {
        id: testNoteBlockId('focused-audio-drag-source'),
        type: 'embed',
        props: {
          targetKind: 'externalUrl',
          url: audioUrl,
          name: embedName,
          previewWidth: 320,
        },
        children: [],
      },
      {
        id: testNoteBlockId('focused-audio-drag-empty-target'),
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
  if (campaignEditorPath) {
    await page.goto(campaignEditorPath, { waitUntil: 'commit' })
    if (
      await page
        .getByRole('navigation', { name: 'Sidebar' })
        .isVisible({ timeout: 30_000 })
        .catch(() => false)
    ) {
      await waitForFilesystemIdle(page)
      return
    }
  }

  await page.goto('/campaigns', { waitUntil: 'commit' })
  await navigateToCampaign(page, campaignName)
  await waitForFilesystemIdle(page)
}

async function persistSourceNoteContent(page: Page) {
  await persistNoteBlocksBySlug(page, 'embeddable-source-note', [
    {
      id: testNoteBlockId('source-paragraph'),
      type: 'paragraph',
      props: {},
      content: [{ type: 'text', text: sourceNoteContent, styles: {} }],
      children: [],
    },
  ])
}

async function persistNoteBlocks(page: Page, itemName: string, blocks: Array<PartialNoteBlock>) {
  const noteSlug = await getItemSlugFromSidebarItem(page, itemName)
  await persistNoteBlocksBySlug(page, noteSlug, blocks)
}

async function persistNoteBlocksBySlug(
  page: Page,
  noteSlug: string,
  blocks: Array<PartialNoteBlock>,
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

async function holdSidebarItemDragOverEmptyEmbed(page: Page, itemName: string, block: Locator) {
  const item = selectableSidebarRow(page, itemName)
  await expect(item).toBeVisible({ timeout: 10_000 })
  const sourceHandle = await item.elementHandle()
  const emptyEmbedBox = await block.boundingBox()
  if (!sourceHandle) throw new Error(`Expected sidebar item "${itemName}" to resolve to an element`)
  if (!emptyEmbedBox) throw new Error('Expected empty embed block to have a bounding box')

  await sourceHandle.evaluate(
    async (sourceElement, { dragTargetBox }) => {
      const draggableSource = sourceElement.closest('[draggable="true"]') ?? sourceElement
      if (!(draggableSource instanceof HTMLElement)) {
        throw new Error('Expected sidebar item drag source to be an HTMLElement')
      }

      const dragState = window as unknown as {
        __heldSidebarItemDrag?: {
          dataTransfer: DataTransfer
          lastClientX: number
          lastClientY: number
          source: HTMLElement
          target: EventTarget
        }
      }
      const dataTransfer = new DataTransfer()
      const sourceRect = draggableSource.getBoundingClientRect()
      const startX = sourceRect.left + Math.min(sourceRect.width / 2, 80)
      const startY = sourceRect.top + sourceRect.height / 2
      const editorDropX = dragTargetBox.x + dragTargetBox.width / 2
      const editorDropY = dragTargetBox.y + dragTargetBox.height + 16
      const embedDropX = dragTargetBox.x + dragTargetBox.width / 2
      const embedDropY = dragTargetBox.y + dragTargetBox.height / 2

      const dispatchDragEvent = (
        target: EventTarget,
        type: 'dragstart' | 'dragenter' | 'dragover' | 'dragleave' | 'drop',
        clientX: number,
        clientY: number,
      ) =>
        target.dispatchEvent(
          new DragEvent(type, {
            bubbles: true,
            cancelable: true,
            clientX,
            clientY,
            dataTransfer,
          }),
        )

      dispatchDragEvent(draggableSource, 'dragstart', startX, startY)
      dragState.__heldSidebarItemDrag = {
        dataTransfer,
        lastClientX: startX,
        lastClientY: startY,
        source: draggableSource,
        target: draggableSource,
      }
      await new Promise((resolve) => requestAnimationFrame(resolve))

      const editorDropTarget = document.elementFromPoint(editorDropX, editorDropY)
      if (!editorDropTarget) throw new Error('Expected an editor drop target below the empty embed')
      dispatchDragEvent(editorDropTarget, 'dragenter', editorDropX, editorDropY)
      dispatchDragEvent(editorDropTarget, 'dragover', editorDropX, editorDropY)
      dragState.__heldSidebarItemDrag = {
        dataTransfer,
        lastClientX: editorDropX,
        lastClientY: editorDropY,
        source: draggableSource,
        target: editorDropTarget,
      }
      await new Promise((resolve) => requestAnimationFrame(resolve))

      const embedDropTarget = document.elementFromPoint(embedDropX, embedDropY)
      if (!embedDropTarget) throw new Error('Expected an empty embed drop target')
      dispatchDragEvent(editorDropTarget, 'dragleave', embedDropX, embedDropY)
      dispatchDragEvent(embedDropTarget, 'dragenter', embedDropX, embedDropY)
      dispatchDragEvent(embedDropTarget, 'dragover', embedDropX, embedDropY)
      dragState.__heldSidebarItemDrag = {
        dataTransfer,
        lastClientX: embedDropX,
        lastClientY: embedDropY,
        source: draggableSource,
        target: embedDropTarget,
      }
      await new Promise((resolve) => requestAnimationFrame(resolve))
      dispatchDragEvent(embedDropTarget, 'dragover', embedDropX, embedDropY)
      const waitForDropTargetChrome = async () => {
        const deadline = performance.now() + 1_000
        while (performance.now() < deadline) {
          const hasDropTargetChrome = Array.from(
            document.querySelectorAll<HTMLElement>('[data-testid="embed-empty-state"]'),
          ).some(
            (element) =>
              element.className.includes('border-drop-target') ||
              element.className.includes('ring-drop-target') ||
              element.className.includes('bg-drop-target'),
          )
          if (hasDropTargetChrome) return
          await new Promise((resolve) => setTimeout(resolve, 25))
        }
        throw new Error('Timed out waiting for empty embed drop target chrome')
      }
      await waitForDropTargetChrome()
    },
    {
      dragTargetBox: {
        height: emptyEmbedBox.height,
        width: emptyEmbedBox.width,
        x: emptyEmbedBox.x,
        y: emptyEmbedBox.y,
      },
    },
  )
}

async function finishHeldSidebarItemDrag(page: Page) {
  const finishedSyntheticDrag = await page.evaluate(() => {
    const dragState = window as unknown as {
      __heldSidebarItemDrag?: {
        dataTransfer: DataTransfer
        lastClientX: number
        lastClientY: number
        source: HTMLElement
        target: EventTarget
      }
    }
    const heldDrag = dragState.__heldSidebarItemDrag
    if (!heldDrag) return false

    for (const type of ['dragleave', 'drop'] as const) {
      heldDrag.target.dispatchEvent(
        new DragEvent(type, {
          bubbles: true,
          cancelable: true,
          clientX: heldDrag.lastClientX,
          clientY: heldDrag.lastClientY,
          dataTransfer: heldDrag.dataTransfer,
        }),
      )
    }
    heldDrag.source.dispatchEvent(
      new DragEvent('dragend', {
        bubbles: true,
        cancelable: true,
        dataTransfer: heldDrag.dataTransfer,
      }),
    )
    delete dragState.__heldSidebarItemDrag
    return true
  })
  if (finishedSyntheticDrag) return

  await page.mouse.up()
}

async function hasHeldSidebarItemDrag(page: Page) {
  return page.evaluate(() =>
    Boolean((window as unknown as { __heldSidebarItemDrag?: unknown }).__heldSidebarItemDrag),
  )
}

async function dispatchNativeFileDragOverEmbed(page: Page, block: Locator) {
  const box = await block.boundingBox()
  if (!box) throw new Error('Expected empty embed block to have a bounding box')
  await page.evaluate(
    ({ clientX, clientY }) => {
      const target = document.elementFromPoint(clientX, clientY)
      if (!(target instanceof HTMLElement)) {
        throw new Error('Expected a native drag target element at the embed center')
      }
      const dataTransfer = new DataTransfer()
      dataTransfer.items.add(new File(['x'], 'native-drag.png', { type: 'image/png' }))

      for (const type of ['dragenter', 'dragover'] as const) {
        target.dispatchEvent(
          new DragEvent(type, {
            bubbles: true,
            cancelable: true,
            clientX,
            clientY,
            dataTransfer,
          }),
        )
      }
    },
    {
      clientX: box.x + box.width / 2,
      clientY: box.y + box.height / 2,
    },
  )
  await page.waitForFunction(() =>
    Array.from(document.querySelectorAll<HTMLElement>('[data-testid="embed-empty-state"]')).some(
      (element) =>
        element.className.includes('border-drop-target') ||
        element.className.includes('ring-drop-target') ||
        element.className.includes('bg-drop-target'),
    ),
  )
}

async function getVisibleDropCursorLikeCount(page: Page) {
  return page.evaluate(() => {
    const selector = ['.prosemirror-dropcursor-block', '.prosemirror-dropcursor-inline'].join(',')

    return Array.from(document.querySelectorAll<HTMLElement>(selector)).filter((element) => {
      const rect = element.getBoundingClientRect()
      const style = getComputedStyle(element)
      return (
        style.display !== 'none' &&
        style.visibility !== 'hidden' &&
        Number(style.opacity) !== 0 &&
        rect.width > 0 &&
        rect.height > 0
      )
    }).length
  })
}

async function emptyEmbedHasDropTargetChrome(page: Page) {
  return page.evaluate(() =>
    Array.from(document.querySelectorAll<HTMLElement>('[data-testid="embed-empty-state"]')).some(
      (element) =>
        element.className.includes('border-drop-target') ||
        element.className.includes('ring-drop-target') ||
        element.className.includes('bg-drop-target'),
    ),
  )
}

async function dragOverlayIncludesText(page: Page, text: string) {
  return page.evaluate((expectedText) => {
    return Array.from(document.body.querySelectorAll<HTMLElement>('.fixed.pointer-events-none'))
      .map((element) => element.textContent?.trim() ?? '')
      .some((overlayText) => overlayText.includes(expectedText))
  }, text)
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

async function dragTextSelectionAcrossEmbeds(page: Page, startText: string, endText: string) {
  const points = await page.evaluate(
    ({ endText: targetEndText, startText: targetStartText }) => {
      const getTextPoint = (
        targetText: string,
        offset: number,
        horizontalBias: 'left' | 'right',
      ) => {
        const editor = document.querySelector('.bn-editor')
        if (!editor) throw new Error('Editor not found')

        const walker = document.createTreeWalker(editor, NodeFilter.SHOW_TEXT)
        let node = walker.nextNode()
        while (node) {
          const text = node.textContent ?? ''
          const index = text.indexOf(targetText)
          if (index >= 0) {
            const range = document.createRange()
            const rangeOffset = index + offset
            range.setStart(node, rangeOffset)
            range.setEnd(node, Math.min(rangeOffset + 1, text.length))
            const rect = range.getBoundingClientRect()
            if (!rect.width && !rect.height) {
              throw new Error(`Unable to measure text range for ${targetText}`)
            }
            return {
              x: horizontalBias === 'left' ? rect.left + 1 : rect.right - 1,
              y: rect.top + rect.height / 2,
            }
          }
          node = walker.nextNode()
        }

        throw new Error(`Text not found: ${targetText}`)
      }

      return {
        end: getTextPoint(targetEndText, Math.max(targetEndText.length - 2, 0), 'right'),
        start: getTextPoint(targetStartText, 1, 'left'),
      }
    },
    { endText, startText },
  )

  await page.mouse.move(points.start.x, points.start.y)
  await page.mouse.down()
  await page.mouse.move(points.end.x, points.end.y, { steps: 16 })
  await page.mouse.up()
}

async function dragTextSelectionThroughLastEmbed(page: Page, startText: string) {
  const start = await page.evaluate((targetStartText) => {
    const editor = document.querySelector('.bn-editor')
    if (!editor) throw new Error('Editor not found')

    const walker = document.createTreeWalker(editor, NodeFilter.SHOW_TEXT)
    let node = walker.nextNode()
    while (node) {
      const text = node.textContent ?? ''
      const index = text.indexOf(targetStartText)
      if (index >= 0) {
        const range = document.createRange()
        const rangeOffset = index + 1
        range.setStart(node, rangeOffset)
        range.setEnd(node, Math.min(rangeOffset + 1, text.length))
        const rect = range.getBoundingClientRect()
        if (!rect.width && !rect.height) {
          throw new Error(`Unable to measure text range for ${targetStartText}`)
        }
        return {
          x: rect.left + 1,
          y: rect.top + rect.height / 2,
        }
      }
      node = walker.nextNode()
    }

    throw new Error(`Text not found: ${targetStartText}`)
  }, startText)
  const lastEmbedBox = await page.getByTestId('note-embed-block').last().boundingBox()
  if (!lastEmbedBox) throw new Error('Expected last embed block to have a bounding box')

  await page.mouse.move(start.x, start.y)
  await page.mouse.down()
  await page.mouse.move(
    lastEmbedBox.x + lastEmbedBox.width / 2,
    lastEmbedBox.y + lastEmbedBox.height / 2,
    { steps: 16 },
  )
  await expect(page.getByTestId('note-embed-resize-outline')).toHaveCount(2)
  await page.mouse.up()
}

async function getEmbedSelectionSnapshot(page: Page, beforeText: string, afterText: string) {
  return page.evaluate(
    ({ afterText: targetAfterText, beforeText: targetBeforeText }) => {
      const selection = window.getSelection()
      const range =
        selection && selection.rangeCount > 0 && !selection.isCollapsed
          ? selection.getRangeAt(0)
          : null
      const selectedText = selection?.toString() ?? ''

      return {
        intersectingEmbedCount: range
          ? Array.from(document.querySelectorAll('[data-testid="note-embed-block"]')).filter(
              (embed) => range.intersectsNode(embed),
            ).length
          : 0,
        selectedText,
        selectedTextIncludesAfter: selectedText.includes(targetAfterText.slice(0, -1)),
        selectedTextIncludesBefore: selectedText.includes(targetBeforeText.slice(1)),
      }
    },
    { afterText, beforeText },
  )
}

async function getEmbedEndpointSelectionSnapshot(page: Page, beforeText: string) {
  return page.evaluate((targetBeforeText) => {
    const selection = window.getSelection()
    const range =
      selection && selection.rangeCount > 0 && !selection.isCollapsed
        ? selection.getRangeAt(0)
        : null
    const selectedText = selection?.toString() ?? ''

    return {
      intersectingEmbedCount: range
        ? Array.from(document.querySelectorAll('[data-testid="note-embed-block"]')).filter(
            (embed) => range.intersectsNode(embed),
          ).length
        : 0,
      selectedText,
      selectedTextIncludesBefore: selectedText.includes(targetBeforeText.slice(1)),
    }
  }, beforeText)
}

async function installEditorCopyRecorder(
  page: Page,
  {
    afterText,
    beforeText,
  }: {
    afterText: string
    beforeText: string
  },
) {
  await page.evaluate(
    ({ afterText: targetAfterText, beforeText: targetBeforeText }) => {
      ;(window as unknown as { __editorCopyRecord?: unknown }).__editorCopyRecord = null
      document.addEventListener(
        'copy',
        (event) => {
          const clipboardData = event.clipboardData
          const html = clipboardData?.getData('text/html') ?? ''
          const blocknoteHtml = clipboardData?.getData('blocknote/html') ?? ''
          const plainText = clipboardData?.getData('text/plain') ?? ''
          const types = clipboardData ? Array.from(clipboardData.types) : []
          ;(window as unknown as { __editorCopyRecord?: unknown }).__editorCopyRecord = {
            html,
            blocknoteHtml,
            blocknoteHtmlIncludesEmbedBlock:
              blocknoteHtml.includes('data-content-type="embed"') ||
              blocknoteHtml.includes('data-node-type="embed"') ||
              blocknoteHtml.includes('note-embed-block') ||
              blocknoteHtml.includes('"type":"embed"'),
            htmlIncludesEmbedBlock:
              html.includes('data-content-type="embed"') ||
              html.includes('data-node-type="embed"') ||
              html.includes('note-embed-block') ||
              html.includes('"type":"embed"'),
            htmlIncludesEmbedExternalAttribute: html.includes('data-note-embed-external-html'),
            plainText,
            plainTextIncludesAfter: plainText.includes(targetAfterText.slice(0, -1)),
            plainTextIncludesBefore: plainText.includes(targetBeforeText.slice(1)),
            types,
          }
        },
        false,
      )
    },
    { afterText, beforeText },
  )
}

async function getRecordedEditorCopy(page: Page) {
  return page.evaluate(
    () =>
      (
        window as unknown as {
          __editorCopyRecord?: {
            blocknoteHtml: string
            blocknoteHtmlIncludesEmbedBlock: boolean
            html: string
            htmlIncludesEmbedBlock: boolean
            htmlIncludesEmbedExternalAttribute: boolean
            plainText: string
            plainTextIncludesAfter: boolean
            plainTextIncludesBefore: boolean
            types: Array<string>
          } | null
        }
      ).__editorCopyRecord ?? null,
  )
}

async function getEditorBlocksBeforeFirstEmbed(page: Page) {
  return page.locator('[data-node-type="blockContainer"]').evaluateAll((blocks) => {
    const summaries = blocks.map((block) => ({
      hasEmbed: Boolean(block.querySelector('[data-testid="note-embed-block"]')),
      text: block.textContent?.trim() ?? '',
    }))
    const embedIndex = summaries.findIndex((block) => block.hasEmbed)
    if (embedIndex === -1) return summaries
    return summaries.slice(0, embedIndex)
  })
}

function paragraphBlock(id: string, text: string): PartialNoteBlock {
  return {
    id: testNoteBlockId(id),
    type: 'paragraph',
    props: {},
    content: [{ type: 'text', text, styles: {} }],
    children: [],
  }
}

async function expectFileInAssetsFolder(page: Page) {
  const assetsSlug = await getItemSlugFromSidebarItem(page, 'Assets')
  const fileSlug = await getItemSlugFromSidebarItem(page, imageFileName)
  const { dmUsername, campaignSlug } = getCampaignRoute(page)
  const campaignId = await getCampaignIdFromRoute({ dmUsername, slug: campaignSlug })
  const assets = await getSidebarItemBySlug({ campaignId, slug: assetsSlug })
  const file = await getSidebarItemBySlug({ campaignId, slug: fileSlug })
  expect(file.parentId).toBe(assets.id)
}

async function getFirstPersistedEmbedTargetKind(page: Page, itemName: string) {
  const noteSlug = await getItemSlugFromSidebarItem(page, itemName)
  const { dmUsername, campaignSlug } = getCampaignRoute(page)
  const campaignId = await getCampaignIdFromRoute({ dmUsername, slug: campaignSlug })
  const noteId = await getSidebarItemIdBySlug({
    campaignId,
    slug: noteSlug,
  })
  const client = await createE2EConvexClient()
  const note = await client.query(api.notes.queries.getNote, {
    campaignId,
    noteId,
  })
  const embedBlock = note?.content.find((block) => block.type === 'embed')
  return embedBlock?.props.targetKind ?? null
}

async function getSourceNoteId(page: Page) {
  const { dmUsername, campaignSlug } = getCampaignRoute(page)
  const campaignId = await getCampaignIdFromRoute({ dmUsername, slug: campaignSlug })
  return await getSidebarItemIdBySlug({
    campaignId,
    slug: 'embeddable-source-note',
  })
}

async function getItemSlugFromSidebarItem(page: Page, itemName: string) {
  await expect(sidebarItem(page, itemName)).toBeVisible({ timeout: 15_000 })
  const { dmUsername, campaignSlug } = getCampaignRoute(page)
  const campaignId = await getCampaignIdFromRoute({ dmUsername, slug: campaignSlug })
  return (await getSidebarItemByName({ campaignId, name: itemName })).slug
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

async function routeSilentAudio(page: Page, url: string) {
  await page.route(url, (route) =>
    route.fulfill({
      status: 200,
      contentType: 'audio/wav',
      body: createSilentWav(),
    }),
  )
}

async function routePendingVideo(page: Page, url: string) {
  await page.route(url, () => new Promise(() => undefined))
}

function createSilentWav() {
  const sampleRate = 8000
  const samples = sampleRate / 10
  const bytesPerSample = 2
  const dataSize = samples * bytesPerSample
  const buffer = Buffer.alloc(44 + dataSize)
  buffer.write('RIFF', 0)
  buffer.writeUInt32LE(36 + dataSize, 4)
  buffer.write('WAVE', 8)
  buffer.write('fmt ', 12)
  buffer.writeUInt32LE(16, 16)
  buffer.writeUInt16LE(1, 20)
  buffer.writeUInt16LE(1, 22)
  buffer.writeUInt32LE(sampleRate, 24)
  buffer.writeUInt32LE(sampleRate * bytesPerSample, 28)
  buffer.writeUInt16LE(bytesPerSample, 32)
  buffer.writeUInt16LE(8 * bytesPerSample, 34)
  buffer.write('data', 36)
  buffer.writeUInt32LE(dataSize, 40)
  return buffer
}
