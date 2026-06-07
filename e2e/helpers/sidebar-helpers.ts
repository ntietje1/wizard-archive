import { expect } from '@playwright/test'
import type { Locator, Page } from '@playwright/test'
import { getBrowserPrimaryModifier } from './keyboard-helpers'

export const SIDEBAR_WAIT_TIMEOUT = 15000
const MAX_UNTITLED_TRASH_ATTEMPTS = 5

export function sidebarNavigation(page: Page) {
  return page.getByRole('navigation', { name: 'Sidebar' })
}

export function sidebarLink(page: Page, name: string) {
  return sidebarNavigation(page).getByRole('link', { name, exact: true })
}

export function selectableSidebarRow(page: Page, name: string) {
  return sidebarNavigation(page).getByTestId(`selectable-row-${name}`).first()
}

export function folderContents(page: Page, folderName: string) {
  return page.getByRole('region', { name: `${folderName} folder contents` })
}

export function folderItemLink(page: Page, folderName: string, itemName: string) {
  return folderContents(page, folderName).getByRole('link', { name: itemName, exact: true })
}

async function expectNameEditSettled(textbox: Locator) {
  await expect
    .poll(
      async () => (await textbox.getAttribute('readonly')) === '' || (await textbox.isDisabled()),
      { timeout: SIDEBAR_WAIT_TIMEOUT },
    )
    .toBe(true)
}

async function startNameEdit(textbox: Locator) {
  await expect(textbox).toBeEnabled({ timeout: 10000 })
  await textbox.click()
  await expect
    .poll(
      async () =>
        await textbox.evaluate((element) => {
          const input = element as HTMLInputElement
          return !input.readOnly && !input.disabled
        }),
      { timeout: SIDEBAR_WAIT_TIMEOUT },
    )
    .toBe(true)
}

export async function renameCurrentItem(page: Page, name: string) {
  const textbox = page.getByRole('textbox', { name: 'Item name' })
  await expect(textbox).toHaveValue(/untitled/i, { timeout: 10000 })
  await startNameEdit(textbox)
  await textbox.fill(name)
  await expect(textbox).toHaveValue(name)
  await textbox.press('Enter')
  await expectNameEditSettled(textbox)
}

export async function renameOpenedItem(page: Page, name: string) {
  const textbox = page.getByRole('textbox', { name: 'Item name' })
  await expect(textbox).toBeVisible({ timeout: 10000 })
  await startNameEdit(textbox)
  await textbox.fill(name)
  await expect(textbox).toHaveValue(name)
  await textbox.press('Enter')
  await expectNameEditSettled(textbox)
  await expect(sidebarLink(page, name)).toBeVisible({ timeout: SIDEBAR_WAIT_TIMEOUT })
}

export async function createNote(page: Page, name: string) {
  const prevUrl = page.url()
  await page.getByRole('button', { name: 'Create new note' }).click()
  try {
    await expect(page).not.toHaveURL(prevUrl, { timeout: 5000 })
  } catch {
    // Fallbacks cover an already-open untitled note, the New-page type picker,
    // and stale untitled rows left by prior interrupted E2E attempts.
    const nameInput = page.getByRole('textbox', { name: 'Item name' })
    if (
      await nameInput
        .evaluate((element) => /^untitled note/i.test((element as HTMLInputElement).value))
        .catch(() => false)
    ) {
      await renameCurrentItem(page, name)
      await expect(sidebarLink(page, name)).toBeVisible({
        timeout: SIDEBAR_WAIT_TIMEOUT,
      })
      return
    }
    const noteCard = page.getByRole('button', { name: /^Note / })
    if (await noteCard.isVisible().catch(() => false)) {
      await noteCard.click()
      await expect(page).not.toHaveURL(prevUrl, { timeout: 10000 })
    } else {
      await trashUntitledNotes(page)
      const retryUrl = page.url()
      await page.getByRole('button', { name: 'Create new note' }).click()
      await expect(page).not.toHaveURL(retryUrl, { timeout: 10000 })
    }
  }
  await renameCurrentItem(page, name)
  await expect(sidebarLink(page, name)).toBeVisible({
    timeout: SIDEBAR_WAIT_TIMEOUT,
  })
  await waitForFilesystemIdle(page)
}

export async function createFolder(page: Page, name: string) {
  const sidebar = sidebarNavigation(page)
  await sidebar.getByRole('link', { name: 'New' }).click()
  const prevUrl = page.url()
  await page.getByRole('button', { name: /^Folder / }).click()
  await expect(page).not.toHaveURL(prevUrl, { timeout: 10000 })
  await renameCurrentItem(page, name)
  await expect(sidebarLink(page, name)).toBeVisible({
    timeout: SIDEBAR_WAIT_TIMEOUT,
  })
  await waitForFilesystemIdle(page)
}

export async function openItem(page: Page, name: string) {
  if (
    await folderContents(page, name)
      .isVisible()
      .catch(() => false)
  )
    return

  const itemName = page.getByRole('textbox', { name: 'Item name' })
  if ((await itemName.inputValue().catch(() => null)) === name) return

  await sidebarLink(page, name).click({ timeout: 5000 })
  await expect
    .poll(
      async () =>
        (await itemName.inputValue().catch(() => null)) === name ||
        (await folderContents(page, name)
          .isVisible()
          .catch(() => false)),
      { timeout: SIDEBAR_WAIT_TIMEOUT },
    )
    .toBe(true)
}

export async function openContextMenu(page: Page, itemName: string) {
  await sidebarLink(page, itemName).click({ button: 'right', timeout: 5000 })
  await expect(page.getByRole('menu')).toBeVisible({ timeout: 5000 })
}

export async function openFolderContextMenu(page: Page, folderName: string, itemName: string) {
  await folderItemLink(page, folderName, itemName).click({ button: 'right' })
  await expect(page.getByRole('menu')).toBeVisible({ timeout: 5000 })
}

export async function selectSidebarItems(page: Page, names: Array<string>) {
  const modifier = await getBrowserPrimaryModifier(page)
  for (const [index, name] of names.entries()) {
    const options =
      index === 0
        ? ({ timeout: 5000 } satisfies Parameters<Locator['click']>[0])
        : ({ modifiers: [modifier], timeout: 5000 } satisfies Parameters<Locator['click']>[0])
    await clickUntilSelected(page, name, options)
  }
  await sidebarNavigation(page).locator('[data-item-surface-hotkey-target="true"]').first().focus()
}

async function clickUntilSelected(
  page: Page,
  name: string,
  options: Parameters<Locator['click']>[0],
) {
  const row = selectableSidebarRow(page, name)
  for (let attempt = 0; attempt < 3; attempt += 1) {
    if ((await row.getAttribute('data-selected').catch(() => null)) === 'true') return
    await clickSidebarSelectionTarget(page, name, options, attempt)
    try {
      await expect(row).toHaveAttribute('data-selected', 'true', { timeout: 2500 })
      return
    } catch {
      // Retry the same visible user action; under load the first click can be lost to navigation.
    }
  }
  await expectSelected(page, name)
}

async function clickSidebarSelectionTarget(
  page: Page,
  name: string,
  options: Parameters<Locator['click']>[0],
  attempt: number,
) {
  try {
    if (attempt === 0) {
      await sidebarLink(page, name).click(options)
      return
    }
    await clickSidebarLinkByCoordinates(page, name, options?.modifiers ?? [])
  } catch {
    if (attempt >= 2) throw new Error(`Unable to click sidebar item "${name}"`)
  }
}

async function clickSidebarLinkByCoordinates(
  page: Page,
  name: string,
  modifiers: NonNullable<Parameters<Locator['click']>[0]>['modifiers'],
) {
  const box = await sidebarLink(page, name).boundingBox()
  if (!box) throw new Error(`Unable to resolve sidebar link bounds for "${name}"`)
  for (const modifier of modifiers ?? []) await page.keyboard.down(modifier)
  try {
    await page.mouse.click(box.x + Math.min(24, box.width / 2), box.y + box.height / 2)
  } finally {
    for (const modifier of modifiers ?? []) await page.keyboard.up(modifier)
  }
}

export async function dragSidebarItemToSidebarItem(
  page: Page,
  sourceName: string,
  targetName: string,
  options: { modifier?: 'ControlOrMeta' } = {},
) {
  const source = selectableSidebarRow(page, sourceName)
  const target = selectableSidebarRow(page, targetName)
  await expect(source).toBeVisible({ timeout: SIDEBAR_WAIT_TIMEOUT })
  await expect(target).toBeVisible({ timeout: SIDEBAR_WAIT_TIMEOUT })
  const sourceBox = await source.boundingBox()
  const targetBox = await target.boundingBox()
  if (!sourceBox || !targetBox) {
    throw new Error('Unable to resolve sidebar drag bounds')
  }

  const modifier = options.modifier ? await getBrowserPrimaryModifier(page) : null
  if (modifier) await page.keyboard.down(modifier)
  try {
    await source.dragTo(target, {
      sourcePosition: {
        x: Math.min(24, sourceBox.width / 2),
        y: sourceBox.height / 2,
      },
      targetPosition: {
        x: Math.min(24, targetBox.width / 2),
        y: targetBox.height / 2,
      },
    })
  } finally {
    if (modifier) await page.keyboard.up(modifier)
  }
}

export async function trashUntitledNotes(page: Page) {
  const untitledLinks = sidebarNavigation(page).getByRole('link', { name: /^Untitled Note/ })
  const untitledRows = sidebarNavigation(page).getByRole('option', { name: /^Untitled Note/ })
  for (let index = 0; index < MAX_UNTITLED_TRASH_ATTEMPTS; index += 1) {
    const count = await untitledLinks.count()
    if (count === 0) return
    const row = untitledRows.first()
    await row.hover()
    await row.getByRole('button', { name: 'More options' }).click()
    await page.getByRole('menuitem', { name: 'Move to Trash' }).click()
    await expect.poll(async () => await untitledLinks.count()).toBeLessThan(count)
  }
}

export async function expectSidebarItemVisible(page: Page, name: string) {
  await expect(sidebarLink(page, name)).toBeVisible({ timeout: SIDEBAR_WAIT_TIMEOUT })
}

export async function expectSidebarItemHidden(page: Page, name: string) {
  await expect(sidebarLink(page, name)).not.toBeVisible({ timeout: SIDEBAR_WAIT_TIMEOUT })
}

export async function expectFolderItemVisible(page: Page, folderName: string, itemName: string) {
  await expect(folderItemLink(page, folderName, itemName)).toBeVisible({
    timeout: SIDEBAR_WAIT_TIMEOUT,
  })
}

export async function expectFolderItemHidden(page: Page, folderName: string, itemName: string) {
  await expect(folderItemLink(page, folderName, itemName)).not.toBeVisible({
    timeout: SIDEBAR_WAIT_TIMEOUT,
  })
}

export async function focusFolderContents(page: Page, folderName: string) {
  const contents = folderContents(page, folderName)
  await expect(contents).toBeVisible({ timeout: SIDEBAR_WAIT_TIMEOUT })
  await contents.focus()
}

export async function expectSelected(page: Page, name: string) {
  await expect(selectableSidebarRow(page, name)).toHaveAttribute('data-selected', 'true', {
    timeout: SIDEBAR_WAIT_TIMEOUT,
  })
}

export async function waitForFilesystemIdle(page: Page) {
  await expect(page.getByTestId('filesystem-operation-status')).toHaveAttribute(
    'data-state',
    'idle',
    { timeout: SIDEBAR_WAIT_TIMEOUT },
  )
}

export async function openTrashPopover(page: Page) {
  await page.getByRole('button', { name: /^trash/i }).click()
}

export function trashItem(page: Page, name: string): Locator {
  return page.getByTestId(`trash-item-${name}`)
}

export async function expectTrashItemVisible(page: Page, name: string) {
  await expect(trashItem(page, name)).toBeVisible({ timeout: SIDEBAR_WAIT_TIMEOUT })
}

export async function expectTrashItemHidden(page: Page, name: string) {
  await expect(trashItem(page, name)).not.toBeVisible({ timeout: SIDEBAR_WAIT_TIMEOUT })
}

export async function restoreTrashItem(page: Page, name: string) {
  const item = trashItem(page, name)
  await expect(item).toBeVisible({ timeout: SIDEBAR_WAIT_TIMEOUT })
  await item.hover()
  await item.getByRole('button', { name: /restore/i }).click()
}

export async function permanentlyDeleteTrashItem(page: Page, name: string) {
  const item = trashItem(page, name)
  await expect(item).toBeVisible({ timeout: SIDEBAR_WAIT_TIMEOUT })
  await item.hover()
  await item.getByRole('button', { name: 'Delete forever' }).click()
  const confirmDialog = page.getByRole('dialog', { name: /permanently delete/i })
  await confirmDialog.getByRole('button', { name: /delete forever/i }).click()
  await expect(confirmDialog).not.toBeVisible({ timeout: SIDEBAR_WAIT_TIMEOUT })
}
