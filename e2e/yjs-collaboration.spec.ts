import { expect, test } from '@playwright/test'
import {
  createCampaign,
  deleteCampaign,
  navigateToCampaign,
} from './helpers/campaign-helpers'
import { createNote, openItem } from './helpers/sidebar-helpers'
import { getEditor } from './helpers/editor-helpers'
import { AUTH_STORAGE_PATH, testName } from './helpers/constants'
import type { Browser, BrowserContext, Locator, Page } from '@playwright/test'

const campaignName = testName('E2E YJS Collab')

async function withDualEditorContexts(
  browser: Browser,
  campaign: string,
  testFn: (ctx: {
    page1: Page
    page2: Page
    editor1: Locator
    editor2: Locator
  }) => Promise<void>,
) {
  const noteName = `Test ${Date.now()}`

  const setupCtx = await browser.newContext({
    storageState: AUTH_STORAGE_PATH,
  })
  const setupPage = await setupCtx.newPage()
  await setupPage.goto('/campaigns')
  await navigateToCampaign(setupPage, campaign)
  await createNote(setupPage, noteName)
  await setupPage.close()
  await setupCtx.close()

  const context1 = await browser.newContext({
    storageState: AUTH_STORAGE_PATH,
  })
  const context2 = await browser.newContext({
    storageState: AUTH_STORAGE_PATH,
  })
  const page1 = await context1.newPage()
  const page2 = await context2.newPage()

  try {
    await page1.goto('/campaigns')
    await navigateToCampaign(page1, campaign)
    await openItem(page1, noteName)

    await page2.goto('/campaigns')
    await navigateToCampaign(page2, campaign)
    await openItem(page2, noteName)

    const editor1 = await getEditor(page1)
    const editor2 = await getEditor(page2)

    await testFn({ page1, page2, editor1, editor2 })
  } finally {
    await page1.close()
    await page2.close()
    await context1.close()
    await context2.close()
  }
}

async function withControllableSecondEditor(
  browser: Browser,
  campaign: string,
  testFn: (ctx: {
    page1: Page
    page2: Page
    context2: BrowserContext
    editor1: Locator
    getEditor2: () => Promise<Locator>
  }) => Promise<void>,
) {
  const noteName = `Test ${Date.now()}`

  const setupCtx = await browser.newContext({
    storageState: AUTH_STORAGE_PATH,
  })
  const setupPage = await setupCtx.newPage()
  await setupPage.goto('/campaigns')
  await navigateToCampaign(setupPage, campaign)
  await createNote(setupPage, noteName)
  await setupPage.close()
  await setupCtx.close()

  const context1 = await browser.newContext({
    storageState: AUTH_STORAGE_PATH,
  })
  const context2 = await browser.newContext({
    storageState: AUTH_STORAGE_PATH,
  })
  const page1 = await context1.newPage()
  const page2 = await context2.newPage()

  try {
    await page1.goto('/campaigns')
    await navigateToCampaign(page1, campaign)
    await openItem(page1, noteName)

    const editor1 = await getEditor(page1)

    let cachedEditor2: Locator | null = null
    const getEditor2 = async () => {
      if (cachedEditor2) return cachedEditor2
      await page2.goto('/campaigns')
      await navigateToCampaign(page2, campaign)
      await openItem(page2, noteName)
      cachedEditor2 = await getEditor(page2)
      return cachedEditor2
    }

    await testFn({ page1, page2, context2, editor1, getEditor2 })
  } finally {
    await page1.close()
    await page2.close()
    await context1.close()
    await context2.close()
  }
}

test.describe.serial('yjs collaboration', () => {
  test.beforeAll(async ({ browser }) => {
    const context = await browser.newContext({
      storageState: AUTH_STORAGE_PATH,
    })
    const page = await context.newPage()
    await page.goto('/campaigns')
    await createCampaign(page, campaignName)
    await page.close()
    await context.close()
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

  test('concurrent typing in two tabs merges without conflict', async ({
    browser,
  }) => {
    await withDualEditorContexts(
      browser,
      campaignName,
      async ({ page1, page2, editor1, editor2 }) => {
        const textA = `AlphaText-${Date.now()}-A`
        const textB = `BetaText-${Date.now()}-B`

        await editor1.click()
        await page1.keyboard.press('Home')
        await page1.keyboard.type(textA)

        await expect(editor2).toContainText(textA, { timeout: 15000 })

        await editor2.click()
        await page2.keyboard.press('End')
        await page2.keyboard.type(textB)

        await expect(editor1).toContainText(textB, { timeout: 15000 })
        await expect(editor1).toContainText(textA, { timeout: 15000 })
        await expect(editor2).toContainText(textA, { timeout: 15000 })
        await expect(editor2).toContainText(textB, { timeout: 15000 })
      },
    )
  })

  test('large document sync', async ({ browser }) => {
    await withControllableSecondEditor(
      browser,
      campaignName,
      async ({ page1, editor1, getEditor2 }) => {
        await editor1.click()

        const paragraphs = [
          `Paragraph-1-${Date.now()}: The ancient wizard consulted the tome.`,
          `Paragraph-2-${Date.now()}: Runes glowed along the chamber walls.`,
          `Paragraph-3-${Date.now()}: A portal shimmered into existence nearby.`,
          `Paragraph-4-${Date.now()}: The adventurers prepared for the journey.`,
          `Paragraph-5-${Date.now()}: Beyond the gate lay uncharted territory.`,
        ]

        for (const paragraph of paragraphs) {
          await page1.keyboard.type(paragraph)
          await page1.keyboard.press('Enter')
        }

        const editor2 = await getEditor2()

        for (const paragraph of paragraphs) {
          await expect(editor2).toContainText(paragraph, { timeout: 15000 })
        }
      },
    )
  })

  test('rapid typing syncs reliably', async ({ browser }) => {
    await withDualEditorContexts(
      browser,
      campaignName,
      async ({ page1, editor1, editor2 }) => {
        await editor1.click()

        const rapidText = `RapidBurst-${Date.now()}-TheQuickBrownFoxJumpsOverTheLazyDogRepeatedly`
        await page1.keyboard.type(rapidText, { delay: 0 })

        await expect(editor2).toContainText(rapidText, { timeout: 15000 })
      },
    )
  })

  test('reconnection after brief disconnect', async ({ browser }) => {
    await withControllableSecondEditor(
      browser,
      campaignName,
      async ({ page1, context2, editor1, getEditor2 }) => {
        const editor2 = await getEditor2()

        const beforeOffline = `BeforeOffline-${Date.now()}`
        await editor1.click()
        await page1.keyboard.type(beforeOffline)

        await expect(editor2).toContainText(beforeOffline, { timeout: 15000 })

        await context2.setOffline(true)

        const duringOffline = `DuringOffline-${Date.now()}`
        await editor1.click()
        await page1.keyboard.press('End')
        await page1.keyboard.press('Enter')
        await page1.keyboard.type(duringOffline)

        await expect(editor1).toContainText(duringOffline, { timeout: 5000 })

        await context2.setOffline(false)

        await expect(editor2).toContainText(duringOffline, { timeout: 15000 })
      },
    )
  })
})
