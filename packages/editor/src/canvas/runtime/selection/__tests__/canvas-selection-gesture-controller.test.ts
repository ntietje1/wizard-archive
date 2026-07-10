import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test'
import {
  createCanvasSelectionGestureController,
  createLassoSelectionStrategy,
  createRectangleSelectionStrategy,
} from '../canvas-selection-gesture-controller'
import { createCanvasToolLocalOverlayStore } from '../../../stores/canvas-tool-local-overlay-store'
import type { CanvasSelectionSnapshot } from '../../../system/canvas-selection'

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

  it('commits the release-time preview', () => {
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
    const interaction = { suppressNextSurfaceClick: vi.fn() }
    const controller = createTestController({ interaction, selection, preview })

    controller.begin(createInput('start'), 'replace')
    controller.update(createInput('preview'))
    flushAnimationFrame()
    const committed = controller.commit(createInput('release'))

    expect(committed).toBe(true)
    expect(preview).toHaveBeenCalledTimes(2)
    expect(preview).toHaveBeenLastCalledWith({ value: '2' })
    expect(selection.commitGesture).toHaveBeenCalledTimes(1)
    expect(interaction.suppressNextSurfaceClick).toHaveBeenCalledTimes(1)
    expect(selection.setGesturePreview).toHaveBeenLastCalledWith({
      nodeIds: new Set(['release-node']),
      edgeIds: new Set(['release-edge']),
    })
  })

  it('cancels pending preview frames and clears strategy state', () => {
    const selection = createSelectionMock()
    const clear = vi.fn()
    const interaction = { suppressNextSurfaceClick: vi.fn() }
    const controller = createTestController({
      clear,
      interaction,
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
    expect(interaction.suppressNextSurfaceClick).toHaveBeenCalledTimes(1)
    expect(selection.cancelGesture).toHaveBeenCalledTimes(1)
    expect(selection.commitGesture).not.toHaveBeenCalled()
  })

  it('keeps rectangle pointer state isolated from caller-owned input objects', () => {
    const strategy = createRectangleSelectionStrategy({
      viewport: {
        getZoom: () => 1,
        screenToCanvasPosition: (position) => position,
      },
      getCanvasSnapshot: () => ({ nodes: [], edges: [], measuredNodes: [] }),
      getAwareness: () => ({ setPresence: vi.fn() }),
      localOverlay: createCanvasToolLocalOverlayStore().getState(),
    })
    const startInput = createInput('start')
    const initialState = strategy.createInitialState(startInput)
    startInput.clientPoint.x = 99
    const previewInput = createInput('preview')
    const nextState = strategy.updateState(initialState, previewInput)
    previewInput.clientPoint.x = 88

    expect(initialState.startClientPoint).toEqual({ x: 0, y: 0 })
    expect(initialState.currentClientPoint).toEqual({ x: 0, y: 0 })
    expect(nextState.startClientPoint).toEqual({ x: 0, y: 0 })
    expect(nextState.currentClientPoint).toEqual({ x: 1, y: 0 })
  })

  it('keeps lasso state updates immutable', () => {
    const strategy = createLassoSelectionStrategy({
      viewport: { getZoom: () => 1 },
      getCanvasSnapshot: () => ({ nodes: [], edges: [], measuredNodes: [] }),
      getAwareness: () => ({ setPresence: vi.fn() }),
      localOverlay: createCanvasToolLocalOverlayStore().getState(),
    })
    const startInput = createInput('start')
    const initialState = strategy.createInitialState(startInput)
    startInput.canvasPoint.x = 99
    const previewInput = createInput('preview')
    const nextState = strategy.updateState(initialState, previewInput)
    previewInput.canvasPoint.x = 88

    expect(nextState).not.toBe(initialState)
    expect(initialState.points).toEqual([{ x: 0, y: 0 }])
    expect(nextState.points).toEqual([
      { x: 0, y: 0 },
      { x: 1, y: 0 },
    ])
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
  interaction = { suppressNextSurfaceClick: vi.fn() },
  preview,
  selection = createSelectionMock(),
}: {
  clear?: () => void
  interaction?: { suppressNextSurfaceClick: () => void }
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
    interaction,
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

type InputToken = 'start' | 'updated' | 'pending' | 'preview' | 'release'

function createInput(value: InputToken) {
  const inputCoordinates: Record<InputToken, number> = {
    start: 0,
    updated: 2,
    pending: 2,
    preview: 1,
    release: 2,
  }
  const numericValue = inputCoordinates[value]
  return {
    canvasPoint: { x: numericValue, y: 0 },
    clientPoint: { x: numericValue, y: 0 },
    square: false,
  }
}
