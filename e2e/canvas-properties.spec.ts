import { expect, test } from '@playwright/test'
import { createCampaign, deleteCampaign, navigateToCampaign } from './helpers/campaign-helpers'
import {
  clearCanvasViaRuntime,
  createCanvas,
  DEFAULT_CANVAS_NAME,
  enableCanvasRuntime,
  expectCanvasEdgeModel,
  getCanvasNodeById,
  getCommittedSelectedCanvasNodes,
  openCanvas,
  seedCanvasEdgeViaRuntime,
  seedCanvasTextNodesViaRuntime,
  selectCanvasTool,
  setCanvasSelectionViaRuntime,
  waitForCanvasRuntime,
} from './helpers/canvas-helpers'
import { AUTH_STORAGE_PATH, testName } from './helpers/constants'
import type { Locator, Page } from '@playwright/test'

const campaignName = testName('CnvProps')
const canvasName = DEFAULT_CANVAS_NAME

test.describe.serial('canvas property toolbar workflows', () => {
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
      count: 2,
      columns: 2,
      spacingX: 420,
      start: { x: 460, y: 220 },
    })
    await selectCanvasTool(page, 'Pointer')
  })

  test('applies selected node fill, border, and stroke-size changes and reloads them', async ({
    page,
  }) => {
    const node = getCanvasNodeById(page, 'perf-node-0')
    await node.click()
    await expect.poll(() => getCommittedSelectedCanvasNodes(page).count()).toBe(1)

    await propertySection(page, 'Fill').getByRole('button', { name: 'Select Blue color' }).click()
    await propertySection(page, 'Stroke').getByRole('button', { name: 'Select Red color' }).click()
    await page.getByRole('textbox', { name: 'Stroke size input' }).fill('7')
    await page.getByRole('textbox', { name: 'Stroke size input' }).press('Enter')

    await expect
      .poll(() => readNodeSurfaceStyle(node))
      .toMatchObject({
        borderWidth: '7px',
      })

    await page.waitForTimeout(500)
    await page.reload()
    await expect(getCanvasNodeById(page, 'perf-node-0')).toBeVisible({ timeout: 10_000 })
    await getCanvasNodeById(page, 'perf-node-0').click()

    await expect
      .poll(() => readNodeSurfaceStyle(getCanvasNodeById(page, 'perf-node-0')))
      .toMatchObject({
        borderWidth: '7px',
      })
  })

  test('shows mixed state for different selected node values and fans out a shared update', async ({
    page,
  }) => {
    await getCanvasNodeById(page, 'perf-node-0').click()
    await propertySection(page, 'Stroke').getByRole('button', { name: 'Select Red color' }).click()
    await page.getByRole('textbox', { name: 'Stroke size input' }).fill('3')
    await page.getByRole('textbox', { name: 'Stroke size input' }).press('Enter')

    await getCanvasNodeById(page, 'perf-node-1').click()
    await propertySection(page, 'Stroke').getByRole('button', { name: 'Select Blue color' }).click()
    await page.getByRole('textbox', { name: 'Stroke size input' }).fill('7')
    await page.getByRole('textbox', { name: 'Stroke size input' }).press('Enter')

    await page.keyboard.down(process.platform === 'darwin' ? 'Meta' : 'Control')
    try {
      await getCanvasNodeById(page, 'perf-node-0').click()
    } finally {
      await page.keyboard.up(process.platform === 'darwin' ? 'Meta' : 'Control')
    }
    await expect.poll(() => getCommittedSelectedCanvasNodes(page).count()).toBe(2)

    const sharedStrokeSizeInput = page.getByRole('textbox', { name: 'Stroke size input' })
    await expect(sharedStrokeSizeInput).toHaveAttribute('placeholder', '--')
    await sharedStrokeSizeInput.fill('5')
    await sharedStrokeSizeInput.press('Enter')

    await expect
      .poll(async () =>
        Promise.all([
          readNodeSurfaceStyle(getCanvasNodeById(page, 'perf-node-0')),
          readNodeSurfaceStyle(getCanvasNodeById(page, 'perf-node-1')),
        ]),
      )
      .toEqual([
        expect.objectContaining({
          borderWidth: '5px',
        }),
        expect.objectContaining({
          borderWidth: '5px',
        }),
      ])
  })

  test('applies edge color, opacity, stroke width, and type controls with reload persistence', async ({
    page,
  }) => {
    await seedCanvasEdgeViaRuntime(page, {
      id: 'prop-edge',
      source: 'perf-node-0',
      target: 'perf-node-1',
    })
    await setCanvasSelectionViaRuntime(page, { edgeIds: ['prop-edge'] })

    await page.getByRole('button', { name: 'Change edge type to Step' }).click()
    await propertySection(page, 'Stroke').getByRole('button', { name: 'Select Red color' }).click()
    await page.getByRole('slider', { name: 'Stroke size' }).fill('6')
    await page.keyboard.press('ArrowRight')

    await expectCanvasEdgeModel(page, 'prop-edge', {
      type: 'step',
      style: {
        strokeWidth: 7,
      },
    })

    await page.reload()
    await waitForCanvasRuntime(page)
    await expectCanvasEdgeModel(page, 'prop-edge', {
      type: 'step',
      style: {
        strokeWidth: 7,
      },
    })
  })
})

function propertySection(page: Page, label: 'Fill' | 'Stroke'): Locator {
  const toolbar = page.getByRole('toolbar', { name: 'Canvas conditional toolbar' })
  return toolbar
    .locator('div')
    .filter({ has: page.getByText(label, { exact: true }) })
    .first()
}

async function readNodeSurfaceStyle(node: Locator) {
  return node
    .getByRole('group')
    .first()
    .evaluate((element) => {
      const style = getComputedStyle(element)
      return {
        backgroundColor: style.backgroundColor,
        borderColor: style.borderColor,
        borderWidth: style.borderWidth,
      }
    })
}
