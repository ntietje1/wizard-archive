import { expect, test } from '@playwright/test'
import { createCampaign, deleteCampaign, navigateToCampaign } from './helpers/campaign-helpers'
import {
  clickCanvasAt,
  clearCanvasViaRuntime,
  createFreshCanvasForTest,
  enableCanvasRuntime,
  getCanvasNodeById,
  getCanvasNodes,
  getCanvasTextEditors,
  getNewCanvasTextEditor,
  seedCanvasEmbedNodeViaRuntime,
  selectCanvasTool,
} from './helpers/canvas-helpers'
import { AUTH_STORAGE_PATH, testName } from './helpers/constants'
import { getEditor } from './helpers/editor-helpers'
import { getCampaignIdFromRoute, getSidebarItemIdBySlug } from './helpers/convex-helpers'
import { pressRedo, pressUndo } from './helpers/keyboard-helpers'
import { createNote, openItem } from './helpers/sidebar-helpers'
import type { Page } from '@playwright/test'
import type { ResourceId } from '@wizard-archive/editor/resources/domain-id'

const campaignName = testName('URHotkeys')

test.describe.serial('editor surface hotkey routing', () => {
  test.setTimeout(90_000)

  test.beforeAll(async ({ browser }) => {
    const context = await browser.newContext({ storageState: AUTH_STORAGE_PATH })
    const page = await context.newPage()
    await page.goto('/campaigns', { waitUntil: 'commit' })
    await createCampaign(page, campaignName)
    await page.close()
    await context.close()
  })

  test('routes undo to the active note editor', async ({ page }) => {
    await page.goto('/campaigns', { waitUntil: 'commit' })
    await navigateToCampaign(page, campaignName)

    const noteName = `Undo Note ${Date.now()}`
    await createNote(page, noteName)
    await openItem(page, noteName)

    const editor = await getEditor(page)
    await editor.click()

    const text = 'Note undo redo text'
    await page.keyboard.type(text)
    await expect(editor).toContainText(text)

    await pressUndo(page)
    await expect(editor).not.toContainText(text, { timeout: 5000 })
  })

  test.afterAll(async ({ browser }) => {
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

  test('routes undo and redo to the active canvas text node editor', async ({ page }) => {
    await openFreshRuntimeCanvas(page, `Undo Text Canvas ${Date.now()}`)
    await selectCanvasTool(page, 'Text')
    const textEditorCount = await getCanvasTextEditors(page).count()
    await clickCanvasAt(page, { x: 360, y: 260 })

    await expect(getCanvasTextEditors(page)).toHaveCount(1)
    const editor = await getNewCanvasTextEditor(page, textEditorCount)
    await expect(editor).toBeVisible()

    const text = 'T'
    await editor.click()
    await page.keyboard.type(text)
    await expect(editor).toContainText(text)

    await pressUndo(page)
    await expect(editor).not.toContainText(text, { timeout: 5000 })
    await expect.poll(() => getCanvasNodes(page).count()).toBe(1)

    await pressRedo(page)
    await expect(editor).toContainText(text, { timeout: 5000 })
    await expect.poll(() => getCanvasNodes(page).count()).toBe(1)
  })

  test('routes undo to the active embedded note editor without deleting the canvas node', async ({
    page,
  }) => {
    await page.goto('/campaigns', { waitUntil: 'commit' })
    await navigateToCampaign(page, campaignName)
    const noteName = `Undo Embed Note ${Date.now()}`
    await createNote(page, noteName)
    const noteId = await getCurrentNoteId(page)

    await openFreshRuntimeCanvas(page, `Undo Embed Canvas ${Date.now()}`)
    await seedCanvasEmbedNodeViaRuntime(page, {
      id: 'embedded-note-undo',
      resourceId: noteId,
      position: { x: 220, y: 180 },
      width: 420,
      height: 280,
    })

    const embeddedWrapper = page.getByTestId('embed-note-content-wrapper')
    await expect(embeddedWrapper).toBeVisible({ timeout: 15_000 })
    await getCanvasNodeById(page, 'embedded-note-undo').dblclick()
    await expect(embeddedWrapper).toHaveAttribute('data-embedded-note-mode', 'editable', {
      timeout: 15_000,
    })

    const embeddedEditor = embeddedWrapper.locator('[contenteditable="true"]').first()
    await expect(embeddedEditor).toBeVisible({ timeout: 15_000 })

    const text = 'Embedded undo redo text'
    await embeddedEditor.click()
    await page.keyboard.type(text)
    await expect(embeddedEditor).toContainText(text)

    await pressUndo(page)
    await expect(embeddedEditor).not.toContainText(text, { timeout: 5000 })
    await expect.poll(() => getCanvasNodes(page).count()).toBe(1)
  })
})

async function openFreshRuntimeCanvas(page: Page, canvasName: string) {
  await enableCanvasRuntime(page)
  await createFreshCanvasForTest(page, campaignName, canvasName)
  await clearCanvasViaRuntime(page)
  await selectCanvasTool(page, 'Pointer')
}

async function getCurrentNoteId(page: Page): Promise<ResourceId> {
  const noteSlug = getCurrentItemSlug(page)
  const { dmUsername, campaignSlug } = getCurrentCampaignRoute(page)
  const campaignId = await getCampaignIdFromRoute({ dmUsername, slug: campaignSlug })
  return await getSidebarItemIdBySlug({ campaignId, slug: noteSlug })
}

function getCurrentCampaignRoute(page: Page) {
  const url = new URL(page.url())
  const [, campaignsSegment, dmUsername, campaignSlug] = url.pathname.split('/')
  if (campaignsSegment !== 'campaigns' || !dmUsername || !campaignSlug) {
    throw new Error(`Expected a campaign route, received ${url.pathname}`)
  }
  return { dmUsername, campaignSlug }
}

function getCurrentItemSlug(page: Page) {
  const itemSlug = new URL(page.url()).searchParams.get('item')
  if (!itemSlug) {
    throw new Error(`Expected an item slug in ${page.url()}`)
  }
  return itemSlug
}
