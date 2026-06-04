import { expect } from '@playwright/test'
import { signInByApi } from './auth-helpers'
import type { Browser, Locator, Page } from '@playwright/test'

export async function openShareMenu(page: Page) {
  await page.getByRole('button', { name: /private|shared/i }).click()
  await expect(page.getByTestId('share-all-players-row')).toBeVisible({
    timeout: 5000,
  })
}

export async function openSettingsPeopleTab(page: Page) {
  const userMenuBtn = page.getByRole('button', { name: 'User menu' })
  await expect(userMenuBtn).toBeVisible({ timeout: 5000 })

  let settingsOpened = false
  for (let attempt = 0; attempt < 3; attempt++) {
    await userMenuBtn.click()
    const settingsButton = page.getByRole('button', { name: /^settings$/i })
    try {
      await settingsButton.click({ timeout: 5000 })
      settingsOpened = true
      break
    } catch {
      await page.keyboard.press('Escape')
      await expect(settingsButton).not.toBeVisible({ timeout: 5000 })
    }
  }
  if (!settingsOpened) {
    throw new Error('Unable to open settings after 3 attempts')
  }

  const dialog = page.getByRole('dialog')
  await expect(dialog).toBeVisible({ timeout: 10000 })
  await dialog.getByRole('button', { name: /people/i }).click()
  await expect(dialog.getByText(/members/i).first()).toBeVisible({
    timeout: 5000,
  })
  return dialog
}

export function getCampaignRouteParts(page: Page) {
  const match = page.url().match(/\/campaigns\/([^/]+)\/([^/?]+)/)
  if (!match) {
    throw new Error(`Unexpected campaign URL format: ${page.url()}`)
  }
  const [, dmUsername, campaignSlug] = match
  return { dmUsername, campaignSlug }
}

export async function requestToJoinCampaignAsPlayer({
  browser,
  dmUsername,
  campaignSlug,
  email,
  password,
  storageStatePath,
}: {
  browser: Browser
  dmUsername: string
  campaignSlug: string
  email: string
  password: string
  storageStatePath?: string
}) {
  const playerContext = await browser.newContext()
  const playerPage = await playerContext.newPage()
  try {
    await playerPage.goto('/sign-in', { waitUntil: 'load' })
    await expect(playerPage.getByLabel('Email', { exact: true })).toBeVisible({ timeout: 30000 })
    await signInByApi(playerPage, email, password)
    await playerPage.waitForURL('**/campaigns', { timeout: 30000 })
    if (storageStatePath) {
      await playerContext.storageState({ path: storageStatePath })
    }
    await playerPage.goto(`/join/${dmUsername}/${campaignSlug}`)
    const joinButton = playerPage.getByRole('button', { name: /join/i })
    const hasJoinButton = await joinButton
      .waitFor({ state: 'visible', timeout: 30000 })
      .then(() => true)
      .catch(() => false)
    if (hasJoinButton) {
      await joinButton.click()
    }
    await expect(playerPage.getByText(/Request Sent|You're In!/i)).toBeVisible({
      timeout: 30000,
    })
  } finally {
    await playerPage.close()
    await playerContext.close()
  }
}

export async function approvePlayerRequest(page: Page, playerEmail: string) {
  const dialog = await openSettingsPeopleTab(page)
  const playerRow = dialog.locator('div').filter({
    hasText: new RegExp(escapeRegExp(playerEmail), 'i'),
  })
  const approveButton = playerRow.getByRole('button', {
    name: /approve|accept/i,
  })
  const hasApprove = await approveButton
    .waitFor({ state: 'visible', timeout: 5000 })
    .then(() => true)
    .catch(() => false)
  if (hasApprove) {
    await approveButton.click()
  }
  await expect(playerRow.first()).toBeVisible({ timeout: 10000 })
  await page.keyboard.press('Escape')
  await expect(dialog).not.toBeVisible({ timeout: 10000 })
}

export async function openBlockShareMenu(page: Page, blockText: string) {
  const menu = page.getByTestId('block-share-menu')

  for (let attempt = 0; attempt < 3; attempt++) {
    const shareButton = await getVisibleBlockShareButton(page, blockText)
    const box = await shareButton.boundingBox()
    if (!box) {
      continue
    }
    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2)
    if (await menu.isVisible({ timeout: 1500 }).catch(() => false)) {
      break
    }
  }

  if (!(await menu.isVisible({ timeout: 500 }).catch(() => false))) {
    const shareButton = await getVisibleBlockShareButton(page, blockText)
    await shareButton.focus()
    await page.keyboard.press('Shift+F10')
  }

  await expectBlockShareMenuOpen(menu, /share \d+ blocks?/i)
  return menu
}

export async function openBlockShareMenuWithKeyboard(page: Page, blockText: string) {
  const menu = page.getByTestId('block-share-menu')
  const shareButton = await getVisibleBlockShareButton(page, blockText)

  await shareButton.focus()
  await page.keyboard.press('Shift+F10')

  await expectBlockShareMenuOpen(menu, /share \d+ blocks?/i)
  return menu
}

export async function shiftClickBlockShareButton(page: Page, blockText: string) {
  const shareButton = await getVisibleBlockShareButton(page, blockText)

  await page.keyboard.down('Shift')
  try {
    await shareButton.click()
  } finally {
    await page.keyboard.up('Shift')
  }
}

export async function openEditorContextMenuFromBlockShareButton(page: Page, blockText: string) {
  const shareButton = await getVisibleBlockShareButton(page, blockText)

  await shareButton.click({ button: 'right' })
  await expect(page.getByTestId('block-share-menu')).not.toBeVisible()
  await expect(page.getByRole('menuitem', { name: /^share 1 block$/i })).toBeVisible({
    timeout: 5000,
  })
}

async function getVisibleBlockShareButton(page: Page, blockText: string) {
  const block = getBlockTextLocator(page, blockText)
  const shareButton = page.getByTestId('block-share-button')

  await block.hover()
  await expect(shareButton).toBeVisible({ timeout: 5000 })
  return shareButton
}

export async function openBlockShareMenuFromEditorContextMenu(page: Page, blockText: string) {
  const menu = page.getByTestId('block-share-menu')
  const block = getBlockTextLocator(page, blockText)

  await block.click({ button: 'right' })
  await page.getByRole('menuitem', { name: /^share 1 block$/i }).click()

  await expectBlockShareMenuOpen(menu, /^share 1 block$/i)
  return menu
}

export async function rightMouseDownOnBlockText(page: Page, blockText: string) {
  const box = await getBlockTextBox(page, blockText)

  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
  await page.mouse.down({ button: 'right' })
}

export function blockShareAllPlayersRow(menu: Locator) {
  return menu.getByTestId('block-share-all-players-row')
}

export function blockSharePlayerRow(menu: Locator, memberId: string) {
  return menu.locator(`[data-testid="block-share-player-row"][data-member-id="${memberId}"]`)
}

export async function setSelectValue(selectTrigger: Locator, optionName: RegExp) {
  await selectTrigger.click()
  await selectTrigger.page().getByRole('option', { name: optionName }).first().click()
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function getBlockTextLocator(page: Page, blockText: string) {
  return page.getByText(blockText, { exact: true })
}

async function getBlockTextBox(page: Page, blockText: string) {
  const block = getBlockTextLocator(page, blockText)
  await expect(block).toBeVisible({ timeout: 5000 })
  const box = await block.boundingBox()
  if (!box) {
    throw new Error(`Unable to locate block text "${blockText}"`)
  }
  return box
}

async function expectBlockShareMenuOpen(menu: Locator, title: RegExp) {
  await expect(menu).toBeVisible({ timeout: 5000 })
  await expect(menu.getByText(title)).toBeVisible({ timeout: 5000 })
  await expect(blockShareAllPlayersRow(menu)).toBeVisible({ timeout: 5000 })
}
