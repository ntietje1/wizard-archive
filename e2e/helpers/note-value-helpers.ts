import { expect } from '@playwright/test'
import type { Locator, Page } from '@playwright/test'
import {
  NOTE_VALUE_DEFAULT_SLUG,
  NOTE_VALUE_SLUG_OPTIONS,
} from '../../shared/note-values/constants'
import { parseSlug, slugify } from '../../shared/slugs'
import { openSlashMenu } from './editor-helpers'

type CreateValueInlineOptions = {
  slug?: string
  expression?: string
}

export function getValueInlines(page: Page): Locator {
  return page.getByTestId('note-value-inline')
}

export function getValueInlineBySlug(page: Page, slug: string): Locator {
  return page.locator(`[data-testid="note-value-inline"][data-note-value-slug="${slug}"]`)
}

export async function insertValueInline(page: Page): Promise<Locator> {
  const values = getValueInlines(page)
  const valueCountBefore = await values.count()
  const slashMenu = await openSlashMenu(page)
  const valueOption = slashMenu.getByRole('option', { name: /^Value\b/ }).first()
  await expect(valueOption).toBeVisible({ timeout: 5000 })
  await valueOption.click()
  await expect(values).toHaveCount(valueCountBefore + 1, { timeout: 5000 })
  const value = values.nth(valueCountBefore)
  await expect(value).toBeVisible()
  return value
}

export async function openValuePopover(value: Locator) {
  const page = value.page()
  const popover = page.getByTestId('note-value-popover')
  await expect(popover).toHaveCount(0)
  await value.click()
  await expect(popover).toBeVisible()
  return popover
}

export async function closeValuePopoverByToggle(value: Locator) {
  const page = value.page()
  const popover = page.getByTestId('note-value-popover')
  await expect(popover).toBeVisible()
  await value.click()
  await expect(popover).toHaveCount(0)
}

export async function openValuePopoverFromContextMenu(value: Locator) {
  const page = value.page()
  const popover = page.getByTestId('note-value-popover')
  await expect(popover).toHaveCount(0)
  const box = await value.boundingBox()
  expect(box).not.toBeNull()
  await page.mouse.click(box!.x + box!.width / 2, box!.y + box!.height / 2, { button: 'right' })
  await page.getByRole('menuitem', { name: 'Edit Value' }).click()
  await expect(popover).toBeVisible()
  return popover
}

export async function closeValuePopover(page: Page) {
  const popover = page.getByTestId('note-value-popover')
  await page.keyboard.press('Escape')
  await expect(popover).not.toBeVisible()
}

export async function createValueInline(
  page: Page,
  options: CreateValueInlineOptions = {},
): Promise<Locator> {
  const value = await insertValueInline(page)
  const popover = await openValuePopover(value)

  if (options.slug !== undefined) {
    await popover.getByRole('textbox', { name: 'Value slug' }).fill(options.slug)
  }
  if (options.expression !== undefined) {
    await popover.getByRole('textbox', { name: 'Value formula' }).fill(options.expression)
  }

  await closeValuePopover(page)

  const fallbackSlug = slugify(options.slug ?? NOTE_VALUE_DEFAULT_SLUG, {
    fallback: NOTE_VALUE_DEFAULT_SLUG,
    maxLength: NOTE_VALUE_SLUG_OPTIONS.maxLength,
  })
  const resolvedSlug =
    (await value.getAttribute('data-note-value-slug')) ??
    parseSlug(options.slug ?? '', NOTE_VALUE_SLUG_OPTIONS) ??
    fallbackSlug
  const resolvedValue = getValueInlineBySlug(page, resolvedSlug)
  await expect(resolvedValue).toBeVisible()
  return resolvedValue
}
