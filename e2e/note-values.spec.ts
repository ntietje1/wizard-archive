import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'
import { api } from 'convex/_generated/api'
import { createCampaign, deleteCampaign, navigateToCampaign } from './helpers/campaign-helpers'
import { AUTH_STORAGE_PATH, testName } from './helpers/constants'
import {
  createE2EConvexClient,
  getCampaignIdFromRoute,
  getCampaignRouteFromUrl,
  getSidebarItemByName,
} from './helpers/convex-helpers'
import {
  closeValuePopover,
  createValueInline,
  getValueInlines,
  getValueInlineBySlug,
  insertValueInline,
  openValuePopover,
  openValuePopoverFromContextMenu,
} from './helpers/note-value-helpers'
import { newParagraphAtEnd } from './helpers/editor-helpers'
import { createNote, openItem } from './helpers/sidebar-helpers'
import { makeYjsUpdateWithBlocks } from '../convex/_test/yjs.helper'
import type { PartialNoteBlock } from '@wizard-archive/editor/notes/document-contract'
import { testNoteBlockId } from 'shared/test/note-block-id'

const campaignName = testName('Values')
let authoringNoteName: string
let contextMenuNoteName: string
let dragNoteName: string
let mixedDragNoteName: string
let readingNoteName: string
let referenceSourceNoteName: string
let referenceTargetNoteName: string

async function openCampaignNote(page: Page, noteName: string) {
  await page.goto('/campaigns', { waitUntil: 'commit' })
  await navigateToCampaign(page, campaignName)
  await openItem(page, noteName)
}

async function reopenNoteThroughSidebar(page: Page, awayNoteName: string, noteName: string) {
  await openItem(page, awayNoteName)
  await openItem(page, noteName)
}

async function toggleReadingMode(page: Page) {
  await page.getByRole('button', { name: 'More options' }).last().click()
  await page.getByRole('menuitem', { name: 'Reading Mode' }).click()
  await page.keyboard.press('Escape')
}

test.describe.serial('inline note values', () => {
  test.beforeAll(async ({ browser }) => {
    test.setTimeout(120000)

    const id = Date.now()
    authoringNoteName = `Value Authoring ${id}`
    contextMenuNoteName = `Value Context ${id}`
    dragNoteName = `Value Drag ${id}`
    mixedDragNoteName = `Value Mixed Drag ${id}`
    readingNoteName = `Value Reading ${id}`
    referenceSourceNoteName = `Value Source ${id}`
    referenceTargetNoteName = `Value Target ${id}`

    const context = await browser.newContext({
      storageState: AUTH_STORAGE_PATH,
    })
    const page = await context.newPage()

    await page.goto('/campaigns', { waitUntil: 'commit' })
    await createCampaign(page, campaignName)
    await navigateToCampaign(page, campaignName)
    await createNote(page, authoringNoteName)
    await createNote(page, contextMenuNoteName)
    await createNote(page, dragNoteName)
    await createNote(page, mixedDragNoteName)
    await createNote(page, readingNoteName)
    await createNote(page, referenceSourceNoteName)
    await createNote(page, referenceTargetNoteName)

    await page.close()
    await context.close()
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
      /* best-effort cleanup */
    }

    await page.close()
    await context.close()
  })

  test('opens the value popover from left click and edits slug and formula', async ({ page }) => {
    await openCampaignNote(page, authoringNoteName)

    const draft = await insertValueInline(page)
    await openValuePopover(draft)
    await closeValuePopover(page)

    const reopenedPopover = await openValuePopover(draft)
    await reopenedPopover.getByRole('textbox', { name: 'Value slug' }).fill('armor_class')
    await reopenedPopover.getByRole('textbox', { name: 'Value formula' }).fill('16')
    await expect(reopenedPopover.getByTestId('note-value-preview')).toContainText('16')
    await closeValuePopover(page)

    const armorClass = getValueInlineBySlug(page, 'armor_class')
    await expect(armorClass).toContainText('armor_class')
    await expect(armorClass).toContainText('16')

    await reopenNoteThroughSidebar(page, contextMenuNoteName, authoringNoteName)

    const persistedArmorClass = getValueInlineBySlug(page, 'armor_class')
    await expect(persistedArmorClass).toContainText('armor_class')
    await expect(persistedArmorClass).toContainText('16')
    await waitForPersistedValueState(page, {
      formattedValue: '16',
      noteName: authoringNoteName,
      slug: 'armor_class',
    })

    await page.reload()
    await expect(getValueInlineBySlug(page, 'armor_class')).toContainText('16', {
      timeout: 30000,
    })
  })

  test('references another note value through formula autocomplete and persists it', async ({
    page,
  }) => {
    await openCampaignNote(page, referenceSourceNoteName)
    await persistNoteBlocksByName(page, referenceSourceNoteName, [
      valueParagraphBlock('reference-source-prof-bonus', 'reference-source-prof-bonus-value', {
        expressionSource: '2',
        slug: 'prof_bonus',
      }),
    ])

    await openItem(page, referenceTargetNoteName)
    const total = await insertValueInline(page)
    const popover = await openValuePopover(total)
    await popover.getByRole('textbox', { name: 'Value slug' }).fill('target_total')

    const formula = popover.getByRole('textbox', { name: 'Value formula' })
    await formula.fill('[[')
    const sourceNoteOption = page.getByRole('option', { name: new RegExp(referenceSourceNoteName) })
    await expect(sourceNoteOption).toContainText('prof_bonus', { timeout: 15_000 })
    await sourceNoteOption.click()
    await page.getByRole('option', { name: /prof_bonus/ }).click()
    await expect(formula).toHaveValue(new RegExp(`^\\[\\[.*\\.prof_bonus\\]\\]$`))
    await formula.pressSequentially(' + 1')
    await expect(popover.getByTestId('note-value-preview')).toContainText('3')
    await closeValuePopover(page)

    await reopenNoteThroughSidebar(page, referenceSourceNoteName, referenceTargetNoteName)

    const persistedTotal = getValueInlineBySlug(page, 'target_total')
    await expect(persistedTotal).toContainText('target_total')
    await expect(persistedTotal).toContainText('3')
    await waitForPersistedValueState(page, {
      formattedValue: '3',
      noteName: referenceTargetNoteName,
      slug: 'target_total',
    })

    await page.reload()
    await expect(getValueInlineBySlug(page, 'target_total')).toContainText('3', {
      timeout: 30000,
    })
  })

  test('opens the value popover from the value-specific context menu item', async ({ page }) => {
    await openCampaignNote(page, contextMenuNoteName)

    const contextValue = await createValueInline(page, {
      slug: 'context_value',
      expression: '12',
    })
    const popover = await openValuePopoverFromContextMenu(contextValue)
    await popover.getByRole('textbox', { name: 'Value formula' }).fill('18')
    await expect(popover.getByTestId('note-value-preview')).toContainText('18')
    await closeValuePopover(page)

    await expect(contextValue).toContainText('18')
  })

  test('dragging a value does not mint a copied slug or lose its formula display', async ({
    page,
  }) => {
    await openCampaignNote(page, dragNoteName)

    const value = await createValueInline(page, {
      slug: 'drag_value',
      expression: '7',
    })
    await newParagraphAtEnd(page)
    await page.keyboard.type('Drop target')

    const targetParagraph = page
      .locator('[contenteditable="true"] p')
      .filter({ hasText: 'Drop target' })
    const valueBox = await value.boundingBox()
    const targetBox = await targetParagraph.boundingBox()
    expect(valueBox).not.toBeNull()
    expect(targetBox).not.toBeNull()
    await page.mouse.move(valueBox!.x + valueBox!.width / 2, valueBox!.y + valueBox!.height / 2)
    await page.mouse.down()
    await page.mouse.move(
      targetBox!.x + targetBox!.width - 4,
      targetBox!.y + targetBox!.height / 2,
      {
        steps: 16,
      },
    )
    await page.mouse.up()

    await expect(getValueInlineBySlug(page, 'drag_value')).toHaveCount(1)
    await expect(getValueInlineBySlug(page, 'drag_value_2')).toHaveCount(0)
    await expect(getValueInlineBySlug(page, 'drag_value')).toContainText('7')
    await expect(getValueInlineBySlug(page, 'drag_value')).not.toContainText('No formula')
    await expect
      .poll(() => getParagraphValueSnapshot(page, 'drag_value'))
      .toMatchObject({
        valueCount: 1,
        containingParagraphText: expect.stringContaining('Drop target'),
      })
  })

  test('dragging selected text and a value moves the value instead of duplicating it', async ({
    page,
  }) => {
    await openCampaignNote(page, mixedDragNoteName)

    const editor = page.locator('[contenteditable="true"]').first()
    await editor.click()
    await page.keyboard.type('Lead  trail')
    await placeCaretAfterText(page, 'Lead ')
    const value = await createValueInlineAtCursor(page, {
      slug: 'mixed_drag',
      expression: '7',
    })
    await newParagraphAtEnd(page)
    await page.keyboard.type('Drop target')

    await selectValueParagraphContents(page, 'mixed_drag')

    const targetParagraph = page.locator('[contenteditable="true"] p').filter({
      hasText: 'Drop target',
    })
    const valueBox = await value.boundingBox()
    const targetBox = await targetParagraph.boundingBox()
    expect(valueBox).not.toBeNull()
    expect(targetBox).not.toBeNull()

    await page.mouse.move(valueBox!.x + valueBox!.width / 2, valueBox!.y + valueBox!.height / 2)
    await page.mouse.down()
    await page.mouse.move(
      targetBox!.x + targetBox!.width - 8,
      targetBox!.y + targetBox!.height / 2,
      {
        steps: 20,
      },
    )
    await page.mouse.up()

    await expect(getValueInlineBySlug(page, 'mixed_drag')).toHaveCount(1)
    await expect
      .poll(() => getParagraphValueSnapshot(page, 'mixed_drag'))
      .toMatchObject({
        valueCount: 1,
        containingParagraphText: expect.stringContaining('Drop target'),
      })
  })

  test('renders the same inline chip in reading mode', async ({ page }) => {
    await openCampaignNote(page, readingNoteName)

    const strength = await createValueInline(page, {
      slug: 'strength',
      expression: '16',
    })
    await expect(strength).toContainText('strength')
    await expect(strength).toContainText('16')

    await toggleReadingMode(page)

    const readingStrength = getValueInlineBySlug(page, 'strength')
    await expect(readingStrength).toContainText('strength')
    await expect(readingStrength).toContainText('16')
    await readingStrength.click()
    await expect(page.getByTestId('note-value-popover')).toHaveCount(0)
  })
})

async function selectValueParagraphContents(page: Page, slug: string) {
  await page.evaluate((targetSlug) => {
    const value = document.querySelector(
      `[data-testid="note-value-inline"][data-note-value-slug="${targetSlug}"]`,
    )
    const paragraph = value?.closest('p')
    if (!paragraph) {
      throw new Error(`Unable to find paragraph for value ${targetSlug}`)
    }

    const range = document.createRange()
    range.selectNodeContents(paragraph)
    const selection = window.getSelection()
    selection?.removeAllRanges()
    selection?.addRange(range)
  }, slug)
}

async function createValueInlineAtCursor(
  page: Page,
  options: { slug: string; expression: string },
) {
  const values = getValueInlines(page)
  const valueCountBefore = await values.count()
  await page.keyboard.type('/')
  const slashMenu = page.locator('[data-testid="slash-menu"] [role="listbox"]')
  await expect(slashMenu).toBeVisible({ timeout: 5000 })
  await slashMenu
    .getByRole('option', { name: /^Value\b/ })
    .first()
    .click()
  await expect(values).toHaveCount(valueCountBefore + 1, { timeout: 5000 })

  const value = values.nth(valueCountBefore)
  const popover = await openValuePopover(value)
  await popover.getByRole('textbox', { name: 'Value slug' }).fill(options.slug)
  await popover.getByRole('textbox', { name: 'Value formula' }).fill(options.expression)
  await closeValuePopover(page)

  const resolvedValue = getValueInlineBySlug(page, options.slug)
  await expect(resolvedValue).toBeVisible()
  return resolvedValue
}

async function persistNoteBlocksByName(
  page: Page,
  noteName: string,
  blocks: Array<PartialNoteBlock>,
) {
  const { dmUsername, campaignSlug } = getCampaignRouteFromUrl(page.url())
  const campaignId = await getCampaignIdFromRoute({ dmUsername, slug: campaignSlug })
  const note = await getSidebarItemByName({ campaignId, name: noteName })
  const client = await createE2EConvexClient()
  await client.mutation(api.yjsSync.mutations.pushUpdate, {
    campaignId,
    documentId: note.id,
    update: makeYjsUpdateWithBlocks(blocks),
  })
  await client.action(api.notes.actions.persistNoteBlocks, {
    campaignId,
    documentId: note.id,
  })
}

async function waitForPersistedValueState(
  page: Page,
  {
    formattedValue,
    noteName,
    slug,
  }: {
    formattedValue: string
    noteName: string
    slug: string
  },
) {
  const { dmUsername, campaignSlug } = getCampaignRouteFromUrl(page.url())
  const campaignId = await getCampaignIdFromRoute({ dmUsername, slug: campaignSlug })
  const note = await getSidebarItemByName({ campaignId, name: noteName })
  const client = await createE2EConvexClient()

  await expect
    .poll(
      async () => {
        const states = await client.query(api.noteValues.queries.getNoteValueStates, {
          campaignId,
          noteId: note.id,
        })
        return states.some(
          (state) =>
            state.slug === slug && state.status === 'ok' && state.formattedValue === formattedValue,
        )
      },
      { timeout: 60000 },
    )
    .toBe(true)
}

function valueParagraphBlock(
  id: string,
  valueId: string,
  {
    expressionSource,
    slug,
  }: {
    expressionSource: string
    slug: string
  },
): PartialNoteBlock {
  return {
    id: testNoteBlockId(id),
    type: 'paragraph',
    props: {},
    content: [
      {
        type: 'value',
        props: { expressionSource, slug, valueId },
      },
    ],
    children: [],
  }
}

async function placeCaretAfterText(page: Page, text: string) {
  await page.evaluate((targetText) => {
    const editor = document.querySelector('[contenteditable="true"]') as HTMLElement | null
    if (!editor) {
      throw new Error('Unable to find editor')
    }
    const walker = document.createTreeWalker(editor, NodeFilter.SHOW_TEXT)
    let node = walker.nextNode()
    while (node && !node.textContent?.includes(targetText)) {
      node = walker.nextNode()
    }
    if (!node?.textContent) {
      throw new Error(`Unable to find text ${targetText}`)
    }

    const range = document.createRange()
    range.setStart(node, node.textContent.indexOf(targetText) + targetText.length)
    range.collapse(true)
    const selection = window.getSelection()
    selection?.removeAllRanges()
    selection?.addRange(range)
    editor.focus()
  }, text)
}

async function getParagraphValueSnapshot(page: Page, slug: string) {
  return await page.evaluate((targetSlug) => {
    const editor = document.querySelector('[contenteditable="true"]')
    if (!editor) return null

    const values = Array.from(
      editor.querySelectorAll(
        `[data-testid="note-value-inline"][data-note-value-slug="${targetSlug}"]`,
      ),
    )
    const containingParagraphText = values[0]?.closest('p')?.textContent ?? ''
    return {
      valueCount: values.length,
      containingParagraphText,
    }
  }, slug)
}
