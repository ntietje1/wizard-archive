import { expect, test } from '@playwright/test'
import type { BrowserContext, Locator, Page } from '@playwright/test'
import { api } from 'convex/_generated/api'
import { generateDomainId, DOMAIN_ID_KIND } from '@wizard-archive/editor/resources/domain-id'
import type {
  CampaignId,
  CampaignMemberId,
  NoteBlockId,
  ResourceId,
} from '@wizard-archive/editor/resources/domain-id'
import { signInByApi } from './helpers/auth-helpers'
import {
  deleteCampaignById,
  navigateToCampaignResource,
  provisionCampaign,
} from './helpers/campaign-helpers'
import {
  createE2EConvexClient,
  ensureAcceptedPlayerMember,
  getCampaignInvitationRoute,
} from './helpers/convex-helpers'
import { provisionNoteResource } from './helpers/resource-helpers'
import { testName } from './helpers/constants'

const E2E_PLAYER_EMAIL = process.env.E2E_PLAYER_EMAIL
const E2E_PLAYER_PASSWORD = process.env.E2E_PLAYER_PASSWORD

test.skip(
  !E2E_PLAYER_EMAIL || !E2E_PLAYER_PASSWORD,
  'Requires E2E_PLAYER_EMAIL and E2E_PLAYER_PASSWORD env vars',
)

const campaignName = testName('E2E Canonical Sharing')
const sharedNoteTitle = `Block visibility ${Date.now()}`
const accessNoteTitle = `Resource access ${Date.now()}`
const visibleBlockText = `Visible passage ${Date.now()}`
const hiddenBlockText = `Hidden passage ${Date.now()}`
const accessSeedText = `Editable passage ${Date.now()}`
const playerEditText = `Player edit ${Date.now()}`

let campaignId: CampaignId
let sharedNoteId: ResourceId
let accessNoteId: ResourceId
let visibleBlockId: NoteBlockId
let hiddenBlockId: NoteBlockId
let playerMemberId: CampaignMemberId
let playerDisplayName: string
let playerUsername: string
let playerContext: BrowserContext
let playerPage: Page

test.describe.configure({ mode: 'serial', timeout: 120_000 })

test.describe('canonical sharing and view-as', () => {
  test.beforeAll(async ({ browser }) => {
    test.setTimeout(120_000)
    campaignId = await provisionCampaign(campaignName)
    visibleBlockId = generateDomainId(DOMAIN_ID_KIND.noteBlock)
    hiddenBlockId = generateDomainId(DOMAIN_ID_KIND.noteBlock)
    sharedNoteId = await provisionNoteResource(campaignId, sharedNoteTitle, [
      {
        id: visibleBlockId,
        type: 'paragraph',
        content: [{ type: 'text', text: visibleBlockText }],
      },
      {
        id: hiddenBlockId,
        type: 'paragraph',
        content: [{ type: 'text', text: hiddenBlockText }],
      },
    ])
    accessNoteId = await provisionNoteResource(campaignId, accessNoteTitle, [
      {
        id: generateDomainId(DOMAIN_ID_KIND.noteBlock),
        type: 'paragraph',
        content: [{ type: 'text', text: accessSeedText }],
      },
    ])

    const invitation = await getCampaignInvitationRoute(campaignId)
    playerContext = await browser.newContext()
    playerPage = await playerContext.newPage()
    await playerPage.goto('/sign-in', { waitUntil: 'commit' })
    await signInByApi(playerPage, E2E_PLAYER_EMAIL!, E2E_PLAYER_PASSWORD!)
    await playerPage.goto(`/join/${invitation.dmUsername}/${invitation.campaignSlug}`)
    const joinButton = playerPage.getByRole('button', { name: /join/i })
    await expect(joinButton).toBeVisible({ timeout: 10_000 })
    await joinButton.click()
    await expect(playerPage.getByText(/Request Sent|You're In!/i)).toBeVisible({
      timeout: 10_000,
    })
    playerMemberId = await ensureAcceptedPlayerMember({ campaignId })
    const client = await createE2EConvexClient()
    const members = await client.query(api.campaigns.queries.getMembersByCampaign, { campaignId })
    const player = members.find((member) => member.id === playerMemberId)
    if (!player) throw new Error('Accepted player is absent from the campaign projection')
    playerUsername = player.userProfile.username
    playerDisplayName = player.userProfile.name?.trim() || playerUsername
  })

  test.afterAll(async () => {
    await playerContext?.close()
    if (campaignId) await deleteCampaignById(campaignId)
  })

  test('round-trips all-player and member resource permissions', async ({ page }) => {
    const playerErrors: Array<Error> = []
    const recordPlayerError = (error: Error) => playerErrors.push(error)
    playerPage.on('pageerror', recordPlayerError)
    await openResource(page, accessNoteId)
    let dialog = await openResourceSharing(page)
    await setPermission(
      page,
      dialog.getByRole('combobox', { name: 'All Players permission' }),
      'View',
    )
    await setPermission(
      page,
      dialog.getByRole('combobox', { name: `${playerDisplayName} permission` }),
      'None',
    )
    await page.keyboard.press('Escape')

    await expectPlayerSidebarResource(accessNoteTitle, false)

    dialog = await openResourceSharing(page)
    await setPermission(
      page,
      dialog.getByRole('combobox', { name: `${playerDisplayName} permission` }),
      'Default',
    )
    await page.keyboard.press('Escape')

    const accessShareButton = await blockShareButton(page, accessSeedText, accessNoteTitle)
    await accessShareButton.click({ button: 'right' })
    const blockDialog = page.getByRole('dialog', { name: /share (?:\d+ )?blocks?/i })
    await blockDialog.getByRole('button', { name: 'Share with all players' }).click()
    await expect(blockDialog).not.toBeVisible()

    await expectPlayerSidebarResource(accessNoteTitle, true)
    await navigatePlayerToCampaign(playerPage, accessNoteId)
    const playerSidebarResource = playerPage
      .getByRole('navigation', { name: 'Sidebar' })
      .getByRole('button', { name: accessNoteTitle, exact: true })
    const playerEditor = playerPage.getByRole('textbox', {
      name: `${accessNoteTitle} note editor`,
    })
    await expect(playerEditor).toBeVisible({ timeout: 10_000 })
    await expect(playerEditor).toHaveAttribute('contenteditable', 'false')
    await expect(playerEditor.getByText(accessSeedText, { exact: true })).toBeVisible()

    dialog = await openResourceSharing(page)
    await setPermission(
      page,
      dialog.getByRole('combobox', { name: 'All Players permission' }),
      'Edit',
    )
    await page.keyboard.press('Escape')
    await expect(playerEditor).toHaveAttribute('contenteditable', 'true', { timeout: 10_000 })
    expect(playerErrors.map((error) => error.message)).toEqual([])
    await playerEditor.getByText(accessSeedText, { exact: true }).click()
    await playerPage.keyboard.press('End')
    await playerPage.keyboard.type(` ${playerEditText}`)
    await expect(playerEditor).toContainText(`${accessSeedText} ${playerEditText}`)
    await playerEditor.blur()
    await expect(
      page.getByRole('textbox', { name: `${accessNoteTitle} note editor` }),
    ).toContainText(`${accessSeedText} ${playerEditText}`, { timeout: 10_000 })

    dialog = await openResourceSharing(page)
    await setPermission(
      page,
      dialog.getByRole('combobox', { name: 'All Players permission' }),
      'View',
    )
    await page.keyboard.press('Escape')
    await expect(playerEditor).toHaveAttribute('contenteditable', 'false', { timeout: 10_000 })
    await expect(playerEditor).toContainText(`${accessSeedText} ${playerEditText}`)
    expect(playerErrors.map((error) => error.message)).toEqual([])

    dialog = await openResourceSharing(page)
    await setPermission(
      page,
      dialog.getByRole('combobox', { name: 'All Players permission' }),
      'Edit',
    )
    await page.keyboard.press('Escape')
    await expect(playerEditor).toHaveAttribute('contenteditable', 'true', { timeout: 10_000 })
    await expect(playerEditor).toContainText(`${accessSeedText} ${playerEditText}`)
    await expect(
      page.getByRole('textbox', { name: `${accessNoteTitle} note editor` }),
    ).toContainText(`${accessSeedText} ${playerEditText}`, { timeout: 10_000 })
    expect(playerErrors.map((error) => error.message)).toEqual([])

    dialog = await openResourceSharing(page)
    await setPermission(
      page,
      dialog.getByRole('combobox', { name: 'All Players permission' }),
      'View',
    )
    await page.keyboard.press('Escape')
    await expect(playerEditor).toHaveAttribute('contenteditable', 'false', { timeout: 10_000 })
    await navigatePlayerToCampaign(playerPage, accessNoteId)
    await expect(playerEditor).toContainText(`${accessSeedText} ${playerEditText}`)
    await expect(playerSidebarResource).toBeVisible({ timeout: 10_000 })
    expect(playerErrors.map((error) => error.message)).toEqual([])

    dialog = await openResourceSharing(page)
    await setPermission(
      page,
      dialog.getByRole('combobox', { name: 'All Players permission' }),
      'None',
    )
    await page.keyboard.press('Escape')
    await expect(playerSidebarResource).not.toBeVisible({ timeout: 10_000 })
    await expect(playerEditor).not.toBeVisible({ timeout: 10_000 })
    expect(playerErrors.map((error) => error.message)).toEqual([])
    playerPage.off('pageerror', recordPlayerError)
  })

  test('keeps block visibility subordinate to note access and projects only visible blocks', async ({
    page,
  }) => {
    await openResource(page, sharedNoteId)
    let dialog = await openBlockSharing(page, visibleBlockText)
    await setPermission(
      page,
      permissionRow(dialog, playerDisplayName).getByRole('combobox'),
      'Visible',
    )
    await expect(dialog.getByText('This player cannot open the note.')).toBeVisible()

    await expectPlayerSidebarResource(sharedNoteTitle, false)

    await dialog.getByRole('button', { name: 'Share note' }).click()
    await expect(dialog.getByText('This player cannot open the note.')).not.toBeVisible({
      timeout: 10_000,
    })
    await page.keyboard.press('Escape')

    await expectPlayerNote({
      visible: [visibleBlockText],
      hidden: [hiddenBlockText],
    })

    const shareButton = await blockShareButton(page, hiddenBlockText)
    await shareButton.click({ button: 'right' })
    dialog = page.getByRole('dialog', { name: /share (?:\d+ )?blocks?/i })
    await expect(dialog.getByRole('button', { name: 'Share with all players' })).toBeVisible()
    await dialog.getByRole('button', { name: 'Share with all players' }).click()
    await expect(dialog).not.toBeVisible()

    await expectPlayerNote({
      visible: [visibleBlockText, hiddenBlockText],
      hidden: [],
    })

    const sharedButton = await blockShareButton(page, hiddenBlockText)
    await sharedButton.click({ modifiers: ['Shift'] })
    await expect(page.getByTestId('block-share-menu')).not.toBeVisible()

    await expectPlayerNote({
      visible: [visibleBlockText],
      hidden: [hiddenBlockText],
    })
  })

  test('DM view-as matches the player projection and remains readonly', async ({ page }) => {
    const pageErrors: Array<Error> = []
    page.on('pageerror', (error) => pageErrors.push(error))
    await openResource(page, sharedNoteId)
    await page.getByRole('button', { name: 'View as player' }).click()
    const playerItem = page
      .getByRole('menuitemcheckbox')
      .filter({ hasText: new RegExp(escapeRegExp(playerUsername), 'i') })
    await expect(playerItem).toBeVisible()
    await playerItem.click()
    await expect(
      page.getByRole('status').filter({ hasText: `Viewing as ${playerDisplayName}` }),
    ).toBeVisible({ timeout: 10_000 })
    await page.keyboard.press('Escape')

    const sidebar = page.getByRole('navigation', { name: 'Sidebar' })
    await expect(sidebar.getByRole('button', { name: sharedNoteTitle, exact: true })).toBeVisible()
    await expect(
      sidebar.getByRole('button', { name: accessNoteTitle, exact: true }),
    ).not.toBeVisible()

    const editor = page.getByRole('textbox', { name: `${sharedNoteTitle} note editor` })
    await expect(editor.getByText(visibleBlockText, { exact: true })).toBeVisible()
    await expect(editor.getByText(hiddenBlockText, { exact: true })).not.toBeVisible()
    await expect(editor).toHaveAttribute('contenteditable', 'false')
    await expect(page.getByRole('toolbar', { name: 'Note formatting toolbar' })).not.toBeVisible()
    await expect(page.getByRole('button', { name: /^(?:Private|Shared)$/ })).not.toBeVisible()
    expect(pageErrors.map((error) => error.message)).toEqual([])

    const exit = page.getByRole('button', { name: 'Exit' })
    await exit.focus()
    await page.keyboard.press('Enter')
    await expect(page.getByRole('status').filter({ hasText: 'Viewing as' })).not.toBeVisible()
    await expect(sidebar.getByRole('button', { name: accessNoteTitle, exact: true })).toBeVisible()
    expect(pageErrors.map((error) => error.message)).toEqual([])
  })
})

async function openResource(page: Page, resourceId: ResourceId) {
  await navigateToCampaignResource(page, campaignId, resourceId)
  await expect(page.getByRole('region', { name: 'Editor workspace' })).toHaveAttribute(
    'aria-busy',
    'false',
  )
}

async function openResourceSharing(page: Page) {
  await page.getByRole('button', { name: /^(?:Private|Shared)$/ }).click()
  const dialog = page.getByRole('dialog', { name: /^Share / })
  await expect(dialog.getByText(/^(?:All|Other) Players$/, { exact: true })).toBeVisible()
  const player = dialog.getByText(playerDisplayName, { exact: true })
  if (!(await player.isVisible().catch(() => false))) {
    await dialog.getByRole('button', { name: /Players$/ }).click()
  }
  await expect(player).toBeVisible()
  return dialog
}

async function openBlockSharing(page: Page, blockText: string, noteTitle = sharedNoteTitle) {
  const shareButton = await blockShareButton(page, blockText, noteTitle)
  await shareButton.click()
  const dialog = page.getByRole('dialog', { name: /share (?:\d+ )?blocks?/i })
  await expect(dialog.getByText('All players', { exact: true })).toBeVisible()
  await expect(dialog.getByText(playerDisplayName, { exact: true })).toBeVisible()
  return dialog
}

async function blockShareButton(page: Page, blockText: string, noteTitle = sharedNoteTitle) {
  const editor = page.getByRole('textbox', { name: `${noteTitle} note editor` })
  const block = editor
    .locator('[data-node-type="blockContainer"]')
    .filter({ hasText: blockText })
    .first()
  await expect(block).toBeVisible()
  await block.hover()
  const shareButton = page.getByTestId('block-share-button')
  await expect(shareButton).toBeVisible()
  return shareButton
}

function permissionRow(dialog: Locator, label: string) {
  return dialog.getByText(label, { exact: true }).locator('..').locator('..')
}

async function setPermission(page: Page, select: Locator, permission: string) {
  await select.click()
  const optionName =
    permission === 'Default'
      ? /^Default(?:\s|\()/i
      : new RegExp(`^${escapeRegExp(permission)}$`, 'i')
  await page.getByRole('option', { name: optionName }).click()
  if (permission === 'Default') {
    await expect(select).toBeEnabled({ timeout: 10_000 })
  } else {
    await expect(select).toContainText(new RegExp(permission, 'i'), { timeout: 10_000 })
  }
}

async function expectPlayerSidebarResource(title: string, visible: boolean) {
  await navigatePlayerToCampaign(playerPage)
  const resource = playerPage
    .getByRole('navigation', { name: 'Sidebar' })
    .getByRole('button', { name: title, exact: true })
  if (visible) {
    await expect(resource).toBeVisible({ timeout: 10_000 })
  } else {
    await expect(resource).not.toBeVisible()
  }
}

async function expectPlayerNote(blocks: { visible: Array<string>; hidden: Array<string> }) {
  const editor = await openPlayerNote(playerPage)
  await expect(editor).toHaveAttribute('contenteditable', 'false')
  for (const text of blocks.visible) {
    await expect(editor.getByText(text, { exact: true })).toBeVisible({ timeout: 10_000 })
  }
  for (const text of blocks.hidden) {
    await expect(editor.getByText(text, { exact: true })).not.toBeVisible()
  }
}

async function openPlayerNote(page: Page) {
  const editor = page.getByRole('textbox', { name: `${sharedNoteTitle} note editor` })
  for (let attempt = 0; attempt < 2; attempt += 1) {
    await navigatePlayerToCampaign(page, sharedNoteId)
    if (
      await editor
        .waitFor({ state: 'visible', timeout: 10_000 })
        .then(() => true)
        .catch(() => false)
    ) {
      return editor
    }
  }
  await expect(editor).toBeVisible({ timeout: 10_000 })
  return editor
}

async function navigatePlayerToCampaign(page: Page, resourceId?: ResourceId) {
  const search = resourceId ? `?resource=${resourceId}` : ''
  await page.goto(`/campaigns/${campaignId}/editor${search}`, { waitUntil: 'commit' })
  const workspace = page.getByRole('region', { name: 'Editor workspace' })
  await expect(workspace).toBeVisible({ timeout: 30_000 })
  await expect(workspace).toHaveAttribute('aria-busy', 'false', { timeout: 30_000 })
  const failure = workspace.getByRole('alert')
  if (await failure.isVisible().catch(() => false)) {
    throw new Error((await failure.textContent()) ?? 'Player workspace failed to load')
  }
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
