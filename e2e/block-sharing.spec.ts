import { expect, test } from '@playwright/test'
import { api } from 'convex/_generated/api'
import { SHARE_STATUS } from '../shared/block-shares/share-status'
import { PERMISSION_LEVEL } from 'shared/permissions/types'
import { createCampaign, deleteCampaign, navigateToCampaign } from './helpers/campaign-helpers'
import { createNote, openItem } from './helpers/sidebar-helpers'
import { typeInEditor } from './helpers/editor-helpers'
import {
  approvePlayerRequest,
  blockShareAllPlayersRow,
  blockSharePlayerRow,
  getCampaignRouteParts,
  getBlockTextLocator,
  getVisibleBlockDragHandle,
  getVisibleBlockShareButton,
  openBlockShareMenu,
  openEditorContextMenuFromBlockDragHandle,
  openEditorContextMenuFromBlockShareButton,
  openBlockShareMenuWithKeyboard,
  requestToJoinCampaignAsPlayer,
  rightMouseDownOnBlockText,
  setSelectValue,
  shareBlockFromEditorContextMenu,
  shiftClickBlockShareButton,
} from './helpers/permission-helpers'
import {
  createE2EConvexClient,
  ensureAcceptedPlayerMember,
  getCampaignIdFromRoute,
  getSidebarItemIdBySlug,
} from './helpers/convex-helpers'
import { AUTH_STORAGE_PATH, testName } from './helpers/constants'
import { signInByApi } from './helpers/auth-helpers'
import type { Browser } from '@playwright/test'
import type { Id } from 'convex/_generated/dataModel'
import type { CampaignId, CampaignMemberId } from '@wizard-archive/editor/resources/domain-id'
import type { ShareStatus } from '../shared/block-shares/share-status'
import type { PermissionLevel } from 'shared/permissions/types'

const E2E_PLAYER_EMAIL = process.env.E2E_PLAYER_EMAIL
const E2E_PLAYER_PASSWORD = process.env.E2E_PLAYER_PASSWORD

test.skip(
  !E2E_PLAYER_EMAIL || !E2E_PLAYER_PASSWORD,
  'Requires E2E_PLAYER_EMAIL and E2E_PLAYER_PASSWORD env vars',
)

const campaignName = testName('E2E Blocks')
const noteName = `Block Share Note ${Date.now()}`
const visibleBlockText = `Visible block ${Date.now()}`
const conditionalBlockText = `Conditional block ${Date.now()}`
const PLAYER_AUTH_STORAGE_PATH = 'e2e/.auth/player.json'

let campaignId: CampaignId
let noteId: Id<'sidebarItems'>
let playerMemberId: CampaignMemberId
let dmUsername: string
let campaignSlug: string
let noteSlug: string
let visibleBlockNoteId: string
let conditionalBlockNoteId: string
let convexClient: Awaited<ReturnType<typeof createE2EConvexClient>> | null = null

test.describe.configure({ mode: 'serial', timeout: 120_000 })

test.describe('block sharing', () => {
  test.beforeAll(async ({ browser }) => {
    test.setTimeout(120_000)
    convexClient = await createE2EConvexClient()
    const context = await browser.newContext({
      storageState: AUTH_STORAGE_PATH,
    })
    const page = await context.newPage()
    await page.goto('/campaigns', { waitUntil: 'commit' })
    await createCampaign(page, campaignName)
    await navigateToCampaign(page, campaignName)
    ;({ dmUsername, campaignSlug } = getCampaignRouteParts(page))
    campaignId = await getCampaignIdFromRoute({ dmUsername, slug: campaignSlug })

    await createNote(page, noteName)
    const itemSlug = new URL(page.url()).searchParams.get('item')
    if (!itemSlug) {
      throw new Error(`Unable to read note slug from ${page.url()}`)
    }
    noteSlug = itemSlug
    noteId = await getSidebarItemIdBySlug({ campaignId, slug: itemSlug })

    await typeInEditor(page, visibleBlockText)
    await page.keyboard.press('Enter')
    await page.keyboard.type(conditionalBlockText)
    await expect(getBlockTextLocator(page, conditionalBlockText)).toBeVisible({
      timeout: 10000,
    })
    visibleBlockNoteId = await waitForPersistedBlockText(visibleBlockText)
    conditionalBlockNoteId = await waitForPersistedBlockText(conditionalBlockText)

    await page.close()
    await context.close()

    await requestToJoinCampaignAsPlayer({
      browser,
      dmUsername,
      campaignSlug,
      email: E2E_PLAYER_EMAIL!,
      password: E2E_PLAYER_PASSWORD!,
      storageStatePath: PLAYER_AUTH_STORAGE_PATH,
    })

    const dmContext = await browser.newContext({
      storageState: AUTH_STORAGE_PATH,
    })
    const dmPage = await dmContext.newPage()
    await dmPage.goto('/campaigns', { waitUntil: 'commit' })
    await navigateToCampaign(dmPage, campaignName)
    await approvePlayerRequest(dmPage, E2E_PLAYER_EMAIL!)
    await dmPage.close()
    await dmContext.close()

    playerMemberId = await getPlayerMemberId()
  })

  test.afterAll(async ({ browser }) => {
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

  test('block share menu shows players without note access as normal player rows', async ({
    page,
  }) => {
    await setPlayerNotePermission(PERMISSION_LEVEL.NONE)
    await setBlockMemberPermission(visibleBlockNoteId, null)
    await openCampaignNote(page)

    let menu = await openBlockShareMenu(page, visibleBlockText)
    await expect(
      blockShareAllPlayersRow(menu).getByRole('button', { name: /all players/i }),
    ).toHaveAttribute('aria-expanded', 'true')
    await expect(menu.getByText(/no players in this campaign yet/i)).not.toBeVisible()
    await expect(blockSharePlayerRow(menu, playerMemberId)).toHaveAttribute(
      'data-share-kind',
      'controllable',
    )
    await expect(blockSharePlayerRow(menu, playerMemberId).getByRole('combobox')).toContainText(
      /hidden/i,
    )
    await expect(page.getByText(/share the note with/i)).not.toBeVisible()

    const allPlayersSelect = blockShareAllPlayersRow(menu).getByRole('combobox')
    await allPlayersSelect.click()
    await expect(page.getByRole('option', { name: /^hidden$/i })).toBeVisible()
    await expect(page.getByRole('option', { name: /^visible$/i })).toBeVisible()
    await expect(page.getByRole('option', { name: /^default/i })).not.toBeVisible()
    await page.keyboard.press('Escape')
    await page.keyboard.press('Escape')
    await expect(menu).not.toBeVisible({ timeout: 5000 })

    menu = await openBlockShareMenuWithKeyboard(page, visibleBlockText)
    await expect(blockShareAllPlayersRow(menu)).toBeVisible()
    const allPlayersBox = await blockShareAllPlayersRow(menu).boundingBox()
    const playerBox = await blockSharePlayerRow(menu, playerMemberId).boundingBox()
    expect(allPlayersBox?.y).toBeLessThan(playerBox?.y ?? Number.POSITIVE_INFINITY)
    const menuBox = await menu.boundingBox()
    const viewportSize = page.viewportSize()
    expect(
      menuBox && viewportSize ? menuBox.y + menuBox.height <= viewportSize.height + 1 : false,
    ).toBe(true)
  })

  test('editor context menu shares the clicked block with all players', async ({ page }) => {
    await setPlayerNotePermission(PERMISSION_LEVEL.VIEW)
    await setBlockAllPlayersStatus(visibleBlockNoteId, SHARE_STATUS.NOT_SHARED)
    await openCampaignNote(page)

    await shareBlockFromEditorContextMenu(page, visibleBlockText)
    await expectBlockAllPlayersStatus(visibleBlockNoteId, SHARE_STATUS.ALL_SHARED)
    await page.keyboard.press('Escape')

    const menu = await openBlockShareMenu(page, visibleBlockText)
    await expect(blockShareAllPlayersRow(menu).getByRole('combobox')).toContainText(/visible/i)
  })

  test('editor text context menu opens after right mouse up', async ({ page }) => {
    await setPlayerNotePermission(PERMISSION_LEVEL.VIEW)
    await setBlockAllPlayersStatus(visibleBlockNoteId, SHARE_STATUS.NOT_SHARED)
    await openCampaignNote(page)

    await rightMouseDownOnBlockText(page, visibleBlockText)

    await expect(page.getByRole('menuitem', { name: /^share (?:\d+ )?block$/i })).not.toBeVisible()

    await page.mouse.up({ button: 'right' })

    await expect(page.getByRole('menuitem', { name: /^share (?:\d+ )?block$/i })).toBeVisible({
      timeout: 5000,
    })
  })

  test('right-clicking the side-menu share button opens the normal editor context menu', async ({
    page,
  }) => {
    await setPlayerNotePermission(PERMISSION_LEVEL.VIEW)
    await openCampaignNote(page)

    await openEditorContextMenuFromBlockShareButton(page, visibleBlockText)
  })

  test('left-clicking the drag handle opens the block actions menu', async ({ page }) => {
    await setPlayerNotePermission(PERMISSION_LEVEL.VIEW)
    await openCampaignNote(page)

    const menu = page.getByTestId('block-drag-handle-menu')
    await expect(menu).not.toBeVisible()
    const shareButton = await getVisibleBlockShareButton(page, visibleBlockText)
    const dragHandle = await getVisibleBlockDragHandle(page, visibleBlockText)
    const handleBox = await dragHandle.boundingBox()
    if (!handleBox) throw new Error('Expected drag handle to have a bounding box')
    await page.mouse.move(handleBox.x + handleBox.width / 2, handleBox.y + handleBox.height / 2)
    await page.mouse.down()
    await expect(menu).not.toBeVisible()
    await page.mouse.up()
    await expect(menu).toBeVisible()
    await expect(menu.getByRole('menuitem', { name: /^turn into$/i })).toBeVisible()
    await expect(menu.getByRole('menuitem', { name: /^color$/i })).toBeVisible()
    await expect(menu.getByRole('menuitem', { name: /^copy link to block$/i })).toBeVisible()
    await expect(menu.getByRole('menuitem', { name: /^duplicate$/i })).toBeVisible()
    await expect(menu.getByRole('menuitem', { name: /^delete$/i })).toBeVisible()
    await expect(menu.getByRole('menuitem', { name: /^comment$/i })).toBeVisible()
    await expect(dragHandle).toHaveAttribute('aria-expanded', 'true')
    await expect(page.getByText(/drag\s+to move/i)).not.toBeVisible()
    await expect(page.getByText(/click\s+to open menu/i)).not.toBeVisible()
    await expect(page.getByText(/click\s+to open share menu/i)).not.toBeVisible()
    await expect(page.getByText(/shift click\s+to share to all/i)).not.toBeVisible()

    const menuBox = await menu.boundingBox()
    expect(handleBox && menuBox ? menuBox.x + menuBox.width <= handleBox.x + 1 : false).toBe(true)
    expect(
      handleBox && menuBox
        ? Math.abs(menuBox.y + menuBox.height / 2 - (handleBox.y + handleBox.height / 2))
        : Number.POSITIVE_INFINITY,
    ).toBeLessThan(12)

    if (!menuBox) throw new Error('Expected drag handle menu to have a bounding box')
    await page.mouse.move(menuBox.x + menuBox.width / 2, menuBox.y + menuBox.height / 2)
    await expect(menu).toBeVisible()

    await dragHandle.hover()
    await expect(page.getByText(/drag\s+to move/i)).not.toBeVisible()
    await expect(page.getByText(/click\s+to open menu/i)).not.toBeVisible()
    await expect(menu).toBeVisible()

    const shareButtonBox = await shareButton.boundingBox()
    if (!shareButtonBox) throw new Error('Expected share button to have a bounding box')
    await page.mouse.move(
      shareButtonBox.x + shareButtonBox.width / 2,
      shareButtonBox.y + shareButtonBox.height / 2,
    )
    await expect(page.getByText(/click\s+to open share menu/i)).not.toBeVisible()
    await expect(page.getByText(/shift click\s+to share to all/i)).not.toBeVisible()
    await expect(menu).toBeVisible()
  })

  test('right-clicking the drag handle opens the normal editor context menu', async ({ page }) => {
    await setPlayerNotePermission(PERMISSION_LEVEL.VIEW)
    await openCampaignNote(page)

    await openEditorContextMenuFromBlockDragHandle(page, visibleBlockText)
  })

  test('side-menu share and drag buttons explain their primary gestures', async ({ page }) => {
    await setPlayerNotePermission(PERMISSION_LEVEL.VIEW)
    await openCampaignNote(page)

    const shareButton = await getVisibleBlockShareButton(page, visibleBlockText)
    await shareButton.hover()
    await expect(page.getByText(/click\s+to open share menu/i)).toBeVisible()
    await expect(page.getByText(/shift click\s+to share to all/i)).toBeVisible()

    const dragHandle = await getVisibleBlockDragHandle(page, visibleBlockText)
    await dragHandle.hover()
    await expect(page.getByText(/drag\s+to move/i)).toBeVisible()
    await expect(page.getByText(/click\s+to open menu/i)).toBeVisible()
  })

  test('shift left-click keeps all-player block sharing visible without opening the popover', async ({
    browser,
    page,
  }) => {
    await setPlayerNotePermission(PERMISSION_LEVEL.VIEW)
    await setBlockAllPlayersStatus(visibleBlockNoteId, SHARE_STATUS.ALL_SHARED)
    await setBlockMemberPermission(visibleBlockNoteId, null)
    await setBlockAllPlayersStatus(conditionalBlockNoteId, SHARE_STATUS.NOT_SHARED)
    await setBlockMemberPermission(conditionalBlockNoteId, null)
    await openCampaignNote(page)

    await shiftClickBlockShareButton(page, visibleBlockText)

    await expect(page.getByTestId('block-share-menu')).not.toBeVisible()
    await expectBlocksAsActualPlayer(browser, {
      visible: [visibleBlockText],
      hidden: [conditionalBlockText],
    })
  })

  test('explicit block share before note access shows a warning but does not grant note access', async ({
    browser,
    page,
  }) => {
    await setPlayerNotePermission(PERMISSION_LEVEL.NONE)
    await setBlockMemberPermission(visibleBlockNoteId, null)
    await setBlockAllPlayersStatus(visibleBlockNoteId, SHARE_STATUS.NOT_SHARED)
    await openCampaignNote(page)

    const menu = await openBlockShareMenu(page, visibleBlockText)
    const playerRow = blockSharePlayerRow(menu, playerMemberId)
    await setSelectValue(playerRow.getByRole('combobox'), /^visible$/i)
    await expect(menu).toBeVisible({ timeout: 10000 })
    await expect(playerRow.getByRole('combobox')).toContainText(/visible/i, { timeout: 10000 })
    await expect(page.getByTestId('block-share-access-warning')).toHaveAccessibleName(
      /blocks? explicitly shared/i,
      { timeout: 10000 },
    )

    await expectBlocksAsActualPlayer(browser, {
      visible: [],
      hidden: [visibleBlockText, conditionalBlockText],
    })

    await setPlayerNotePermission(PERMISSION_LEVEL.VIEW)
    await openCampaignNote(page)
    await expect(page.getByTestId('block-share-access-warning')).not.toBeVisible()
    await expectBlocksAsActualPlayer(browser, {
      visible: [visibleBlockText],
      hidden: [conditionalBlockText],
    })
  })

  test('all players visible shares a block with note-view players', async ({ browser, page }) => {
    await setPlayerNotePermission(PERMISSION_LEVEL.VIEW)
    await setBlockMemberPermission(visibleBlockNoteId, PERMISSION_LEVEL.VIEW)
    await setBlockAllPlayersStatus(visibleBlockNoteId, SHARE_STATUS.NOT_SHARED)
    await setBlockMemberPermission(conditionalBlockNoteId, null)
    await setBlockAllPlayersStatus(conditionalBlockNoteId, SHARE_STATUS.NOT_SHARED)
    await openCampaignNote(page)

    const menu = await openBlockShareMenu(page, conditionalBlockText)
    const allPlayersSelect = blockShareAllPlayersRow(menu).getByRole('combobox')
    await setSelectValue(allPlayersSelect, /^visible$/i)
    await expect(menu).toBeVisible({ timeout: 10000 })
    await expect(allPlayersSelect).toContainText(/visible/i, { timeout: 10000 })

    await expectBlocksAsActualPlayer(browser, {
      visible: [visibleBlockText, conditionalBlockText],
      hidden: [],
    })
  })

  test('member hidden override beats all-player visible and default restores inheritance', async ({
    browser,
    page,
  }) => {
    await setPlayerNotePermission(PERMISSION_LEVEL.VIEW)
    await setBlockMemberPermission(visibleBlockNoteId, PERMISSION_LEVEL.VIEW)
    await setBlockAllPlayersStatus(visibleBlockNoteId, SHARE_STATUS.NOT_SHARED)
    await setBlockAllPlayersStatus(conditionalBlockNoteId, SHARE_STATUS.ALL_SHARED)
    await setBlockMemberPermission(conditionalBlockNoteId, null)
    await openCampaignNote(page)

    let menu = await openBlockShareMenu(page, conditionalBlockText)
    let playerRow = blockSharePlayerRow(menu, playerMemberId)
    await setSelectValue(playerRow.getByRole('combobox'), /^hidden$/i)
    await expect(menu).toBeVisible({ timeout: 10000 })
    await expect(playerRow.getByRole('combobox')).toContainText(/hidden/i, { timeout: 10000 })

    await expectBlocksAsActualPlayer(browser, {
      visible: [visibleBlockText],
      hidden: [conditionalBlockText],
    })

    await openCampaignNote(page)
    menu = await openBlockShareMenu(page, conditionalBlockText)
    playerRow = blockSharePlayerRow(menu, playerMemberId)
    await setSelectValue(playerRow.getByRole('combobox'), /^remove$/i)
    await expect(menu).toBeVisible({ timeout: 10000 })
    await expect(playerRow.getByRole('combobox')).toContainText(/visible/i, { timeout: 10000 })

    await expectBlocksAsActualPlayer(browser, {
      visible: [visibleBlockText, conditionalBlockText],
      hidden: [],
    })
  })

  test('edit-level note access shows a locked visible block row and ignores hidden block default', async ({
    browser,
    page,
  }) => {
    await setPlayerNotePermission(PERMISSION_LEVEL.EDIT)
    await setBlockAllPlayersStatus(conditionalBlockNoteId, SHARE_STATUS.NOT_SHARED)
    await openCampaignNote(page)

    const menu = await openBlockShareMenu(page, conditionalBlockText)
    const playerRow = blockSharePlayerRow(menu, playerMemberId)
    await expect(playerRow).toHaveAttribute('data-share-kind', 'locked_visible', {
      timeout: 10000,
    })
    await expect(playerRow.getByTestId('block-share-locked-visible')).toContainText(/visible/i)

    const allPlayersSelect = blockShareAllPlayersRow(menu).getByRole('combobox')
    await setSelectValue(allPlayersSelect, /^hidden$/i)
    await expect(allPlayersSelect).toContainText(/hidden/i, { timeout: 10000 })

    await expectBlocksAsActualPlayer(browser, {
      visible: [visibleBlockText, conditionalBlockText],
      hidden: [],
    })
  })
})

async function openCampaignNote(page: Parameters<typeof openItem>[0]) {
  await page.goto('/campaigns', { waitUntil: 'commit' })
  await navigateToCampaign(page, campaignName)
  await openItem(page, noteName)
  await expect(getBlockTextLocator(page, visibleBlockText)).toBeVisible({ timeout: 10000 })
}

async function expectBlocksAsActualPlayer(
  browser: Browser,
  {
    visible,
    hidden,
  }: {
    visible: Array<string>
    hidden: Array<string>
  },
) {
  const context = await browser.newContext({ storageState: PLAYER_AUTH_STORAGE_PATH })
  const page = await context.newPage()
  try {
    await openPlayerNote(page)

    for (const blockText of visible) {
      await expect(getBlockTextLocator(page, blockText)).toBeVisible({ timeout: 30000 })
    }
    for (const blockText of hidden) {
      await expect(getBlockTextLocator(page, blockText)).not.toBeVisible({ timeout: 10000 })
    }
  } finally {
    await page.close()
    await context.close()
  }
}

async function openPlayerNote(page: Parameters<typeof typeInEditor>[0]) {
  const playerNoteUrl = `/campaigns/${dmUsername}/${campaignSlug}/editor?item=${noteSlug}`

  for (let attempt = 0; attempt < 2; attempt += 1) {
    await page.goto(playerNoteUrl, { waitUntil: 'commit' })
    if (
      await page
        .getByRole('button', { name: /^sign in$/i })
        .isVisible()
        .catch(() => false)
    ) {
      await signInByApi(page, E2E_PLAYER_EMAIL!, E2E_PLAYER_PASSWORD!)
      continue
    }

    if (
      await page
        .getByRole('region', { name: 'Editor workspace' })
        .isVisible({ timeout: 30000 })
        .catch(() => false)
    ) {
      return
    }
  }

  await expect(page.getByRole('region', { name: 'Editor workspace' })).toBeVisible({
    timeout: 30000,
  })
}

async function getPlayerMemberId() {
  return ensureAcceptedPlayerMember({ campaignId })
}

async function setPlayerNotePermission(permissionLevel: PermissionLevel) {
  const client = getConvexClient()
  await client.mutation(api.sidebarShares.mutations.setResourcesMemberPermission, {
    campaignId,
    sidebarItemIds: [noteId],
    campaignMemberId: playerMemberId,
    permissionLevel,
  })
}

async function setBlockAllPlayersStatus(blockNoteId: string, status: ShareStatus) {
  const client = getConvexClient()
  await client.action(api.blockShares.actions.setBlocksShareStatus, {
    campaignId,
    noteId,
    blockNoteIds: [blockNoteId],
    status,
  })
}

async function expectBlockAllPlayersStatus(blockNoteId: string, status: ShareStatus) {
  const client = getConvexClient()
  await expect
    .poll(
      async () => {
        const result = await client.query(api.blocks.queries.getBlocksWithShares, {
          campaignId,
          noteId,
          blockNoteIds: [blockNoteId],
        })
        return result.blocks[0]?.shareStatus ?? null
      },
      { timeout: 10000 },
    )
    .toBe(status)
}

async function setBlockMemberPermission(
  blockNoteId: string,
  permissionLevel: typeof PERMISSION_LEVEL.NONE | typeof PERMISSION_LEVEL.VIEW | null,
) {
  const client = getConvexClient()
  await client.action(api.blockShares.actions.setBlockMemberPermission, {
    campaignId,
    noteId,
    blockNoteIds: [blockNoteId],
    campaignMemberId: playerMemberId,
    permissionLevel,
  })
}

async function waitForPersistedBlockText(blockText: string) {
  const client = getConvexClient()
  let blockNoteId: string | null = null
  await expect
    .poll(
      async () => {
        try {
          const results = await client.query(api.blocks.queries.searchBlocks, {
            campaignId,
            query: blockText,
          })
          const result = results.find(
            (searchResult) =>
              searchResult.noteId === noteId && searchResult.plainText === blockText,
          )
          blockNoteId = result?.blockNoteId ?? null
          return Boolean(result)
        } catch {
          return false
        }
      },
      { timeout: 30000 },
    )
    .toBe(true)
  if (!blockNoteId) throw new Error(`Unable to find block id for ${blockText}`)
  return blockNoteId
}

function getConvexClient() {
  if (!convexClient) throw new Error('E2E Convex client was not initialized')
  return convexClient
}
