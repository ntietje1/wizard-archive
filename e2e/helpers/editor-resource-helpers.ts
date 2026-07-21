import { expect } from '@playwright/test'
import type { Page } from '@playwright/test'

const DEFAULT_RESOURCE_TITLES = {
  Canvas: 'Untitled canvas',
  File: 'Untitled file',
  Folder: 'Untitled folder',
  Map: 'Untitled map',
  Note: 'Untitled note',
} as const

export function sidebarResource(page: Page, title: string) {
  return page
    .getByRole('navigation', { name: 'Sidebar' })
    .getByRole('button', { name: title, exact: true })
}

export async function createNamedResource(
  page: Page,
  kind: keyof typeof DEFAULT_RESOURCE_TITLES,
  title: string,
) {
  await page.getByRole('button', { name: 'Create resource', exact: true }).click()
  await page.getByRole('menuitem', { name: kind, exact: true }).click()
  await renameCurrentResource(page, DEFAULT_RESOURCE_TITLES[kind], title)
  return sidebarResource(page, title)
}

export async function renameCurrentResource(page: Page, currentTitle: string, nextTitle: string) {
  const heading = page.getByRole('heading', { name: currentTitle, exact: true })
  await expect(heading).toBeVisible({ timeout: 15_000 })
  await heading.getByRole('button', { name: currentTitle, exact: true }).click()
  const input = page.getByRole('textbox', { name: 'Resource title' })
  await input.fill(nextTitle)
  await input.press('Enter')
  await expect(page.getByRole('heading', { name: nextTitle, exact: true })).toBeVisible()
}

export async function viewAsYourself(page: Page) {
  await page.getByRole('button', { name: 'View as...', exact: true }).click()
  await page.getByRole('menuitem', { name: 'View as yourself', exact: true }).click()
  await expect(page.getByText('Viewing as yourself — editing is disabled')).toBeVisible()
}

export async function exitViewAs(page: Page) {
  await page.getByRole('button', { name: 'Exit view as', exact: true }).click()
}

export async function openSidebarHistoryMenu(page: Page) {
  const dropZone = page.getByLabel('resources resource drop zone')
  const box = await dropZone.boundingBox()
  if (!box) throw new Error('Expected a visible resource drop zone')
  await dropZone.click({
    button: 'right',
    position: { x: box.width - 4, y: box.height - 4 },
  })
  const menu = page.getByRole('menu', { name: 'Sidebar actions' })
  await expect(menu).toBeVisible()
  return menu
}
