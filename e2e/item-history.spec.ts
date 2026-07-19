import { expect, test } from '@playwright/test'
import type { Page, TestInfo } from '@playwright/test'
import { api } from 'convex/_generated/api'
import {
  NOTE_YJS_FRAGMENT,
  decodeNoteYjsUpdatesToBlocks,
} from '@wizard-archive/editor/notes/document-yjs'
import type {
  CampaignId,
  HistoryEntryId,
  ResourceId,
} from '@wizard-archive/editor/resources/domain-id'
import { DOMAIN_ID_KIND, assertDomainId } from '@wizard-archive/editor/resources/domain-id'
import {
  deleteCampaignById,
  navigateToCampaignResource,
  provisionCampaign,
} from './helpers/campaign-helpers'
import { testName } from './helpers/constants'
import { createE2EConvexClient } from './helpers/convex-helpers'
import { provisionNoteResource } from './helpers/resource-helpers'

const campaignName = testName('Canonical item history')
const noteName = 'Expedition log'
const historicalText = 'The party entered the eastern passage'
const checkpointSuffix = ' before nightfall'
const currentSuffix = ' and found a sealed door'
let campaignId: CampaignId | undefined

test.describe.serial('canonical item history', () => {
  test.describe.configure({ timeout: 120_000 })

  test('previews, exits, cancels, and restores a persisted note checkpoint', async ({
    page,
  }, testInfo) => {
    campaignId = await provisionCampaign(campaignName)
    const resourceId = await provisionNoteResource(campaignId, noteName)
    await navigateToCampaignResource(page, campaignId, resourceId)

    const editor = page.getByRole('textbox', { name: `${noteName} note editor` })
    await expect(editor).toBeVisible({ timeout: 30_000 })
    await appendToNote(page, editor, `${historicalText}${checkpointSuffix}`)
    const convex = await createE2EConvexClient()
    await waitForHistoryEntry(convex, campaignId, resourceId, 'content_edited')

    await appendToNote(page, editor, currentSuffix)
    await expect
      .poll(() => loadNoteText(convex, campaignId!, resourceId), { timeout: 15_000 })
      .toContain(`${historicalText}${checkpointSuffix}${currentSuffix}`)

    const history = await openHistory(page)
    await expect(history).toContainText('created this item')
    const checkpointEntry = history
      .getByRole('button')
      .filter({ hasText: 'edited content' })
      .first()
    await expect(checkpointEntry).toBeVisible()
    await attachScreenshot(page, testInfo, 'item-history-timeline')

    await checkpointEntry.click()
    const preview = page.getByRole('textbox', {
      name: `${noteName} historical note preview`,
    })
    await expect(page.getByText(/Previewing version from/i)).toBeVisible()
    await expect(preview).toContainText(`${historicalText}${checkpointSuffix}`)
    await expect(preview).not.toContainText(currentSuffix)
    await attachScreenshot(page, testInfo, 'item-history-preview')

    await page.getByRole('button', { name: 'Exit' }).click()
    await expect(page.getByText(/Previewing version from/i)).not.toBeVisible()
    await expect(editor).toContainText(currentSuffix)

    await checkpointEntry.click()
    await expect(preview).toBeVisible()
    await page.getByRole('button', { name: 'Restore', exact: true }).click()
    const dialog = page.getByRole('alertdialog', { name: 'Restore this version?' })
    await expect(dialog).toBeVisible()
    await attachScreenshot(page, testInfo, 'item-history-restore-confirmation')
    await dialog.getByRole('button', { name: 'Cancel' }).click()
    await expect(dialog).not.toBeVisible()
    await expect(page.getByText(/Previewing version from/i)).toBeVisible()

    await page.getByRole('button', { name: 'Restore', exact: true }).click()
    await page
      .getByRole('alertdialog', { name: 'Restore this version?' })
      .getByRole('button', { name: 'Restore', exact: true })
      .click()

    await expect(page.getByText(/Previewing version from/i)).not.toBeVisible({
      timeout: 15_000,
    })
    await expect(editor).toContainText(`${historicalText}${checkpointSuffix}`)
    await expect(editor).not.toContainText(currentSuffix)
    await expect
      .poll(() => loadNoteText(convex, campaignId!, resourceId), { timeout: 15_000 })
      .toBe(`${historicalText}${checkpointSuffix}`)
    await waitForHistoryEntry(convex, campaignId, resourceId, 'content_restored')
    await expect(history).toContainText('restored a previous version')
    await attachScreenshot(page, testInfo, 'item-history-restored')
  })

  test.afterAll(async () => {
    if (campaignId) await deleteCampaignById(campaignId)
  })
})

async function appendToNote(page: Page, editor: ReturnType<Page['getByRole']>, text: string) {
  await editor.click()
  await page.keyboard.press('Control+End')
  await page.keyboard.insertText(text)
  await page.getByRole('heading', { name: noteName }).click()
  await expect
    .poll(
      () =>
        page.evaluate(
          () =>
            !Object.keys(sessionStorage).some((key) =>
              key.startsWith('wizard-archive:note-update-outbox:v1:'),
            ),
        ),
      { timeout: 15_000 },
    )
    .toBe(true)
}

async function openHistory(page: Page) {
  await page.getByRole('button', { name: /Open history, edited/i }).click()
  const history = page.getByRole('list', { name: 'Item history' })
  await expect(history).toBeVisible()
  return history
}

async function waitForHistoryEntry(
  convex: Awaited<ReturnType<typeof createE2EConvexClient>>,
  targetCampaignId: CampaignId,
  resourceId: ResourceId,
  action: 'content_edited' | 'content_restored',
): Promise<HistoryEntryId> {
  let entryId: string | null = null
  await expect
    .poll(
      async () => {
        const history = await convex.query(api.resources.queries.loadItemHistoryPage, {
          campaignId: targetCampaignId,
          resourceId,
          cursor: null,
        })
        if (history.status !== 'ready') return null
        entryId = history.entries.find((entry) => entry.action === action)?.id ?? null
        return entryId
      },
      { timeout: 45_000 },
    )
    .not.toBeNull()
  if (!entryId) throw new Error(`History entry ${action} was not persisted`)
  return assertDomainId(DOMAIN_ID_KIND.historyEntry, entryId)
}

async function loadNoteText(
  convex: Awaited<ReturnType<typeof createE2EConvexClient>>,
  targetCampaignId: CampaignId,
  resourceId: ResourceId,
) {
  const snapshot = await convex.query(api.resources.queries.loadNoteContent, {
    campaignId: targetCampaignId,
    resourceId,
  })
  if (snapshot.status !== 'ready') return ''
  return decodeNoteYjsUpdatesToBlocks([{ update: snapshot.update }], NOTE_YJS_FRAGMENT)
    .flatMap((block) =>
      Array.isArray(block.content)
        ? block.content.flatMap((content) => (content.type === 'text' ? [content.text] : []))
        : [],
    )
    .join('')
}

async function attachScreenshot(page: Page, testInfo: TestInfo, name: string) {
  await testInfo.attach(name, {
    body: await page.screenshot(),
    contentType: 'image/png',
  })
}
