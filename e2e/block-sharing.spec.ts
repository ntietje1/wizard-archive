import { expect, test } from '@playwright/test'
import { api } from 'convex/_generated/api'
import { SHARE_STATUS } from 'shared/editor-blocks/share-status'
import { PERMISSION_LEVEL } from 'shared/permissions/types'
import { createCampaign, deleteCampaign, navigateToCampaign } from './helpers/campaign-helpers'
import { createNote, openItem } from './helpers/sidebar-helpers'
import { typeInEditor } from './helpers/editor-helpers'
import {
  approvePlayerRequest,
  blockShareAllPlayersRow,
  blockSharePlayerRow,
  getCampaignRouteParts,
  openBlockShareMenu,
  openBlockShareMenuWithKeyboard,
  requestToJoinCampaignAsPlayer,
  setSelectValue,
} from './helpers/permission-helpers'
import {
  createE2EConvexClient,
  getCampaignIdFromRoute,
  getSidebarItemIdBySlug,
} from './helpers/convex-helpers'
import { AUTH_STORAGE_PATH, testName } from './helpers/constants'
import type { Browser } from '@playwright/test'
import type { Id } from 'convex/_generated/dataModel'
import type { ShareStatus } from 'shared/editor-blocks/share-status'
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

let campaignId: Id<'campaigns'>
let noteId: Id<'sidebarItems'>
let playerMemberId: Id<'campaignMembers'>
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
    await page.goto('/campaigns')
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
    await expect(page.getByText(conditionalBlockText, { exact: true })).toBeVisible({
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
    await dmPage.goto('/campaigns')
    await navigateToCampaign(dmPage, campaignName)
    await approvePlayerRequest(dmPage, E2E_PLAYER_EMAIL!)
    await dmPage.close()
    await dmContext.close()

    playerMemberId = await getPlayerMemberId(E2E_PLAYER_EMAIL!)
  })

  test.afterAll(async ({ browser }) => {
    const context = await browser.newContext({
      storageState: AUTH_STORAGE_PATH,
    })
    const page = await context.newPage()
    await page.goto('/campaigns')
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
  await page.goto('/campaigns')
  await navigateToCampaign(page, campaignName)
  await openItem(page, noteName)
  await expect(page.getByText(visibleBlockText, { exact: true })).toBeVisible({ timeout: 10000 })
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
  await page.goto(`/campaigns/${dmUsername}/${campaignSlug}/editor?item=${noteSlug}`)

  for (const blockText of visible) {
    await expect(page.getByText(blockText, { exact: true })).toBeVisible({ timeout: 10000 })
  }
  for (const blockText of hidden) {
    await expect(page.getByText(blockText, { exact: true })).not.toBeVisible({ timeout: 10000 })
  }

  await page.close()
  await context.close()
}

async function getPlayerMemberId(playerEmail: string) {
  const client = getConvexClient()
  const members = await client.query(api.campaigns.queries.getMembersByCampaign, { campaignId })
  const player = members.find(
    (member) => member.userProfile.email?.toLowerCase() === playerEmail.toLowerCase(),
  )
  if (!player) {
    throw new Error(`Unable to find campaign member for ${playerEmail}`)
  }
  return player._id
}

async function setPlayerNotePermission(permissionLevel: PermissionLevel) {
  const client = getConvexClient()
  await client.mutation(api.sidebarShares.mutations.setSidebarItemsMemberPermission, {
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
