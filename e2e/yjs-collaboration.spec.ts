import { expect, test } from '@playwright/test'
import {
  createCampaign,
  deleteCampaign,
  navigateToCampaign,
} from './helpers/campaign-helpers'
import { createNote, openItem } from './helpers/sidebar-helpers'
import { getEditor } from './helpers/editor-helpers'
import { AUTH_STORAGE_PATH, testName } from './helpers/constants'

const campaignName = testName('E2E YJS Collab')

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
    const testNote = `Concurrent ${Date.now()}`

    const setupCtx = await browser.newContext({
      storageState: AUTH_STORAGE_PATH,
    })
    const setupPage = await setupCtx.newPage()
    await setupPage.goto('/campaigns')
    await navigateToCampaign(setupPage, campaignName)
    await createNote(setupPage, testNote)
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
      await navigateToCampaign(page1, campaignName)
      await openItem(page1, testNote)

      await page2.goto('/campaigns')
      await navigateToCampaign(page2, campaignName)
      await openItem(page2, testNote)

      const editor1 = await getEditor(page1)
      const editor2 = await getEditor(page2)

      const textA = `AlphaText-${Date.now()}-A`
      const textB = `BetaText-${Date.now()}-B`

      await editor1.click()
      await page1.keyboard.press('Home')
      await page1.keyboard.type(textA)

      await page1.waitForTimeout(100)

      await editor2.click()
      await page2.keyboard.press('End')
      await page2.keyboard.type(textB)

      await expect(editor1).toContainText(textA, { timeout: 15000 })
      await expect(editor1).toContainText(textB, { timeout: 15000 })
      await expect(editor2).toContainText(textA, { timeout: 15000 })
      await expect(editor2).toContainText(textB, { timeout: 15000 })
    } finally {
      await page1.close()
      await page2.close()
      await context1.close()
      await context2.close()
    }
  })

  test('large document sync', async ({ browser }) => {
    const testNote = `LargeDoc ${Date.now()}`

    const setupCtx = await browser.newContext({
      storageState: AUTH_STORAGE_PATH,
    })
    const setupPage = await setupCtx.newPage()
    await setupPage.goto('/campaigns')
    await navigateToCampaign(setupPage, campaignName)
    await createNote(setupPage, testNote)
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
      await navigateToCampaign(page1, campaignName)
      await openItem(page1, testNote)

      const editor1 = await getEditor(page1)
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

      await page2.goto('/campaigns')
      await navigateToCampaign(page2, campaignName)
      await openItem(page2, testNote)

      const editor2 = await getEditor(page2)

      for (const paragraph of paragraphs) {
        await expect(editor2).toContainText(paragraph, { timeout: 15000 })
      }
    } finally {
      await page1.close()
      await page2.close()
      await context1.close()
      await context2.close()
    }
  })

  test('rapid typing syncs reliably', async ({ browser }) => {
    const testNote = `RapidType ${Date.now()}`

    const setupCtx = await browser.newContext({
      storageState: AUTH_STORAGE_PATH,
    })
    const setupPage = await setupCtx.newPage()
    await setupPage.goto('/campaigns')
    await navigateToCampaign(setupPage, campaignName)
    await createNote(setupPage, testNote)
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
      await navigateToCampaign(page1, campaignName)
      await openItem(page1, testNote)

      await page2.goto('/campaigns')
      await navigateToCampaign(page2, campaignName)
      await openItem(page2, testNote)

      const editor1 = await getEditor(page1)
      await editor1.click()

      const rapidText = `RapidBurst-${Date.now()}-TheQuickBrownFoxJumpsOverTheLazyDogRepeatedly`
      await page1.keyboard.type(rapidText, { delay: 0 })

      const editor2 = await getEditor(page2)
      await expect(editor2).toContainText(rapidText, { timeout: 15000 })
    } finally {
      await page1.close()
      await page2.close()
      await context1.close()
      await context2.close()
    }
  })

  test('reconnection after brief disconnect', async ({ browser }) => {
    const testNote = `Reconnect ${Date.now()}`

    const setupCtx = await browser.newContext({
      storageState: AUTH_STORAGE_PATH,
    })
    const setupPage = await setupCtx.newPage()
    await setupPage.goto('/campaigns')
    await navigateToCampaign(setupPage, campaignName)
    await createNote(setupPage, testNote)
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
      await navigateToCampaign(page1, campaignName)
      await openItem(page1, testNote)

      await page2.goto('/campaigns')
      await navigateToCampaign(page2, campaignName)
      await openItem(page2, testNote)

      const editor1 = await getEditor(page1)
      const editor2 = await getEditor(page2)

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
    } finally {
      await page1.close()
      await page2.close()
      await context1.close()
      await context2.close()
    }
  })
})
