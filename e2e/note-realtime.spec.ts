import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'
import { api } from 'convex/_generated/api'
import {
  NOTE_YJS_FRAGMENT,
  decodeNoteYjsUpdatesToBlocks,
} from '@wizard-archive/editor/notes/document-yjs'
import { DOMAIN_ID_KIND, assertDomainId } from '@wizard-archive/editor/resources/domain-id'
import type { CampaignId, ResourceId } from '@wizard-archive/editor/resources/domain-id'
import { initialNoteContentVersion } from '@wizard-archive/editor/resources/content-version'
import { createCampaign, deleteCampaign, navigateToCampaign } from './helpers/campaign-helpers'
import { AUTH_STORAGE_PATH, testName } from './helpers/constants'
import { createE2EConvexClient, getCampaignIdFromUrl } from './helpers/convex-helpers'

const campaignName = testName('Canonical note collaboration')

test.describe.serial('canonical note collaboration', () => {
  test.describe.configure({ timeout: 120_000 })

  test('persists, reloads, and converges concurrent live edits', async ({ context, page }) => {
    await page.goto('/campaigns', { waitUntil: 'commit' })
    await createCampaign(page, campaignName)
    await navigateToCampaign(page, campaignName)
    const campaignId = getCampaignIdFromUrl(page.url())

    await page.getByRole('button', { name: 'Create resource' }).click()
    await page.getByRole('textbox', { name: 'New resource title' }).fill('Shared field notes')
    await page.getByRole('menuitem', { name: 'Note' }).click()
    const firstEditor = page.getByRole('textbox', { name: 'Shared field notes note editor' })
    await expect(firstEditor).toBeVisible()
    const resourceId = resourceIdFromEditorUrl(page.url())
    const convex = await createE2EConvexClient()
    const created = await convex.query(api.resources.queries.loadNoteContent, {
      campaignId,
      resourceId,
    })
    if (created.status !== 'ready') throw new Error('Expected created note content')
    expect(created.version).toEqual(await initialNoteContentVersion(new Uint8Array(created.update)))
    await firstEditor.click()
    await page.keyboard.insertText('Recovered across immediate reload')
    const pendingOutbox = await page.evaluate(() => {
      const key = Object.keys(sessionStorage).find((candidate) =>
        candidate.startsWith('wizard-archive:note-update-outbox:v1:'),
      )
      return key ? sessionStorage.getItem(key) : null
    })
    expect(pendingOutbox).not.toBeNull()
    const pendingUpdate = Uint8Array.from(Buffer.from(pendingOutbox!, 'base64'))
    decodeNoteYjsUpdatesToBlocks(
      [{ update: created.update }, { update: pendingUpdate.buffer }],
      NOTE_YJS_FRAGMENT,
    )

    await page.reload({ waitUntil: 'commit' })
    await expect(firstEditor).toContainText('Recovered across immediate reload')
    await flushEditor(page)

    await expect
      .poll(() => loadNoteText(convex, campaignId, resourceId), { timeout: 15_000 })
      .toContain('Recovered across immediate reload')

    await page.reload({ waitUntil: 'commit' })
    await expect(firstEditor).toContainText('Recovered across immediate reload')

    const secondPage = await context.newPage()
    await secondPage.goto(page.url(), { waitUntil: 'commit' })
    const secondEditor = secondPage.getByRole('textbox', {
      name: 'Shared field notes note editor',
    })
    await expect(secondEditor).toContainText('Recovered across immediate reload')

    const firstMarker = ` first-${'a'.repeat(1_000)}`
    const secondMarker = ` second-${'b'.repeat(1_000)}`
    await firstEditor.locator('p').first().click()
    await page.keyboard.press('Control+End')
    await page.keyboard.insertText(firstMarker)
    await expect(firstEditor).toContainText('first-aaaa')
    await secondEditor.locator('p').first().click()
    await secondPage.keyboard.press('Control+End')
    await secondPage.keyboard.insertText(secondMarker)
    await expect(secondEditor).toContainText('second-bbbb')
    await Promise.all([flushEditor(page), flushEditor(secondPage)])

    await expect(firstEditor).toContainText('first-aaaa', { timeout: 15_000 })
    await expect(firstEditor).toContainText('second-bbbb', { timeout: 15_000 })
    await expect(secondEditor).toContainText('first-aaaa', { timeout: 15_000 })
    await expect(secondEditor).toContainText('second-bbbb', { timeout: 15_000 })
    await expect
      .poll(() => loadNoteText(convex, campaignId, resourceId), { timeout: 15_000 })
      .toContain('first-aaaa')
    await expect
      .poll(() => loadNoteText(convex, campaignId, resourceId), { timeout: 15_000 })
      .toContain('second-bbbb')

    await secondPage.reload({ waitUntil: 'commit' })
    await expect(secondEditor).toContainText('first-aaaa')
    await expect(secondEditor).toContainText('second-bbbb')
    await secondPage.close()
  })

  test.afterAll(async ({ browser }) => {
    const context = await browser.newContext({ storageState: AUTH_STORAGE_PATH })
    const page = await context.newPage()
    await page.goto('/campaigns', { waitUntil: 'commit' })
    try {
      await deleteCampaign(page, campaignName)
    } catch {
      /* best-effort cleanup */
    }
    await context.close()
  })
})

async function flushEditor(page: Page) {
  await page.getByRole('heading', { name: 'Shared field notes' }).click()
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

function resourceIdFromEditorUrl(url: string): ResourceId {
  const resourceId = new URL(url).searchParams.get('resource')
  if (!resourceId) throw new Error(`Expected resource editor route, got ${url}`)
  return assertDomainId(DOMAIN_ID_KIND.resource, resourceId)
}

async function loadNoteText(
  convex: Awaited<ReturnType<typeof createE2EConvexClient>>,
  campaignId: CampaignId,
  resourceId: ResourceId,
) {
  const snapshot = await convex.query(api.resources.queries.loadNoteContent, {
    campaignId,
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
