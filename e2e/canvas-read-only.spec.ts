import { expect, test } from '@playwright/test'
import { signIn } from './helpers/auth-helpers'
import { createCampaign, deleteCampaign, navigateToCampaign } from './helpers/campaign-helpers'
import {
  clickCanvasAt,
  clearCanvasViaRuntime,
  createCanvas,
  DEFAULT_CANVAS_NAME,
  dragCanvasNode,
  enableCanvasRuntime,
  getCanvasEdges,
  getCanvasNodeById,
  getCanvasNodes,
  getCanvasRuntimeCanvasId,
  getCanvasRuntimeNodePosition,
  getCanvasSurface,
  getEmbeddedCanvasPreview,
  getViewportControls,
  openCanvas,
  seedCanvasEdgeViaRuntime,
  seedCanvasEmbedNodeViaRuntime,
  seedCanvasStrokeNodesViaRuntime,
  seedCanvasTextNodesViaRuntime,
  selectCanvasTool,
  wheelCanvasPane,
} from './helpers/canvas-helpers'
import { openSettingsPeopleTab } from './helpers/permission-helpers'
import { AUTH_STORAGE_PATH, testName } from './helpers/constants'
import type { Page } from '@playwright/test'

const E2E_PLAYER_EMAIL = process.env.E2E_PLAYER_EMAIL
const E2E_PLAYER_PASSWORD = process.env.E2E_PLAYER_PASSWORD

test.skip(
  !E2E_PLAYER_EMAIL || !E2E_PLAYER_PASSWORD,
  'Requires E2E_PLAYER_EMAIL and E2E_PLAYER_PASSWORD env vars',
)

const campaignName = testName('CnvReadonly')
const sourceCanvasName = 'Read-only Source Canvas'
const sharedCanvasName = DEFAULT_CANVAS_NAME

test.describe.serial('canvas read-only permission mode', () => {
  test.setTimeout(120_000)

  test.beforeAll(async ({ browser }) => {
    test.setTimeout(180_000)
    const dmContext = await browser.newContext({ storageState: AUTH_STORAGE_PATH })
    const dmPage = await dmContext.newPage()
    await enableCanvasRuntime(dmPage)
    await dmPage.goto('/campaigns')
    await createCampaign(dmPage, campaignName)
    await navigateToCampaign(dmPage, campaignName)
    await createCanvas(dmPage, sourceCanvasName)
    await clearCanvasViaRuntime(dmPage)
    await seedCanvasTextNodesViaRuntime(dmPage, {
      count: 1,
      idPrefix: 'readonly-child',
      labelPrefix: 'Readonly child',
      start: { x: 80, y: 80 },
    })
    const sourceCanvasId = await getCanvasRuntimeCanvasId(dmPage)

    await dmPage
      .getByRole('navigation', { name: 'Sidebar' })
      .getByRole('link', { name: 'New' })
      .click()
    await createCanvas(dmPage, sharedCanvasName)
    await clearCanvasViaRuntime(dmPage)
    await seedCanvasTextNodesViaRuntime(dmPage, {
      count: 2,
      columns: 2,
      idPrefix: 'readonly-node',
      labelPrefix: 'Readonly node',
      start: { x: 140, y: 140 },
      spacingX: 220,
    })
    await seedCanvasStrokeNodesViaRuntime(dmPage, {
      count: 1,
      idPrefix: 'readonly-stroke',
      start: { x: 160, y: 320 },
    })
    await seedCanvasEdgeViaRuntime(dmPage, {
      id: 'readonly-edge',
      source: 'readonly-node-0',
      target: 'readonly-node-1',
    })
    await seedCanvasEmbedNodeViaRuntime(dmPage, {
      id: 'readonly-embed',
      sidebarItemId: sourceCanvasId,
      position: { x: 180, y: 420 },
      width: 360,
      height: 240,
    })

    const url = dmPage.url()
    const match = url.match(/\/campaigns\/([^/]+)\/([^/]+)/)
    if (!match) throw new Error(`Unexpected campaign URL format: ${url}`)
    const [, dmUsername, campaignSlug] = match

    await shareCurrentItemWithPlayers(dmPage)
    await dmPage.close()
    await dmContext.close()

    const playerContext = await browser.newContext()
    const playerPage = await playerContext.newPage()
    await playerPage.goto('/sign-in', { waitUntil: 'networkidle' })
    await signIn(playerPage, E2E_PLAYER_EMAIL!, E2E_PLAYER_PASSWORD!)
    await playerPage.waitForURL('**/campaigns', { timeout: 30_000 })
    await playerPage.goto(`/join/${dmUsername}/${campaignSlug}`)
    const joinButton = playerPage.getByRole('button', { name: /join/i })
    if (await joinButton.isVisible().catch(() => false)) {
      await joinButton.click()
      await expect(playerPage.getByText(/Request Sent|You're In!/i)).toBeVisible({
        timeout: 10_000,
      })
    }
    await playerPage.close()
    await playerContext.close()

    const approvalContext = await browser.newContext({ storageState: AUTH_STORAGE_PATH })
    const approvalPage = await approvalContext.newPage()
    await approvalPage.goto('/campaigns')
    await navigateToCampaign(approvalPage, campaignName)
    const dialog = await openSettingsPeopleTab(approvalPage)
    const playerRow = dialog
      .locator('div')
      .filter({ hasText: new RegExp(escapeRegExp(E2E_PLAYER_EMAIL!), 'i') })
    const approveButton = playerRow.getByRole('button', { name: /approve|accept/i })
    if (await approveButton.isVisible().catch(() => false)) {
      await approveButton.click()
    }
    await approvalPage.close()
    await approvalContext.close()
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
    await page.getByRole('button', { name: /view as/i }).click()
    const playerUsername = E2E_PLAYER_EMAIL!.split('@')[0]
    await page
      .getByRole('menuitemcheckbox', {
        name: new RegExp(escapeRegExp(playerUsername), 'i'),
      })
      .click()
    await openCanvas(page, sharedCanvasName)
    await expect(getCanvasSurface(page)).toBeVisible({ timeout: 10_000 })
  })

  // test.fixme: "renders canvas content while preventing editing gestures and mutation controls"
  // The view-as/player route setup is not reliable enough yet; re-enable when the player
  // permission flow consistently opens this canvas in read-only mode from Playwright.
  test.fixme('renders canvas content while preventing editing gestures and mutation controls', async ({
    page,
  }) => {
    await expect
      .poll(() => getCanvasNodes(page).count(), { timeout: 15_000 })
      .toBeGreaterThanOrEqual(4)
    await expect(getCanvasEdges(page)).toHaveCount(1)
    await expect(getEmbeddedCanvasPreview(page)).toBeVisible({ timeout: 15_000 })
    await expect(page.getByRole('toolbar', { name: 'Canvas main toolbar' })).not.toBeVisible()
    await expect(
      page.getByRole('toolbar', { name: 'Canvas conditional toolbar' }),
    ).not.toBeVisible()

    const before = await getCanvasRuntimeNodePosition(page, 'readonly-node-0')
    await dragCanvasNode(page, getCanvasNodeById(page, 'readonly-node-0'), { x: 80, y: 40 })
    await expect.poll(() => getCanvasRuntimeNodePosition(page, 'readonly-node-0')).toEqual(before)

    await page.keyboard.press('Delete')
    await expect(getCanvasNodeById(page, 'readonly-node-0')).toBeVisible()
    await selectCanvasTool(page, 'Text').catch(() => undefined)
    await clickCanvasAt(page, { x: 620, y: 300 })
    await expect(
      page.locator('[aria-label="Text node content"][contenteditable="true"]'),
    ).toHaveCount(0)

    await wheelCanvasPane(page, { x: 0, y: 160 })
    await getViewportControls(page).zoomIn.click()
  })
})

async function shareCurrentItemWithPlayers(page: Page) {
  await page.getByRole('button', { name: /^private|^shared/i }).click()
  const shareDialog = page.getByRole('dialog').filter({ hasText: 'Share' })
  await expect(shareDialog).toBeVisible({ timeout: 5000 })
  const permSelect = shareDialog.getByRole('combobox').filter({ hasNotText: /full access/i })
  await permSelect.click()
  await page
    .getByRole('option', { name: /^view$/i })
    .first()
    .click()
  await expect(permSelect).toContainText(/view/i, { timeout: 5000 })
  await page.keyboard.press('Escape')
  await expect(shareDialog).not.toBeVisible({ timeout: 5000 })
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
