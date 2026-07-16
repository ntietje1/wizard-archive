import { expect, test } from '@playwright/test'
import { createCampaign, deleteCampaign, navigateToCampaign } from './helpers/campaign-helpers'
import { testName } from './helpers/constants'
import type { Browser, BrowserContext, Page } from '@playwright/test'

const campaignName = testName('Canvas collaboration')
const canvasName = 'Shared canvas'

test.describe.serial('canvas collaboration', () => {
  test.setTimeout(60_000)

  test.beforeAll(async ({ browser }) => {
    const context = await browser.newContext({ storageState: 'e2e/.auth/user.json' })
    const page = await context.newPage()
    await page.goto('/campaigns', { waitUntil: 'commit' })
    await createCampaign(page, campaignName)
    await navigateToCampaign(page, campaignName)
    await page.getByRole('button', { name: 'Create resource' }).click()
    await page.getByRole('textbox', { name: 'New resource title' }).fill(canvasName)
    await page.getByRole('menuitem', { name: 'Canvas' }).click()
    await expect(page.getByRole('heading', { name: canvasName })).toBeVisible()
    await context.close()
  })

  test.afterAll(async ({ browser }) => {
    const context = await browser.newContext({ storageState: 'e2e/.auth/user.json' })
    const page = await context.newPage()
    await page.goto('/campaigns', { waitUntil: 'commit' })
    await deleteCampaign(page, campaignName)
    await context.close()
  })

  test('converges content while cursor and selection state remain ephemeral', async ({
    browser,
  }) => {
    const collaboration = await openCollaboration(browser)
    const { page1, page2 } = collaboration
    try {
      const canvas1 = page1.getByRole('application', { name: `${canvasName} canvas editor` })
      const canvas2 = page2.getByRole('application', { name: `${canvasName} canvas editor` })
      await expect(canvas1).toBeVisible()
      await expect(canvas2).toBeVisible()

      await canvas1.getByRole('button', { name: 'Text' }).click()
      const surface1 = canvas1.getByRole('region', { name: 'Canvas surface' })
      const bounds1 = await surface1.boundingBox()
      if (!bounds1) throw new Error('First canvas surface is not visible')
      await page1.mouse.click(bounds1.x + bounds1.width * 0.55, bounds1.y + bounds1.height * 0.5)
      const nodes1 = canvas1.getByTestId('canvas-node')
      const nodes2 = canvas2.getByTestId('canvas-node')
      await expect(nodes1).toHaveCount(1)
      const textEditor = canvas1.getByRole('textbox', { name: 'Canvas text' })
      await textEditor.fill('Shared harbor plan')
      await textEditor.press('Escape')

      await expect(nodes2).toHaveCount(1, { timeout: 15_000 })
      await expect(canvas2.getByText('Shared harbor plan', { exact: true })).toBeVisible()

      await nodes1.first().click()
      await expect(nodes1.first()).toHaveAttribute('data-selected', 'true')
      await expect(nodes2.first()).toHaveAttribute('data-selected', 'false')

      await page1.mouse.move(bounds1.x + 120, bounds1.y + 100)
      await expect(canvas2.getByTestId('canvas-remote-cursor')).toHaveCount(1, {
        timeout: 15_000,
      })

      const before = await nodes2.first().getAttribute('style')
      await nodes1.first().dragTo(surface1, {
        targetPosition: { x: bounds1.width * 0.7, y: bounds1.height * 0.65 },
      })
      await expect
        .poll(() => nodes2.first().getAttribute('style'), { timeout: 15_000 })
        .not.toBe(before)

      await page2.reload()
      await expect(
        page2.getByRole('application', { name: `${canvasName} canvas editor` }),
      ).toContainText('Shared harbor plan')

      await page1.getByRole('button', { name: campaignName }).click()
      await page1.getByRole('button', { name: 'Switch Campaign' }).click()
      await expect(page1.getByRole('heading', { name: 'Campaign Manager' })).toBeVisible()
      await expect(
        page2
          .getByRole('application', { name: `${canvasName} canvas editor` })
          .getByTestId('canvas-remote-cursor'),
      ).toHaveCount(0, { timeout: 15_000 })
      await page1.close()
    } finally {
      await closeCollaboration(collaboration)
    }
  })
})

async function openCollaboration(browser: Browser) {
  const context1 = await browser.newContext({ storageState: 'e2e/.auth/user.json' })
  const context2 = await browser.newContext({ storageState: 'e2e/.auth/user.json' })
  const page1 = await context1.newPage()
  const page2 = await context2.newPage()
  await Promise.all([openCanvas(page1), openCanvas(page2)])
  return { context1, context2, page1, page2 }
}

async function openCanvas(page: Page) {
  await page.goto('/campaigns', { waitUntil: 'commit' })
  await navigateToCampaign(page, campaignName)
  await page.getByRole('button', { name: canvasName }).click()
}

async function closeCollaboration({
  context1,
  context2,
}: {
  context1: BrowserContext
  context2: BrowserContext
}) {
  await Promise.allSettled([context1.close(), context2.close()])
}
