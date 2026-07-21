import { expect, test } from '@playwright/test'
import {
  createNamedResource,
  sidebarResource,
  viewAsYourself,
} from './helpers/editor-resource-helpers'

test.describe('editor shell', () => {
  test('shows valid drop feedback on the first drag movement', async ({ page }) => {
    await page.goto('/demo?scenario=campaign-home', { waitUntil: 'commit' })
    const source = sidebarResource(page, 'Blue-glass Invoice')
    const destination = page.getByLabel('resources resource drop zone')
    await expect(source).toBeVisible()
    await expect(destination).toBeVisible()
    const dataTransfer = await page.evaluateHandle(() => new DataTransfer())

    await source.dispatchEvent('dragstart', { clientX: 20, clientY: 30, dataTransfer })
    const overlay = page.getByTestId('resource-drag-overlay')
    await expect(overlay).toContainText('Move item to “Demo workspace”')
    await page.evaluate(() => {
      const element = document.querySelector('[data-testid="resource-drag-overlay"]')
      if (!element) throw new Error('Expected resource drag overlay')
      const feedbackHistory: Array<string> = []
      const record = () => feedbackHistory.push(element.textContent ?? '')
      new MutationObserver(record).observe(element, { childList: true, subtree: true })
      ;(
        window as unknown as { resourceDragFeedbackHistory: Array<string> }
      ).resourceDragFeedbackHistory = feedbackHistory
    })

    await destination.dispatchEvent('dragover', { clientX: 80, clientY: 90, dataTransfer })
    await expect(overlay).toContainText('Move item to “Demo workspace”')
    const feedbackHistory = await page.evaluate(
      () =>
        (window as unknown as { resourceDragFeedbackHistory: Array<string> })
          .resourceDragFeedbackHistory,
    )
    expect(feedbackHistory.every((feedback) => !feedback.includes('Cannot drop here'))).toBe(true)

    await source.dispatchEvent('dragend', { dataTransfer })
  })

  test('navigates resources and preserves workspace controls', async ({ page }) => {
    await page.goto('/demo?scenario=campaign-home', { waitUntil: 'commit' })

    const workspace = page.getByRole('region', { name: 'Demo workspace', exact: true })
    await expect(workspace).toBeVisible()
    await expect(page.getByRole('navigation', { name: 'Sidebar' })).toBeVisible({ timeout: 10_000 })

    const invoice = sidebarResource(page, 'Blue-glass Invoice')
    const canvas = sidebarResource(page, 'Harbor Heist Board')
    const map = sidebarResource(page, 'Moonwell Docks')
    await canvas.click()
    await invoice.click({ modifiers: ['Shift'] })
    await expect(invoice).toHaveAttribute('data-selected', 'true')
    await expect(canvas).toHaveAttribute('data-selected', 'true')
    await expect(map).toHaveAttribute('data-selected', 'true')
    await invoice.click({ button: 'right' })
    await expect(page.getByRole('menu', { name: 'Blue-glass Invoice actions' })).toBeVisible()
    await expect(page.getByRole('menuitem', { name: 'Copy 3 items' })).toBeVisible()
    await page.keyboard.press('Escape')

    const destination = await createNamedResource(page, 'Folder', 'Drop destination')
    await expect(destination).toBeVisible()
    await expect(invoice).toHaveAttribute('draggable', 'true')
    await invoice.dragTo(destination)
    await page.getByRole('button', { name: 'Expand Drop destination' }).click()
    await expect(invoice).toBeVisible()

    await sidebarResource(page, 'The Lantern Market').click()
    await expect(page.getByRole('heading', { name: 'The Lantern Market' })).toBeVisible()
    await expect(
      page.getByRole('textbox', { name: 'The Lantern Market note editor' }),
    ).toBeVisible()
    await page
      .getByRole('textbox', { name: 'The Lantern Market note editor' })
      .click({ button: 'right' })
    await expect(page.getByRole('menu', { name: 'The Lantern Market actions' })).toBeVisible()
    await page.keyboard.press('Escape')

    await page.getByRole('button', { name: 'Open resource panel' }).click()
    await expect(page.getByRole('complementary', { name: 'Resource panel' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Details' })).toBeVisible()

    await viewAsYourself(page)

    if (process.env.WA_VISUAL_QA_PATH) {
      await page.screenshot({ path: process.env.WA_VISUAL_QA_PATH })
    }
  })

  test('projects note headings into the live outline', async ({ page }) => {
    await page.goto('/demo?scenario=campaign-home', { waitUntil: 'commit' })
    const workspace = page.getByRole('region', { name: 'Demo workspace', exact: true })
    await expect(workspace).toHaveAttribute('aria-busy', 'false')
    await createNamedResource(page, 'Note', 'Outline scratchpad')
    await expect(page.getByRole('heading', { name: 'Outline scratchpad' })).toBeVisible()
    const editor = page.getByRole('textbox', { name: 'Outline scratchpad note editor' })
    await expect(editor).toBeVisible()

    await editor.locator('.bn-inline-content').click()
    await page.keyboard.type('/')
    await page.getByRole('option', { name: /^Heading 1/ }).click()
    await page.keyboard.type('Dockside chapter')
    await page.keyboard.press('Enter')
    await page.keyboard.type('/')
    await page.getByRole('option', { name: /^Heading 2/ }).click()
    await page.keyboard.type('Dockside clues')

    await page.getByRole('button', { name: 'Open resource panel' }).click()
    await page.getByRole('button', { name: 'Outline', exact: true }).click()
    const outline = page.getByRole('navigation', { name: 'Note outline' })
    await expect(outline.getByRole('button', { name: 'Dockside clues' })).toBeVisible()
    const chapterToggle = outline.getByRole('button', { expanded: true }).last()
    await expect(chapterToggle).toHaveAccessibleName('Collapse Dockside chapter')
    await chapterToggle.click()
    await expect(outline.getByRole('button', { name: 'Dockside clues' })).toHaveCount(0)
    const collapsedChapterToggle = outline.getByRole('button', { expanded: false }).last()
    await expect(collapsedChapterToggle).toHaveAccessibleName('Expand Dockside chapter')
    await collapsedChapterToggle.click()
    const outlineHeading = outline.getByRole('button', { name: 'Dockside clues' })
    await expect(outlineHeading).toBeVisible()
    await outlineHeading.click()
    await expect(page.locator(':focus')).toHaveAttribute('contenteditable', 'true')
    await expect
      .poll(() =>
        editor.evaluate((element) => {
          const target = [...element.querySelectorAll('[data-content-type="heading"]')].find(
            (candidate) => candidate.textContent === 'Dockside clues',
          )
          const selection = window.getSelection()
          return Boolean(target && selection?.anchorNode && target.contains(selection.anchorNode))
        }),
      )
      .toBe(true)
  })

  test('restores a note viewport after navigating away and back', async ({ page }) => {
    await page.goto('/demo?scenario=campaign-home', { waitUntil: 'commit' })
    await sidebarResource(page, 'The Lantern Market').click()
    const editor = page.getByRole('textbox', { name: 'The Lantern Market note editor' })
    await expect(editor).toBeVisible()
    await editor.click()
    await page.keyboard.press('Control+End')
    for (let index = 0; index < 24; index += 1) {
      await page.keyboard.press('Enter')
      await page.keyboard.type(`Persistent scroll line ${index}`)
    }

    const viewport = page.locator('.resource-note-editor [data-slot="scroll-area-viewport"]')
    const expectedScrollTop = await viewport.evaluate((element) => {
      element.scrollTop = element.scrollHeight
      const scrollTop = element.scrollTop
      element.dispatchEvent(new Event('scroll'))
      return scrollTop
    })
    expect(expectedScrollTop).toBeGreaterThan(0)
    await sidebarResource(page, 'Blue-glass Invoice').click()
    await expect(page.getByRole('heading', { name: 'Blue-glass Invoice' })).toBeVisible()
    await expect
      .poll(() =>
        page.evaluate(() => {
          let key: string | null = null
          for (let index = 0; index < window.localStorage.length; index += 1) {
            const candidate = window.localStorage.key(index)
            if (candidate?.includes(':note-scroll:')) {
              key = candidate
              break
            }
          }
          return key ? JSON.parse(window.localStorage.getItem(key) ?? '0') : 0
        }),
      )
      .toBe(expectedScrollTop)
    await sidebarResource(page, 'The Lantern Market').click()
    const restoredViewport = page.locator(
      '.resource-note-editor [data-slot="scroll-area-viewport"]',
    )
    await expect
      .poll(() => restoredViewport.evaluate((element) => element.scrollTop))
      .toBe(expectedScrollTop)
  })
})
