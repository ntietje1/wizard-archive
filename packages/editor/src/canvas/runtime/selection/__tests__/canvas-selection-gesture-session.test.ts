import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test'
import { createCanvasSelectionGestureSession } from '../canvas-selection-gesture-session'
import { createCanvasSelectionGestureController } from '../canvas-selection-gesture-controller'
import type {
  CanvasSelectionCommitMode,
  CanvasSelectionSnapshot,
} from '../../../system/canvas-selection'

let pendingPreview: CanvasSelectionSnapshot | null = null

describe('createCanvasSelectionGestureSession', () => {
  const rafCallbacks = new Map<number, FrameRequestCallback>()
  let nextRafId = 1

  beforeEach(() => {
    pendingPreview = null
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
        getSnapshot: () => ({
          nodeIds: new Set(['existing-node']),
          edgeIds: new Set(['existing-edge']),
        }),
      },
      preview: () => ({
        nodeIds: new Set(['next-node']),
        edgeIds: new Set<string>(),
      }),
    })

    session.begin({ value: 'start' }, 'add')
    session.update({ value: 'updated' })
    flushAnimationFrame()

    expect(pendingPreview).toEqual({
      nodeIds: new Set(['existing-node', 'next-node']),
      edgeIds: new Set(['existing-edge']),
    })
  })

  it('commits the last preview, clears pending preview state, and ends the gesture', () => {
    const commitGesture = vi.fn()
    const suppressNextSurfaceClick = vi.fn()
    const clear = vi.fn()

    const session = createSession({
      clear,
      interaction: { suppressNextSurfaceClick },
      preview: () => ({
        nodeIds: new Set(['node-1']),
        edgeIds: new Set(['edge-1']),
      }),
      selection: {
        commitGesture,
      },
    })

    session.begin({ value: 'start' }, 'replace')
    session.update({ value: 'updated' })
    flushAnimationFrame()

    expect(pendingPreview).toEqual({
      nodeIds: new Set(['node-1']),
      edgeIds: new Set(['edge-1']),
    })

    session.commit({ value: 'final' })

    expect(commitGesture).toHaveBeenCalledTimes(1)
    expect(suppressNextSurfaceClick).toHaveBeenCalledTimes(1)
    expect(clear).toHaveBeenCalledTimes(1)
  })

  it('commits the release-time preview selection', () => {
    const commitGesture = vi.fn()
    const preview = vi
      .fn()
      .mockReturnValueOnce({
        nodeIds: new Set(['previewed-node']),
        edgeIds: new Set(['previewed-edge']),
      })
      .mockReturnValueOnce({
        nodeIds: new Set(['final-node']),
        edgeIds: new Set(['final-edge']),
      })

    const session = createSession({
      preview,
      selection: {
        commitGesture,
      },
    })

    session.begin({ value: 'start' }, 'replace')
    session.update({ value: 'previewed' })
    flushAnimationFrame()
    session.commit({ value: 'final' })

    expect(preview).toHaveBeenCalledTimes(2)
    expect(preview).toHaveBeenLastCalledWith({ value: 'final' })
    expect(pendingPreview).toEqual({
      nodeIds: new Set(['final-node']),
      edgeIds: new Set(['final-edge']),
    })
    expect(commitGesture).toHaveBeenCalledTimes(1)
  })

  it('suppresses the surface click when a started gesture cancels after an empty release preview', () => {
    const cancelGesture = vi.fn()
    const suppressNextSurfaceClick = vi.fn()
    const session = createSession({
      interaction: { suppressNextSurfaceClick },
      preview: () => null,
      selection: {
        cancelGesture,
      },
    })

    session.begin({ value: 'start' }, 'replace')
    session.update({ value: 'previewed' })
    flushAnimationFrame()
    const committed = session.commit({ value: 'final' })

    expect(committed).toBe(false)
    expect(suppressNextSurfaceClick).toHaveBeenCalledTimes(1)
    expect(cancelGesture).toHaveBeenCalledTimes(1)
  })

  it('flushes pending preview state before committing', () => {
    const commitGesture = vi.fn()
    const preview = vi.fn(({ value }: { value: string }) => ({
      nodeIds: new Set([`${value}-node`]),
      edgeIds: new Set<string>(),
    }))

    const session = createSession({
      preview,
      selection: {
        commitGesture,
      },
    })

    session.begin({ value: 'start' }, 'replace')
    session.update({ value: 'rendered' })
    flushAnimationFrame()
    session.update({ value: 'pending' })
    session.commit({ value: 'final' })

    expect(preview).toHaveBeenCalledTimes(2)
    expect(preview).toHaveBeenLastCalledWith({ value: 'final' })
    expect(pendingPreview).toEqual({
      nodeIds: new Set(['final-node']),
      edgeIds: new Set<string>(),
    })
    expect(commitGesture).toHaveBeenCalledTimes(1)
    expect(cancelAnimationFrame).toHaveBeenCalledTimes(1)
  })

  it('clears local state on cancel and dispose without committing selection', () => {
    const commitGesture = vi.fn()
    const cancelGesture = vi.fn()
    const clear = vi.fn()

    const session = createSession({
      clear,
      preview: () => ({
        nodeIds: new Set(['node-1']),
        edgeIds: new Set<string>(),
      }),
      selection: {
        commitGesture,
        cancelGesture,
      },
    })

    session.begin({ value: 'start' }, 'replace')
    session.update({ value: 'updated' })
    flushAnimationFrame()
    session.cancel()

    expect(commitGesture).not.toHaveBeenCalled()
    expect(cancelGesture).toHaveBeenCalledTimes(1)
    expect(clear).toHaveBeenCalledTimes(1)

    session.begin({ value: 'start-again' }, 'replace')
    session.dispose()

    expect(commitGesture).not.toHaveBeenCalled()
    expect(cancelGesture).toHaveBeenCalledTimes(2)
    expect(clear).toHaveBeenCalledTimes(2)
  })
})

describe('createCanvasSelectionGestureController', () => {
  it('commits the release-position state when pointerup changes selection bounds', () => {
    const commitGesture = vi.fn()
    const setGesturePreview = vi.fn()
    const controller = createCanvasSelectionGestureController({
      strategy: {
        kind: 'marquee',
        createInitialState: (input) => ({ points: [input.clientPoint] }),
        updateState: (state, input) => ({ points: [...state.points, input.clientPoint] }),
        refreshState: (state) => state,
        preview: (state) => ({
          nodeIds: new Set([`${state.points.at(-1)?.x ?? 0}`]),
          edgeIds: new Set<string>(),
        }),
        clear: vi.fn(),
      },
      getSelection: () => ({
        beginGesture: vi.fn(),
        cancelGesture: vi.fn(),
        commitGesture,
        getSnapshot: () => ({ nodeIds: new Set<string>(), edgeIds: new Set<string>() }),
        setGesturePreview,
      }),
      interaction: { suppressNextSurfaceClick: vi.fn() },
      requestAnimationFrame,
      cancelAnimationFrame,
    })

    controller.begin(
      { clientPoint: { x: 0, y: 0 }, canvasPoint: { x: 0, y: 0 }, square: false },
      'replace',
    )
    controller.update({
      clientPoint: { x: 10, y: 0 },
      canvasPoint: { x: 10, y: 0 },
      square: false,
    })
    controller.commit({
      clientPoint: { x: 20, y: 0 },
      canvasPoint: { x: 20, y: 0 },
      square: false,
    })

    expect(setGesturePreview).toHaveBeenLastCalledWith({
      nodeIds: new Set(['20']),
      edgeIds: new Set<string>(),
    })
    expect(commitGesture).toHaveBeenCalledTimes(1)
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
  preview: (state: { value: string }) => CanvasSelectionSnapshot | null
  selection?: Partial<{
    beginGesture: (kind: 'marquee' | 'lasso', mode: CanvasSelectionCommitMode) => void
    cancelGesture: () => void
    commitGesture: () => void
    getSnapshot: () => CanvasSelectionSnapshot
    setGesturePreview: (selection: CanvasSelectionSnapshot | null) => void
  }>
}) {
  const startSelection = selection?.getSnapshot?.() ?? {
    nodeIds: new Set<string>(),
    edgeIds: new Set<string>(),
  }

  return createCanvasSelectionGestureSession({
    adapter: {
      kind: 'lasso',
      startGestureOnBegin: true,
      preview,
      clear,
    },
    getSelection: () => ({
      beginGesture: selection?.beginGesture ?? vi.fn(),
      cancelGesture: selection?.cancelGesture ?? vi.fn(),
      commitGesture: selection?.commitGesture ?? vi.fn(),
      getSnapshot: selection?.getSnapshot ?? (() => startSelection),
      setGesturePreview:
        selection?.setGesturePreview ??
        ((selectionPreview) => {
          pendingPreview = selectionPreview
        }),
    }),
    interaction: interaction ?? {
      suppressNextSurfaceClick: vi.fn(),
    },
    requestAnimationFrame,
    cancelAnimationFrame,
  })
}
