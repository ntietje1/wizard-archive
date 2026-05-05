import { expect, test } from '@playwright/test'
import { createCampaign, deleteCampaign, navigateToCampaign } from './helpers/campaign-helpers'
import {
  clickCanvasAt,
  clearCanvasViaRuntime,
  createCanvas,
  DEFAULT_CANVAS_NAME,
  enableCanvasRuntime,
  expectCanvasRuntimeSelection,
  getCanvasEdges,
  getCanvasNodes,
  getCanvasRuntimeSnapshot,
  getCanvasToolButton,
  getViewportControls,
  openCanvas,
  seedCanvasEdgeViaRuntime,
  seedCanvasTextNodesViaRuntime,
  selectCanvasTool,
  setCanvasSelectionViaRuntime,
  waitForCanvasRuntime,
} from './helpers/canvas-helpers'
import { AUTH_STORAGE_PATH, testName } from './helpers/constants'

const campaignName = testName('CnvKeyboard')
const canvasName = DEFAULT_CANVAS_NAME
const primaryModifier = process.platform === 'darwin' ? 'Meta' : 'Control'

test.describe.serial('canvas keyboard shortcuts', () => {
  test.setTimeout(60_000)

  test.beforeAll(async ({ browser }) => {
    const context = await browser.newContext({ storageState: AUTH_STORAGE_PATH })
    const page = await context.newPage()
    await page.goto('/campaigns')
    await createCampaign(page, campaignName)
    await navigateToCampaign(page, campaignName)
    await createCanvas(page, canvasName)
    await page.close()
    await context.close()
  })

  test.afterAll(async ({ browser }) => {
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

  test.beforeEach(async ({ page }) => {
    await enableCanvasRuntime(page)
    await page.goto('/campaigns')
    await navigateToCampaign(page, campaignName)
    await openCanvas(page, canvasName)
    await waitForCanvasRuntime(page)
    await clearCanvasViaRuntime(page)
    await seedCanvasTextNodesViaRuntime(page, {
      count: 3,
      columns: 3,
      spacingX: 180,
      start: { x: 180, y: 180 },
    })
    await selectCanvasTool(page, 'Pointer')
  })

  test('handles delete, escape, select all, tool shortcuts, undo, and redo', async ({ page }) => {
    await setCanvasSelectionViaRuntime(page, { nodeIds: ['perf-node-0'] })

    await page.keyboard.press('Delete')
    await expect.poll(() => getCanvasNodes(page).count()).toBe(2)

    await getViewportControls(page).undo.click()
    await expect.poll(() => getCanvasNodes(page).count()).toBe(3)
    await getViewportControls(page).redo.click()
    await expect.poll(() => getCanvasNodes(page).count()).toBe(2)
    await getViewportControls(page).undo.click()

    await page.keyboard.press(`${primaryModifier}+A`)
    await expectCanvasRuntimeSelection(page, {
      nodeIds: ['perf-node-0', 'perf-node-1', 'perf-node-2'],
      edgeIds: [],
    })

    await page.keyboard.press('Escape')
    await expectCanvasRuntimeSelection(page, { nodeIds: [], edgeIds: [] })

    await page.keyboard.press('4')
    await expect(getCanvasToolButton(page, 'Draw')).toHaveAttribute('aria-pressed', 'true')
    await page.keyboard.press('7')
    await expect(getCanvasToolButton(page, 'Edges')).toHaveAttribute('aria-pressed', 'true')
    await page.keyboard.press('1')
    await expect(getCanvasToolButton(page, 'Pointer')).toHaveAttribute('aria-pressed', 'true')
  })

  test('copies, cuts, and pastes selected canvas nodes', async ({ page }) => {
    await setCanvasSelectionViaRuntime(page, { nodeIds: ['perf-node-0'] })

    await page.keyboard.press(`${primaryModifier}+C`)
    await page.keyboard.press(`${primaryModifier}+V`)
    await expect.poll(() => getCanvasNodes(page).count()).toBe(4)

    await page.keyboard.press(`${primaryModifier}+X`)
    await expect.poll(() => getCanvasNodes(page).count()).toBe(3)
    await page.keyboard.press(`${primaryModifier}+V`)
    await expect.poll(() => getCanvasNodes(page).count()).toBe(4)
  })

  test('copies mixed node and edge selections with pasted edges reconnected to pasted nodes', async ({
    page,
  }) => {
    await seedCanvasEdgeViaRuntime(page, {
      id: 'keyboard-edge',
      source: 'perf-node-0',
      target: 'perf-node-1',
    })
    await setCanvasSelectionViaRuntime(page, {
      nodeIds: ['perf-node-0', 'perf-node-1'],
      edgeIds: ['keyboard-edge'],
    })

    await page.keyboard.press(`${primaryModifier}+C`)
    await page.keyboard.press(`${primaryModifier}+V`)

    await expect.poll(() => getCanvasNodes(page).count()).toBe(5)
    await expect.poll(() => getCanvasEdges(page).count()).toBe(2)
    await expect
      .poll(async () => {
        const snapshot = await getCanvasRuntimeSnapshot(page)
        const pastedEdge = snapshot.edges.find((edge) => edge.id !== 'keyboard-edge')
        if (!pastedEdge) return null
        return {
          sourceIsOriginal: ['perf-node-0', 'perf-node-1'].includes(pastedEdge.source),
          targetIsOriginal: ['perf-node-0', 'perf-node-1'].includes(pastedEdge.target),
          sourceExists: snapshot.nodes.some((node) => node.id === pastedEdge.source),
          targetExists: snapshot.nodes.some((node) => node.id === pastedEdge.target),
        }
      })
      .toEqual({
        sourceIsOriginal: false,
        targetIsOriginal: false,
        sourceExists: true,
        targetExists: true,
      })
  })

  test('suppresses canvas shortcuts while text editing is active', async ({ page }) => {
    await clearCanvasViaRuntime(page)
    await selectCanvasTool(page, 'Text')
    await clickCanvasAt(page, { x: 360, y: 260 })
    const editor = page.locator('[aria-label="Text node content"][contenteditable="true"]').last()
    await expect(editor).toBeVisible()
    await editor.fill('Keyboard edit target')

    await page.keyboard.press(`${primaryModifier}+A`)
    await page.keyboard.press('Backspace')
    await expect.poll(() => getCanvasNodes(page).count()).toBe(1)
    await expect(editor).toBeVisible()
  })
})
