import { fileURLToPath } from 'node:url'
import path from 'node:path'
import fs from 'node:fs'
import { expect, test } from '@playwright/test'
import { PERMISSION_LEVEL } from 'shared/permissions/types'
import { createCampaign, deleteCampaign, navigateToCampaign } from './helpers/campaign-helpers'
import { createFolder, createNote, openItem } from './helpers/sidebar-helpers'
import {
  approvePlayerRequest,
  getCampaignRouteParts,
  requestToJoinCampaignAsPlayer,
  setResourceAudiencePermission,
} from './helpers/permission-helpers'
import { AUTH_STORAGE_PATH, testName } from './helpers/constants'
import {
  createCanvas,
  enableCanvasRuntime,
  getCanvasNodeById,
  getCanvasSurface,
  getCanvasToolButton,
  getViewportControls,
  openCanvas,
  seedCanvasTextNodesViaRuntime,
  waitForCanvasRuntime,
} from './helpers/canvas-helpers'
import { ensureAcceptedPlayerMember, getCampaignIdFromRoute } from './helpers/convex-helpers'
import {
  createMap,
  mapImage,
  mapPlacementTarget,
  openMap,
  uploadMapImage,
  writeTestMapImage,
} from './helpers/map-helpers'
import type { Page } from '@playwright/test'

const E2E_PLAYER_EMAIL = process.env.E2E_PLAYER_EMAIL
const E2E_PLAYER_PASSWORD = process.env.E2E_PLAYER_PASSWORD

test.skip(
  !E2E_PLAYER_EMAIL || !E2E_PLAYER_PASSWORD,
  'Requires E2E_PLAYER_EMAIL and E2E_PLAYER_PASSWORD env vars',
)

const campaignName = testName('E2E ViewAs')
let sharedNote: string
let unsharedNote: string
let actorFolder: string
let actorCanvas: string
let actorMap: string
let mapPinTarget: string

test.describe.configure({ mode: 'serial', timeout: 180_000 })

test.describe('view-as-player', () => {
  let testImagePath: string

  test.beforeAll(async ({ browser }) => {
    test.setTimeout(180_000)
    const id = Date.now()
    sharedNote = `Shared ${id}-1`
    unsharedNote = `Unshared ${id}-2`
    actorFolder = `Actor Folder ${id}`
    actorCanvas = `Actor Canvas ${id}`
    actorMap = `Actor Map ${id}`
    mapPinTarget = `Actor Pin ${id}`
    testImagePath = path.join(path.dirname(fileURLToPath(import.meta.url)), `view-as-map-${id}.png`)
    writeTestMapImage(testImagePath)

    const context = await browser.newContext({
      storageState: AUTH_STORAGE_PATH,
    })
    const page = await context.newPage()
    await enableCanvasRuntime(page)
    await page.goto('/campaigns', { waitUntil: 'commit' })
    await createCampaign(page, campaignName)
    await navigateToCampaign(page, campaignName)
    await createNote(page, sharedNote)
    await createNote(page, unsharedNote)
    await createFolder(page, actorFolder)
    await createNote(page, mapPinTarget)
    await openNewDashboard(page)
    await createCanvas(page, actorCanvas)
    await waitForCanvasRuntime(page)
    await seedCanvasTextNodesViaRuntime(page, {
      count: 1,
      idPrefix: 'view-as-node',
      labelPrefix: 'View-as canvas node',
      start: { x: 240, y: 180 },
    })
    await openNewDashboard(page)
    await createMap(page, actorMap)
    await uploadMapImage(page, testImagePath, actorMap)
    await pinSidebarItemToOpenMap(page, mapPinTarget)
    const { dmUsername, campaignSlug } = getCampaignRouteParts(page)
    const campaignId = await getCampaignIdFromRoute({ dmUsername, slug: campaignSlug })

    await page.close()
    await context.close()

    await requestToJoinCampaignAsPlayer({
      browser,
      dmUsername,
      campaignSlug,
      email: E2E_PLAYER_EMAIL!,
      password: E2E_PLAYER_PASSWORD!,
    })

    const dmContext = await browser.newContext({
      storageState: AUTH_STORAGE_PATH,
    })
    const dmPage = await dmContext.newPage()
    await dmPage.goto('/campaigns', { waitUntil: 'commit' })
    await navigateToCampaign(dmPage, campaignName)
    await approvePlayerRequest(dmPage, E2E_PLAYER_EMAIL!)
    await ensureAcceptedPlayerMember({ campaignId })
    await shareActorFixtures(dmPage)
    await dmPage.close()
    await dmContext.close()
  })

  test.afterAll(async ({ browser }) => {
    if (testImagePath && fs.existsSync(testImagePath)) {
      fs.unlinkSync(testImagePath)
    }
    const context = await browser.newContext({
      storageState: AUTH_STORAGE_PATH,
    })
    const page = await context.newPage()
    await page.goto('/campaigns', { waitUntil: 'commit' })
    try {
      await deleteCampaign(page, campaignName)
    } catch {
      /* best-effort */
    }
    await page.close()
    await context.close()
  })

  test('share one note with all players', async ({ page }) => {
    await page.goto('/campaigns', { waitUntil: 'commit' })
    await navigateToCampaign(page, campaignName)
    await openItem(page, sharedNote)

    const shareButton = page.getByRole('button', { name: /^(private|shared)$/i })
    await shareButton.click()

    const shareDialog = page.getByRole('dialog').filter({ hasText: 'Share' })
    await expect(shareDialog).toBeVisible({ timeout: 5000 })

    const permSelect = shareDialog.getByRole('combobox').filter({ hasNotText: /full access/i })
    await expect(permSelect).toContainText(/none/i, { timeout: 5000 })
    await permSelect.click()
    await page
      .getByRole('option', { name: /^view$/i })
      .first()
      .click()

    await expect(permSelect).toContainText(/view/i, { timeout: 5000 })
    await page.keyboard.press('Escape')
  })

  test('DM view-as is read-only across canvas, folder, and map actor surfaces', async ({
    page,
  }) => {
    await page.goto('/campaigns', { waitUntil: 'commit' })
    await navigateToCampaign(page, campaignName)
    await enterViewAsPlayer(page)

    await openCanvas(page, actorCanvas)
    await expect(getCanvasSurface(page)).toBeVisible()
    await expect(page.getByRole('toolbar', { name: 'Canvas main toolbar' })).not.toBeVisible()
    await expect(getCanvasToolButton(page, 'Text')).not.toBeVisible()
    const viewport = getViewportControls(page)
    await expect(viewport.zoomIn).toBeVisible()
    await expect(viewport.undo).not.toBeVisible()

    const canvasNode = getCanvasNodeById(page, 'view-as-node-0')
    await expect(canvasNode).toBeVisible()
    await canvasNode.click({ button: 'right' })
    await expect(page.getByRole('menuitem', { name: /^delete$/i })).not.toBeVisible()

    await openItem(page, actorFolder)
    await expect(page.getByText('This folder is empty.')).toBeVisible()
    await expect(page.getByText('Create New')).not.toBeVisible()
    await expect(page.getByRole('button', { name: /^note$/i })).not.toBeVisible()

    await openMap(page, actorMap)
    const pin = page.locator('[data-pin-id]').first()
    await expect(pin).toBeVisible({ timeout: 15000 })
    await pin.click({ button: 'right' })
    await expect(page.getByRole('menuitem', { name: 'Move Pin', exact: true })).not.toBeVisible()
    await expect(page.getByRole('menuitem', { name: 'Remove Pin', exact: true })).not.toBeVisible()
    await expect(page.getByRole('menuitem', { name: /hide pin|show pin/i })).not.toBeVisible()
    await page.keyboard.press('Escape')

    await mapImage(page, actorMap).click({ button: 'right', force: true })
    await expect(page.getByRole('menuitem', { name: 'Create Pin Here' })).not.toBeVisible()
  })

  test('view-as player shows only shared note', async ({ page }) => {
    await page.goto('/campaigns', { waitUntil: 'commit' })
    await navigateToCampaign(page, campaignName)

    await enterViewAsPlayer(page)

    const sidebar = page.getByRole('navigation', { name: 'Sidebar' })
    await expect(sidebar.getByRole('button', { name: sharedNote, exact: true })).toBeVisible({
      timeout: 10000,
    })
    await expect(sidebar.getByRole('button', { name: unsharedNote, exact: true })).not.toBeVisible()
  })

  test('switching back to DM view shows both notes', async ({ page }) => {
    await page.goto('/campaigns', { waitUntil: 'commit' })
    await navigateToCampaign(page, campaignName)

    // May already be in view-as mode from previous test or need to toggle
    const viewAsButton = page.getByRole('button', {
      name: /view as|stop viewing/i,
    })
    await viewAsButton.click()

    const stopOption = page.getByText(/stop|dm|dungeon master/i)
    try {
      await expect(stopOption).toBeVisible({ timeout: 3000 })
      await stopOption.click()
    } catch {
      /* stop option not present */
    }

    const sidebar = page.getByRole('navigation', { name: 'Sidebar' })
    await expect(sidebar.getByRole('button', { name: sharedNote, exact: true })).toBeVisible({
      timeout: 10000,
    })
    await expect(sidebar.getByRole('button', { name: unsharedNote, exact: true })).toBeVisible({
      timeout: 10000,
    })
  })
})

async function shareActorFixtures(page: Page) {
  await openItem(page, actorFolder)
  await setResourceAudiencePermission(page, PERMISSION_LEVEL.EDIT)

  await openItem(page, mapPinTarget)
  await setResourceAudiencePermission(page, PERMISSION_LEVEL.VIEW)

  await openCanvas(page, actorCanvas)
  await setResourceAudiencePermission(page, PERMISSION_LEVEL.EDIT)

  await openMap(page, actorMap)
  await setResourceAudiencePermission(page, PERMISSION_LEVEL.EDIT)
}

async function enterViewAsPlayer(page: Page) {
  const viewAsButton = page.getByRole('button', { name: /view as/i })
  await expect(viewAsButton).toBeVisible()
  await viewAsButton.click()

  const playerUsername = E2E_PLAYER_EMAIL!.split('@')[0]
  const playerItem = page.getByRole('menuitemcheckbox', {
    name: new RegExp(escapeRegExp(playerUsername), 'i'),
  })
  await expect(playerItem).toBeVisible({ timeout: 5000 })
  await playerItem.focus()
  await page.keyboard.press('Enter')
  await expect(page.getByText(/^Viewing as /)).toBeVisible({ timeout: 10_000 })
  await page.keyboard.press('Escape')
  await expect(playerItem).not.toBeVisible({ timeout: 5000 })
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

async function pinSidebarItemToOpenMap(page: Page, itemName: string) {
  const sidebar = page.getByRole('navigation', { name: 'Sidebar' })
  await sidebar.getByRole('button', { name: itemName, exact: true }).click({ button: 'right' })
  await expect(page.getByRole('menu')).toBeVisible({ timeout: 5000 })

  await page.getByRole('menuitem', { name: /pin to map/i }).click()

  const canvas = mapPlacementTarget(page)
  await expect(canvas).toBeVisible()
  const image = mapImage(page, actorMap)
  await image.waitFor({ state: 'visible', timeout: 10000 })
  await page.waitForFunction(
    (el) => {
      const img = el as HTMLImageElement | null
      return img != null && img.complete && img.naturalWidth > 0
    },
    await image.elementHandle(),
    { timeout: 10000 },
  )
  await canvas.click({ force: true })
  await expect(page.locator('[data-pin-id]').first()).toBeVisible({
    timeout: 10000,
  })
}

async function openNewDashboard(page: Page) {
  await page
    .getByRole('navigation', { name: 'Sidebar' })
    .getByRole('button', { name: 'New', exact: true })
    .click()
  await expect(page.getByRole('heading', { name: 'Create New' })).toBeVisible({ timeout: 10000 })
}
