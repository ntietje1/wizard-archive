import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'
import { openDemoCanvas, visibleBox, visibleCanvasNodePoint } from './helpers/editor-canvas-helpers'

const CANVAS_GESTURE_MEASURE = 'wizard-archive:canvas-gesture-frame'
const PRODUCT_FRAME_BUDGET: CanvasPerformanceBudget = {
  maxHandlerDuration: 16,
  maxOutlierFrameDuration: {
    connecting: 100,
    dragging: 100,
    drawing: 100,
    erasing: 100,
    lasso: 125,
    marquee: 125,
    resizing: 100,
  },
  maxTypicalFrameDuration: {
    connecting: 50,
    dragging: 50,
    drawing: 50,
    erasing: 50,
    lasso: 100,
    marquee: 100,
    resizing: 50,
  },
}
const DEVELOPMENT_SERVER_TOLERANCE: CanvasPerformanceBudget = {
  maxHandlerDuration: 35,
  maxOutlierFrameDuration: {
    connecting: 175,
    dragging: 175,
    drawing: 100,
    erasing: 100,
    lasso: 300,
    marquee: 300,
    resizing: 125,
  },
  maxTypicalFrameDuration: {
    connecting: 100,
    dragging: 100,
    drawing: 50,
    erasing: 50,
    lasso: 250,
    marquee: 250,
    resizing: 75,
  },
}
const ACTIVE_FRAME_BUDGET =
  process.env.WA_CANVAS_PERFORMANCE_TARGET === 'product'
    ? PRODUCT_FRAME_BUDGET
    : DEVELOPMENT_SERVER_TOLERANCE
const WARMUP_SAMPLES = 2
const MIN_GESTURE_SAMPLES = 6

type CanvasGesture =
  | 'connecting'
  | 'dragging'
  | 'drawing'
  | 'erasing'
  | 'lasso'
  | 'marquee'
  | 'resizing'

type CanvasPerformanceSample = Readonly<{
  duration: number
  gesture: CanvasGesture
  handlerDuration: number
}>

type CanvasPerformanceBudget = Readonly<{
  maxHandlerDuration: number
  maxOutlierFrameDuration: Readonly<Record<CanvasGesture, number>>
  maxTypicalFrameDuration: Readonly<Record<CanvasGesture, number>>
}>

type CanvasPerformanceSummary = Readonly<{
  gesture: CanvasGesture
  samples: number
  lateFrameDurations: ReadonlyArray<number>
  lateHandlerDurations: ReadonlyArray<number>
  lateMaxFrameDuration: number
  lateMedianFrameDuration: number
  lateMaxHandlerDuration: number
}>

test.describe('canvas performance smoke', () => {
  test.setTimeout(60_000)

  test('rejects sustained visible multi-frame stalls at the product target', () => {
    const samples = Array.from({ length: MIN_GESTURE_SAMPLES }, () => ({
      duration: PRODUCT_FRAME_BUDGET.maxTypicalFrameDuration.dragging + 1,
      gesture: 'dragging' as const,
      handlerDuration: 1,
    }))

    expect(() =>
      assertCanvasPerformance(
        summarizeCanvasPerformance('dragging', samples),
        PRODUCT_FRAME_BUDGET,
      ),
    ).toThrow(/sustained visible-frame budget/)
  })

  test('measures maximum canonical gestures and keeps viewport culling exact', async ({
    page,
  }, testInfo) => {
    const { editor, nodes, surface, viewport } = await openDemoCanvas(page)
    const edges = editor.getByTestId('canvas-edge')
    await expect(nodes).toHaveCount(2)
    await editor.focus()

    for (let expectedCount = 4; expectedCount <= 256; expectedCount *= 2) {
      await page.keyboard.press('Control+a')
      await page.keyboard.press('Control+d')
      await expect(nodes).toHaveCount(expectedCount)
    }
    await page.keyboard.press('Control+d')
    await expect(nodes).toHaveCount(384)
    await page.keyboard.press('Control+d')
    await expect(nodes).toHaveCount(512)
    await expect(editor.locator('[data-testid="canvas-node"][data-node-type="text"]')).toHaveCount(
      256,
    )
    await expect(editor.locator('[data-testid="canvas-node"][data-node-type="embed"]')).toHaveCount(
      256,
    )
    await page.keyboard.press('Escape')
    const evidence: Array<CanvasPerformanceSummary> = []

    await editor.getByRole('button', { name: 'Zoom in' }).click()
    const firstNode = nodes.first()
    const firstNodeBox = await visibleBox(firstNode)
    const surfaceBox = await visibleBox(surface)
    const firstNodePoint = visibleCanvasNodePoint(firstNodeBox, surfaceBox)
    evidence.push(
      await measureCanvasGesture(page, 'dragging', async () => {
        await page.mouse.move(firstNodePoint.x, firstNodePoint.y)
        await page.mouse.down()
        await page.keyboard.down('Control')
        await movePointerOnFrames(
          page,
          firstNodePoint,
          {
            x: surfaceBox.x + Math.min(600, surfaceBox.width - 40),
            y: surfaceBox.y + Math.min(400, surfaceBox.height - 40),
          },
          6,
        )
        await expect
          .poll(() => editor.getByTestId('canvas-drag-snap-guide').count())
          .toBeGreaterThan(0)
        await page.keyboard.up('Control')
        await page.mouse.up()
      }),
    )
    await expect(firstNode).toBeVisible()

    expect(surfaceBox.width).toBeGreaterThan(0)
    expect(surfaceBox.height).toBeGreaterThan(0)
    expect(Number(await viewport.getAttribute('data-surface-width'))).toBeGreaterThan(0)
    const viewportBeforePan = await viewport.getAttribute('style')
    await page.mouse.move(surfaceBox.x + surfaceBox.width / 2, surfaceBox.y + surfaceBox.height / 2)
    await page.mouse.wheel(2_000, 2_000)
    await expect.poll(() => viewport.getAttribute('style')).not.toBe(viewportBeforePan)
    await expect(nodes).toHaveCount(0)

    await editor.getByRole('button', { name: 'Fit zoom' }).click()
    await expect(nodes).toHaveCount(512)
    const fittedBounds = await visibleBox(surface)

    const edgeCount = await edges.count()
    await editor.getByRole('button', { name: 'Edges' }).click()
    const sourceHandle = await visibleBox(nodes.last().getByTestId('canvas-node-handle-left'))
    const targetHandle = await visibleBox(nodes.first().getByTestId('canvas-node-handle-right'))
    evidence.push(
      await measureCanvasGesture(page, 'connecting', () =>
        dragPointerOnFrames(
          page,
          {
            x: sourceHandle.x + sourceHandle.width / 2,
            y: sourceHandle.y + sourceHandle.height / 2,
          },
          {
            x: targetHandle.x + targetHandle.width / 2,
            y: targetHandle.y + targetHandle.height / 2,
          },
          6,
        ),
      ),
    )
    await expect(edges).toHaveCount(edgeCount + 1)

    await editor.getByRole('button', { name: 'Lasso select' }).click()
    const inset = 8
    const lasso = [
      { x: fittedBounds.x + inset, y: fittedBounds.y + fittedBounds.height - inset },
      { x: fittedBounds.x + inset, y: fittedBounds.y + inset },
      { x: fittedBounds.x + fittedBounds.width - inset, y: fittedBounds.y + inset },
      {
        x: fittedBounds.x + fittedBounds.width - inset,
        y: fittedBounds.y + fittedBounds.height - inset,
      },
      { x: fittedBounds.x + inset, y: fittedBounds.y + fittedBounds.height - inset },
    ]
    evidence.push(
      await measureCanvasGesture(page, 'lasso', async () => {
        await page.mouse.move(lasso[0]!.x, lasso[0]!.y)
        await page.mouse.down()
        for (const [index, point] of lasso.slice(1).entries()) {
          await movePointerOnFrames(page, lasso[index]!, point, 2)
        }
        await page.mouse.up()
      }),
    )
    await editor.getByRole('button', { name: 'Pointer' }).click()
    const selection = editor.getByTestId('canvas-selection-resize-wrapper')
    await expect(selection).toBeVisible()

    await page.keyboard.press('Escape')
    evidence.push(
      await measureCanvasGesture(page, 'marquee', () =>
        dragPointerOnFrames(
          page,
          { x: fittedBounds.x + inset, y: fittedBounds.y + fittedBounds.height - inset },
          { x: fittedBounds.x + fittedBounds.width - inset, y: fittedBounds.y + inset },
          6,
        ),
      ),
    )
    await expect(selection).toBeVisible()

    await editor.getByRole('button', { name: 'Panning' }).click()
    await dragPointerOnFrames(
      page,
      {
        x: fittedBounds.x + fittedBounds.width / 2,
        y: fittedBounds.y + fittedBounds.height - 30,
      },
      {
        x: fittedBounds.x + fittedBounds.width / 2 + 250,
        y: fittedBounds.y + fittedBounds.height - 30,
      },
      4,
    )
    await editor.getByRole('button', { name: 'Pointer' }).click()
    const resize = editor.getByRole('button', {
      name: 'Resize bottom-right selection corner',
    })
    const resizeBounds = await visibleBox(resize)
    evidence.push(
      await measureCanvasGesture(page, 'resizing', async () => {
        await page.keyboard.down('Control')
        await dragPointerOnFrames(
          page,
          {
            x: resizeBounds.x + resizeBounds.width / 2,
            y: resizeBounds.y + resizeBounds.height / 2,
          },
          {
            x: resizeBounds.x + resizeBounds.width / 2 + 16,
            y: resizeBounds.y + resizeBounds.height / 2 + 16,
          },
          6,
        )
        await page.keyboard.up('Control')
      }),
    )
    await expect(selection).toBeVisible()

    await testInfo.attach('canvas-gesture-performance.json', {
      body: canvasPerformanceEvidence(evidence),
      contentType: 'application/json',
    })
  })

  test('measures erasing against the maximum canonical stroke corpus', async ({
    page,
  }, testInfo) => {
    const { editor, nodes, surface } = await openDemoCanvas(page)
    await expect(nodes).toHaveCount(2)
    await editor.focus()
    await page.keyboard.press('Control+a')
    await page.keyboard.press('Backspace')
    await expect(nodes).toHaveCount(0)
    const surfaceBox = await visibleBox(surface)
    await editor.getByRole('button', { name: 'Draw' }).click()
    await dragPointerOnFrames(
      page,
      { x: surfaceBox.x + 100, y: surfaceBox.y + surfaceBox.height / 2 },
      { x: surfaceBox.x + 260, y: surfaceBox.y + surfaceBox.height / 2 },
      2,
    )
    const strokes = editor.locator('[data-testid="canvas-node"][data-node-type="stroke"]')
    await expect(strokes).toHaveCount(1)
    await editor.getByRole('button', { name: 'Pointer' }).click()
    await editor.focus()
    for (let expectedCount = 2; expectedCount <= 256; expectedCount *= 2) {
      await page.keyboard.press('Control+a')
      await page.keyboard.press('Control+d')
      await expect(strokes).toHaveCount(expectedCount)
    }
    await page.keyboard.press('Control+d')
    await expect(strokes).toHaveCount(384)
    await page.keyboard.press('Control+d')
    await expect(strokes).toHaveCount(512)
    await page.keyboard.press('Escape')
    await editor.getByRole('button', { name: 'Fit zoom' }).click()
    const strokeBox = await visibleBox(strokes.first())
    await editor.getByRole('button', { name: 'Eraser' }).click()
    const evidence = await measureCanvasGesture(page, 'erasing', () =>
      dragPointerOnFrames(
        page,
        { x: strokeBox.x - 8, y: strokeBox.y + strokeBox.height / 2 - 12 },
        {
          x: strokeBox.x + strokeBox.width + 8,
          y: strokeBox.y + strokeBox.height / 2 + 12,
        },
        6,
      ),
    )
    await expect.poll(() => strokes.count()).toBeLessThan(512)

    await testInfo.attach('canvas-eraser-performance.json', {
      body: canvasPerformanceEvidence([evidence]),
      contentType: 'application/json',
    })
  })

  test('measures repeated drawing frames', async ({ page }, testInfo) => {
    const { editor, nodes, surface } = await openDemoCanvas(page)
    await editor.focus()
    await page.keyboard.press('Control+a')
    await page.keyboard.press('Backspace')
    await expect(nodes).toHaveCount(0)
    const surfaceBox = await visibleBox(surface)
    await editor.getByRole('button', { name: 'Draw' }).click()

    const evidence = await measureCanvasGesture(page, 'drawing', async () => {
      for (let index = 0; index < 3; index += 1) {
        await dragPointerOnFrames(
          page,
          { x: surfaceBox.x + 100, y: surfaceBox.y + surfaceBox.height / 2 + index * 12 },
          { x: surfaceBox.x + 260, y: surfaceBox.y + surfaceBox.height / 2 + index * 12 },
          2,
        )
      }
    })
    await expect(
      editor.locator('[data-testid="canvas-node"][data-node-type="stroke"]'),
    ).toHaveCount(3)
    await testInfo.attach('canvas-drawing-performance.json', {
      body: canvasPerformanceEvidence([evidence]),
      contentType: 'application/json',
    })
  })
})

async function measureCanvasGesture(
  page: Page,
  gesture: CanvasGesture,
  action: () => Promise<unknown>,
): Promise<CanvasPerformanceSummary> {
  await page.getByTestId('canvas-surface').evaluate((element, measureName) => {
    element.dataset.canvasPerformanceMeasure = measureName
  }, CANVAS_GESTURE_MEASURE)
  await page.evaluate((measureName) => {
    performance.clearMeasures(measureName)
  }, CANVAS_GESTURE_MEASURE)
  await action()
  await page.evaluate(
    () =>
      new Promise<void>((resolve) => {
        requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(resolve, 0)))
      }),
  )
  const allSamples = await page.evaluate((measureName) => {
    const samples: Array<CanvasPerformanceSample> = []
    for (const entry of performance.getEntriesByName(measureName)) {
      const detail = (entry as PerformanceMeasure).detail as {
        gesture?: CanvasGesture
        handlerDuration?: number
      } | null
      if (!detail?.gesture || typeof detail.handlerDuration !== 'number') continue
      samples.push({
        duration: entry.duration,
        gesture: detail.gesture,
        handlerDuration: detail.handlerDuration,
      })
    }
    return samples
  }, CANVAS_GESTURE_MEASURE)
  const samples = allSamples.filter((sample) => sample.gesture === gesture)
  const summary = summarizeCanvasPerformance(gesture, samples)
  assertCanvasPerformance(summary, ACTIVE_FRAME_BUDGET)
  return summary
}

function summarizeCanvasPerformance(
  gesture: CanvasGesture,
  samples: ReadonlyArray<CanvasPerformanceSample>,
): CanvasPerformanceSummary {
  if (samples.length < MIN_GESTURE_SAMPLES) {
    throw new Error(
      `${gesture} produced ${samples.length} pointer-frame samples; expected ${MIN_GESTURE_SAMPLES}`,
    )
  }
  const late = samples.slice(WARMUP_SAMPLES)
  const lateHandlerDurations = late.map((sample) => sample.handlerDuration)
  const lateFrameDurations = late.map((sample) => sample.duration)
  const sortedFrameDurations = [...lateFrameDurations].sort((left, right) => left - right)
  return {
    gesture,
    samples: samples.length,
    lateFrameDurations,
    lateHandlerDurations,
    lateMaxFrameDuration: Math.max(...lateFrameDurations),
    lateMedianFrameDuration:
      sortedFrameDurations[Math.floor(sortedFrameDurations.length / 2)] ?? Number.POSITIVE_INFINITY,
    lateMaxHandlerDuration: Math.max(...lateHandlerDurations),
  }
}

function assertCanvasPerformance(
  summary: CanvasPerformanceSummary,
  budget: CanvasPerformanceBudget,
) {
  if (summary.lateMaxHandlerDuration >= budget.maxHandlerDuration) {
    throw new Error(
      `${summary.gesture} pointer handler exceeded its bound: ${JSON.stringify(summary)}`,
    )
  }
  if (summary.lateMedianFrameDuration >= budget.maxTypicalFrameDuration[summary.gesture]) {
    throw new Error(
      `${summary.gesture} exceeded its sustained visible-frame budget: ${JSON.stringify(summary)}`,
    )
  }
  if (summary.lateMaxFrameDuration >= budget.maxOutlierFrameDuration[summary.gesture]) {
    throw new Error(`${summary.gesture} missed its next-frame bound: ${JSON.stringify(summary)}`)
  }
}

function canvasPerformanceEvidence(evidence: ReadonlyArray<CanvasPerformanceSummary>): string {
  return JSON.stringify(
    {
      developmentServerTolerance: DEVELOPMENT_SERVER_TOLERANCE,
      evidence,
      enforcedFrameBudget: ACTIVE_FRAME_BUDGET,
      productFrameBudget: PRODUCT_FRAME_BUDGET,
    },
    null,
    2,
  )
}

async function dragPointerOnFrames(
  page: Page,
  start: Readonly<{ x: number; y: number }>,
  end: Readonly<{ x: number; y: number }>,
  steps: number,
) {
  await page.mouse.move(start.x, start.y)
  await page.mouse.down()
  await movePointerOnFrames(page, start, end, steps)
  await page.mouse.up()
}

async function movePointerOnFrames(
  page: Page,
  start: Readonly<{ x: number; y: number }>,
  end: Readonly<{ x: number; y: number }>,
  steps: number,
) {
  for (let index = 1; index <= steps; index += 1) {
    const progress = index / steps
    await page.mouse.move(
      start.x + (end.x - start.x) * progress,
      start.y + (end.y - start.y) * progress,
    )
    await page.evaluate(
      () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve())),
    )
  }
}
