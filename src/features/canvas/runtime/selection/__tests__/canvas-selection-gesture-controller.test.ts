import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createCanvasSelectionGestureController } from '../canvas-selection-gesture-controller'
import type { CanvasSelectionSnapshot } from '../../../tools/canvas-tool-types'

describe('createCanvasSelectionGestureController', () => {
  const rafCallbacks = new Map<number, FrameRequestCallback>()
  let nextRafId = 1

  beforeEach(() => {
    rafCallbacks.clear()
    nextRafId = 1
    vi.stubGlobal(
      'requestAnimationFrame',
      vi.fn((callback: FrameRequestCallback) => {
        const rafId = nextRafId
        nextRafId += 1
        rafCallbacks.set(rafId, callback)
        return rafId
      }),
    )
    vi.stubGlobal(
      'cancelAnimationFrame',
      vi.fn((rafId: number) => {
        rafCallbacks.delete(rafId)
      }),
    )
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('publishes additive previews from the gesture start selection', () => {
    const selection = createSelectionMock({
      nodeIds: new Set(['existing-node']),
      edgeIds: new Set(['existing-edge']),
    })
    const controller = createTestController({
      selection,
      preview: () => ({
        nodeIds: new Set(['next-node']),
        edgeIds: new Set<string>(),
      }),
    })

    controller.begin(createInput('start'), 'add')
    controller.update(createInput('updated'))
    flushAnimationFrame()

    expect(selection.setGesturePreview).toHaveBeenCalledWith({
      nodeIds: new Set(['existing-node', 'next-node']),
      edgeIds: new Set(['existing-edge']),
    })
  })

  it('commits the cached preview without recomputing on release', () => {
    const selection = createSelectionMock()
    const preview = vi
      .fn()
      .mockReturnValueOnce({
        nodeIds: new Set(['preview-node']),
        edgeIds: new Set(['preview-edge']),
      })
      .mockReturnValueOnce({
        nodeIds: new Set(['release-node']),
        edgeIds: new Set(['release-edge']),
      })
    const controller = createTestController({ selection, preview })

    controller.begin(createInput('start'), 'replace')
    controller.update(createInput('preview'))
    flushAnimationFrame()
    const committed = controller.commit(createInput('release'))

    expect(committed).toBe(true)
    expect(preview).toHaveBeenCalledTimes(1)
    expect(preview).toHaveBeenCalledWith({ value: '1' })
    expect(selection.commitGesture).toHaveBeenCalledTimes(1)
    expect(selection.setGesturePreview).toHaveBeenCalledWith({
      nodeIds: new Set(['preview-node']),
      edgeIds: new Set(['preview-edge']),
    })
  })

  it('cancels pending preview frames and clears strategy state', () => {
    const selection = createSelectionMock()
    const clear = vi.fn()
    const controller = createTestController({
      clear,
      selection,
      preview: () => ({
        nodeIds: new Set(['node']),
        edgeIds: new Set<string>(),
      }),
    })

    controller.begin(createInput('start'), 'replace')
    controller.update(createInput('pending'))
    controller.cancel()

    expect(cancelAnimationFrame).toHaveBeenCalledTimes(1)
    expect(clear).toHaveBeenCalledTimes(1)
    expect(selection.cancelGesture).toHaveBeenCalledTimes(1)
    expect(selection.commitGesture).not.toHaveBeenCalled()
  })

  function flushAnimationFrame() {
    const callbacks = Array.from(rafCallbacks.values())
    rafCallbacks.clear()

    for (const callback of callbacks) {
      callback(performance.now())
    }
  }
})

function createTestController({
  clear = vi.fn(),
  preview,
  selection = createSelectionMock(),
}: {
  clear?: () => void
  preview: (state: { value: string }) => CanvasSelectionSnapshot | null
  selection?: ReturnType<typeof createSelectionMock>
}) {
  return createCanvasSelectionGestureController({
    strategy: {
      kind: 'lasso',
      startGestureOnBegin: true,
      createInitialState: (input) => ({ value: input.clientPoint.x.toString() }),
      updateState: (_state, input) => ({ value: input.clientPoint.x.toString() }),
      refreshState: (_state, input) => ({ value: input.clientPoint.x.toString() }),
      preview,
      clear,
    },
    getSelection: () => selection,
    interaction: {
      suppressNextSurfaceClick: vi.fn(),
    },
    requestAnimationFrame,
    cancelAnimationFrame,
  })
}

function createSelectionMock(
  snapshot: CanvasSelectionSnapshot = { nodeIds: new Set(), edgeIds: new Set() },
) {
  return {
    beginGesture: vi.fn(),
    cancelGesture: vi.fn(),
    commitGesture: vi.fn(),
    getSnapshot: vi.fn(() => snapshot),
    setGesturePreview: vi.fn(),
  }
}

function createInput(value: string) {
  const numericValue = value === 'start' ? 0 : value === 'preview' ? 1 : 2
  return {
    canvasPoint: { x: numericValue, y: 0 },
    clientPoint: { x: numericValue, y: 0 },
    square: false,
  }
}
