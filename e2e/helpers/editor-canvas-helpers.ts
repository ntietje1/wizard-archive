import { expect } from '@playwright/test'
import type { Locator, Page } from '@playwright/test'

export async function openDemoCanvas(page: Page) {
  await page.goto('/demo?scenario=connected-canvas', { waitUntil: 'commit' })
  const editor = page.getByRole('application', { name: 'Harbor Heist Board canvas editor' })
  await expect(editor).toBeVisible({ timeout: 45_000 })
  return {
    edges: editor.getByTestId('canvas-edge'),
    editor,
    nodes: editor.getByTestId('canvas-node'),
    surface: editor.getByRole('region', { name: 'Canvas surface' }),
    viewport: editor.getByTestId('canvas-viewport'),
  }
}

export async function visibleBox(locator: Locator) {
  const box = await locator.boundingBox()
  if (!box) throw new Error('Expected a visible canvas element')
  return box
}

export function visibleCanvasNodePoint(
  node: Readonly<{ x: number; y: number; width: number; height: number }>,
  surface: Readonly<{ x: number; y: number; width: number; height: number }>,
) {
  const left = Math.max(node.x, surface.x)
  const top = Math.max(node.y, surface.y)
  const right = Math.min(node.x + node.width, surface.x + surface.width)
  const bottom = Math.min(node.y + node.height, surface.y + surface.height)
  if (right <= left || bottom <= top) throw new Error('Expected the canvas node to be visible')
  return {
    x: left + Math.min(20, (right - left) / 2),
    y: top + Math.min(20, (bottom - top) / 2),
  }
}

export async function dragPointer(
  page: Page,
  start: Readonly<{ x: number; y: number }>,
  end: Readonly<{ x: number; y: number }>,
  steps = 12,
  button: 'left' | 'middle' = 'left',
) {
  await page.mouse.move(start.x, start.y)
  await page.mouse.down({ button })
  await page.mouse.move(end.x, end.y, { steps })
  await page.mouse.up({ button })
}
