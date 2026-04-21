import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createCanvasSelectionGestureSession } from '../canvas-selection-gesture-session'
import {
  clearCanvasPendingSelectionPreview,
  useCanvasPendingSelectionPreviewStore,
} from '../use-canvas-pending-selection-preview'

describe('createCanvasSelectionGestureSession', () => {
  const rafCallbacks = new Map<number, FrameRequestCallback>()
  let nextRafId = 1

  beforeEach(() => {
    clearCanvasPendingSelectionPreview()
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

  function flushAnimationFrame() {
    const callbacks = Array.from(rafCallbacks.values())
    rafCallbacks.clear()

    for (const callback of callbacks) {
      callback(performance.now())
    }
  }

  it('uses the starting committed selection when publishing additive preview state', () => {
    const session = createSession({
      selection: {
        getSelectedNodeIds: () => ['existing-node'],
        getSelectedEdgeIds: () => ['existing-edge'],
      },
      preview: () => ({
        nodeIds: ['next-node'],
        edgeIds: [],
      }),
    })

    session.begin({ value: 'start' }, 'add')
    session.update({ value: 'updated' })
    flushAnimationFrame()

    expect(useCanvasPendingSelectionPreviewStore.getState().pendingNodeIds).toEqual(
      new Set(['existing-node', 'next-node']),
    )
    expect(useCanvasPendingSelectionPreviewStore.getState().pendingEdgeIds).toEqual(
      new Set(['existing-edge']),
    )
  })

  it('commits the last preview, clears pending preview state, and ends the gesture', () => {
    const commitGestureSelection = vi.fn()
    const endGesture = vi.fn()
    const suppressNextSurfaceClick = vi.fn()
    const clear = vi.fn()

    const session = createSession({
      clear,
      interaction: { suppressNextSurfaceClick },
      preview: () => ({
        nodeIds: ['node-1'],
        edgeIds: ['edge-1'],
      }),
      selection: {
        commitGestureSelection,
        endGesture,
      },
    })

    session.begin({ value: 'start' }, 'replace')
    session.update({ value: 'updated' })
    flushAnimationFrame()

    expect(useCanvasPendingSelectionPreviewStore.getState().pendingNodeIds).toEqual(
      new Set(['node-1']),
    )

    session.commit({ value: 'final' })

    expect(commitGestureSelection).toHaveBeenCalledWith(
      {
        nodeIds: ['node-1'],
        edgeIds: ['edge-1'],
      },
      'replace',
    )
    expect(suppressNextSurfaceClick).toHaveBeenCalledTimes(1)
    expect(endGesture).toHaveBeenCalledTimes(1)
    expect(clear).toHaveBeenCalledTimes(1)
    expect(useCanvasPendingSelectionPreviewStore.getState().pendingNodeIds).toBeNull()
    expect(useCanvasPendingSelectionPreviewStore.getState().pendingEdgeIds).toEqual(new Set())
  })

  it('clears local state on cancel and dispose without committing selection', () => {
    const commitGestureSelection = vi.fn()
    const endGesture = vi.fn()
    const clear = vi.fn()

    const session = createSession({
      clear,
      preview: () => ({
        nodeIds: ['node-1'],
        edgeIds: [],
      }),
      selection: {
        commitGestureSelection,
        endGesture,
      },
    })

    session.begin({ value: 'start' }, 'replace')
    session.update({ value: 'updated' })
    flushAnimationFrame()
    session.cancel()

    expect(commitGestureSelection).not.toHaveBeenCalled()
    expect(endGesture).toHaveBeenCalledTimes(1)
    expect(clear).toHaveBeenCalledTimes(1)
    expect(useCanvasPendingSelectionPreviewStore.getState().pendingNodeIds).toBeNull()

    session.begin({ value: 'start-again' }, 'replace')
    session.dispose()

    expect(commitGestureSelection).not.toHaveBeenCalled()
    expect(endGesture).toHaveBeenCalledTimes(2)
    expect(clear).toHaveBeenCalledTimes(2)
  })
})

function createSession({
  clear = vi.fn(),
  interaction,
  preview,
  selection,
}: {
  clear?: () => void
  interaction?: {
    suppressNextSurfaceClick: () => void
  }
  preview: (state: { value: string }) => { nodeIds: Array<string>; edgeIds: Array<string> } | null
  selection?: Partial<{
    beginGesture: (kind: 'marquee' | 'lasso') => void
    commitGestureSelection: (
      selection: { nodeIds: Array<string>; edgeIds: Array<string> },
      mode?: 'replace' | 'add',
    ) => void
    endGesture: () => void
    getSelectedNodeIds: () => Array<string>
    getSelectedEdgeIds: () => Array<string>
  }>
}) {
  return createCanvasSelectionGestureSession({
    adapter: {
      kind: 'lasso',
      startGestureOnBegin: true,
      preview,
      clear,
    },
    getSelection: () => ({
      beginGesture: selection?.beginGesture ?? vi.fn(),
      commitGestureSelection: selection?.commitGestureSelection ?? vi.fn(),
      endGesture: selection?.endGesture ?? vi.fn(),
      getSelectedNodeIds: selection?.getSelectedNodeIds ?? (() => []),
      getSelectedEdgeIds: selection?.getSelectedEdgeIds ?? (() => []),
    }),
    interaction: interaction ?? {
      suppressNextSurfaceClick: vi.fn(),
    },
    requestAnimationFrame,
    cancelAnimationFrame,
  })
}
