import { expect, test } from '@playwright/test'
import { createCampaign, deleteCampaign, navigateToCampaign } from './helpers/campaign-helpers'
import {
  clickCanvasAt,
  clickCanvasNode,
  createCanvas,
  DEFAULT_CANVAS_NAME,
  dragOnCanvas,
  endCanvasPointerGesture,
  getCanvasMarqueeOverlay,
  getCanvasNodesByType,
  getCanvasPendingSelectionNodeIds,
  getCanvasPendingSelectionStatus,
  getCommittedSelectedCanvasNodes,
  getVisuallySelectedCanvasNodes,
  lassoOnCanvas,
  moveCanvasPointer,
  openCanvas,
  selectCanvasTool,
  startCanvasPointerGesture,
} from './helpers/canvas-helpers'
import { AUTH_STORAGE_PATH, testName } from './helpers/constants'
import type { Page } from '@playwright/test'

const campaignName = testName('Cnv Select')
const canvasName = DEFAULT_CANVAS_NAME
const mod = process.platform === 'darwin' ? 'Meta' : 'Control'
const TEXT_CONTENT_LOCATOR = '[aria-label="Text node content"][contenteditable="true"]'

test.describe.serial('canvas selection', () => {
  test.beforeAll(async ({ browser }) => {
    const context = await browser.newContext({
      storageState: AUTH_STORAGE_PATH,
    })
    const page = await context.newPage()

    await page.goto('/campaigns')
    await createCampaign(page, campaignName)
    await navigateToCampaign(page, campaignName)
    await createCanvas(page, canvasName)

    await seedSelectionCanvas(page)

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
    } catch (error) {
      console.debug('Failed to delete canvas selection campaign during teardown', {
        campaignName,
        error,
      })
    }
    await page.close()
    await context.close()
  })

  test('supports click selection, modifier toggle, and pane clear', async ({ page }) => {
    await openSelectionCanvas(page)

    await selectCanvasTool(page, 'Pointer')
    await clickCanvasNode(page, getCanvasNodesByType(page, 'text').first())
    await expect.poll(() => getCommittedSelectedCanvasNodes(page).count()).toBe(1)

    await page.keyboard.down(mod)
    await clickCanvasNode(page, getCanvasNodesByType(page, 'text').nth(1))
    await page.keyboard.up(mod)
    await expect.poll(() => getCommittedSelectedCanvasNodes(page).count()).toBe(2)

    await clickCanvasAt(page, { x: 720, y: 520 })
    await expect.poll(() => getCommittedSelectedCanvasNodes(page).count()).toBe(0)
  })

  test('marquee shows pending preview, commits matching nodes, and survives the trailing click', async ({
    page,
  }) => {
    await openSelectionCanvas(page)

    await selectCanvasTool(page, 'Pointer')
    await clickCanvasAt(page, { x: 720, y: 520 })

    await startCanvasPointerGesture(page, { x: 80, y: 60 })
    await moveCanvasPointer(page, { x: 420, y: 250 })

    const pendingStatus = getCanvasPendingSelectionStatus(page)
    await expect(getCanvasMarqueeOverlay(page)).toBeVisible()
    await expect(pendingStatus).toHaveText('Selecting 2 nodes')
    await expect
      .poll(() => getCanvasPendingSelectionNodeIds(page).then((ids) => ids.length))
      .toBe(2)
    await expect.poll(() => getVisuallySelectedCanvasNodes(page).count()).toBe(2)

    await endCanvasPointerGesture(page)

    await expect(pendingStatus).toHaveCount(0)
    await expect.poll(() => getCommittedSelectedCanvasNodes(page).count()).toBe(2)
    await expect
      .poll(async () => {
        const firstCount = await getCommittedSelectedCanvasNodes(page).count()
        await page.evaluate(
          () =>
            new Promise<void>((resolve) => {
              requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
            }),
        )
        const secondCount = await getCommittedSelectedCanvasNodes(page).count()
        return firstCount === 2 && secondCount === 2
      })
      .toBe(true)
  })

  test('lasso selects enclosed nodes even when pointer up is outside the target and ignores short lassos', async ({
    page,
  }) => {
    await openSelectionCanvas(page)

    await selectCanvasTool(page, 'Lasso select')
    await startCanvasPointerGesture(page, { x: 60, y: 60 })
    await moveCanvasPointer(page, { x: 260, y: 65 })
    await moveCanvasPointer(page, { x: 260, y: 220 })
    await moveCanvasPointer(page, { x: 50, y: 225 })
    await moveCanvasPointer(page, { x: 40, y: 75 })
    await endCanvasPointerGesture(page)

    await expect.poll(() => getCommittedSelectedCanvasNodes(page).count()).toBe(1)
    await expect(getCanvasNodesByType(page, 'text').first()).toHaveAttribute(
      'data-node-selected',
      'true',
    )

    await selectCanvasTool(page, 'Pointer')
    await clickCanvasAt(page, { x: 720, y: 520 })
    await expect.poll(() => getCommittedSelectedCanvasNodes(page).count()).toBe(0)

    await selectCanvasTool(page, 'Lasso select')
    await lassoOnCanvas(page, [
      { x: 600, y: 80 },
      { x: 620, y: 90 },
    ])
    await expect.poll(() => getCommittedSelectedCanvasNodes(page).count()).toBe(0)
  })

  test('uses stroke-specific hit logic for click and marquee selection', async ({ page }) => {
    await openSelectionCanvas(page)

    await selectCanvasTool(page, 'Draw')
    await dragOnCanvas(page, { x: 430, y: 100 }, { x: 520, y: 190 })
    await expect.poll(() => getCanvasNodesByType(page, 'stroke').count()).toBe(1)

    await page.reload()
    await selectCanvasTool(page, 'Pointer')
    await clickCanvasNode(page, getCanvasNodesByType(page, 'stroke').first())
    await expect.poll(() => getCommittedSelectedCanvasNodes(page).count()).toBe(1)
    await expect(getCanvasNodesByType(page, 'stroke').first()).toHaveAttribute(
      'data-node-selected',
      'true',
    )

    await clickCanvasAt(page, { x: 720, y: 520 })
    await dragOnCanvas(page, { x: 425, y: 165 }, { x: 448, y: 192 })
    await expect.poll(() => getCommittedSelectedCanvasNodes(page).count()).toBe(0)

    await dragOnCanvas(page, { x: 460, y: 130 }, { x: 495, y: 165 })
    await expect.poll(() => getCommittedSelectedCanvasNodes(page).count()).toBe(1)
    await expect(getCanvasNodesByType(page, 'stroke').first()).toHaveAttribute(
      'data-node-selected',
      'true',
    )
  })
})

async function openSelectionCanvas(page: Page) {
  await page.goto('/campaigns')
  await navigateToCampaign(page, campaignName)
  await openCanvas(page, canvasName)
}

async function seedSelectionCanvas(page: Page) {
  await selectCanvasTool(page, 'Text')
  await clickCanvasAt(page, { x: 120, y: 120 })
  await page.locator(TEXT_CONTENT_LOCATOR).fill('Alpha')
  await clickCanvasAt(page, { x: 720, y: 520 })
  await expect.poll(() => getCanvasNodesByType(page, 'text').count()).toBe(1)

  await selectCanvasTool(page, 'Text')
  await clickCanvasAt(page, { x: 320, y: 130 })
  await page.locator(TEXT_CONTENT_LOCATOR).fill('Beta')
  await clickCanvasAt(page, { x: 720, y: 520 })
  await expect.poll(() => getCanvasNodesByType(page, 'text').count()).toBe(2)
}
