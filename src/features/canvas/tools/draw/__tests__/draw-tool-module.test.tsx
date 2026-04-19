import { describe, expect, it, vi } from 'vitest'
import { drawToolModule } from '../draw-tool-module'
import {
  clearDrawToolLocalOverlay,
  useDrawToolLocalOverlayStore,
} from '../draw-tool-local-overlay'
import type { CanvasToolEnvironment } from '../../canvas-tool-types'

type MockPointerTarget = HTMLDivElement & {
  setPointerCapture: (pointerId: number) => void
  releasePointerCapture: (pointerId: number) => void
}

function createPointerTarget() {
  const target = document.createElement('div') as unknown as MockPointerTarget
  target.setPointerCapture = vi.fn()
  target.releasePointerCapture = vi.fn()
  return target
}

function createPointerEvent(
  target: Element,
  overrides: Partial<PointerEvent> & { clientX: number; clientY: number },
): PointerEvent {
  return {
    button: 0,
    buttons: 1,
    pointerId: 1,
    pressure: 0.5,
    target,
    ...overrides,
  } as PointerEvent
}

describe('drawToolModule', () => {
  it('publishes and clears tool.draw awareness while drawing', () => {
    const createNode = vi.fn()
    const setPresence = vi.fn()
    clearDrawToolLocalOverlay()
    const controller = drawToolModule.create(
      createDrawEnvironment({
        createNode,
        setPresence,
      }),
    )
    const target = createPointerTarget()

    controller.onPointerDown?.(createPointerEvent(target, { clientX: 0, clientY: 0 }))
    expect(useDrawToolLocalOverlayStore.getState().localDrawing).toEqual(
      expect.objectContaining({
        points: [[0, 0, 0.5]],
      }),
    )

    controller.onPointerMove?.(createPointerEvent(target, { clientX: 20, clientY: 20 }))
    expect(useDrawToolLocalOverlayStore.getState().localDrawing).toEqual(
      expect.objectContaining({
        points: [
          [0, 0, 0.5],
          [20, 20, 0.5],
        ],
      }),
    )

    controller.onPointerUp?.(createPointerEvent(target, { clientX: 20, clientY: 20 }))

    expect(setPresence).toHaveBeenCalledWith(
      'tool.draw',
      expect.objectContaining({
        points: [[0, 0, 0.5]],
      }),
    )
    expect(setPresence).toHaveBeenCalledWith(
      'tool.draw',
      expect.objectContaining({
        points: [
          [0, 0, 0.5],
          [20, 20, 0.5],
        ],
      }),
    )
    expect(setPresence).toHaveBeenLastCalledWith('tool.draw', null)
    expect(useDrawToolLocalOverlayStore.getState().localDrawing).toBeNull()
    expect(createNode).toHaveBeenCalledTimes(1)
  })
})

function createDrawEnvironment({
  createNode,
  setPresence,
}: {
  createNode: (node: unknown) => void
  setPresence: (namespace: string, value: unknown) => void
}): CanvasToolEnvironment {
  return {
    viewport: {
      screenToFlowPosition: ({ x, y }) => ({ x, y }),
      getZoom: () => 1,
    },
    document: {
      createNode,
      updateNode: () => undefined,
      updateNodeData: () => undefined,
      resizeNode: () => undefined,
      deleteNodes: () => undefined,
      createEdge: () => undefined,
      deleteEdges: () => undefined,
      setNodePosition: () => undefined,
      getNodes: () => [],
      getEdges: () => [],
      getMeasuredNodes: () => [],
    },
    selection: {
      setNodeSelection: () => undefined,
      clearSelection: () => undefined,
      getSelectedNodeIds: () => [],
    },
    editSession: {
      editingEmbedId: null,
      setEditingEmbedId: () => undefined,
      pendingEditNodeId: null,
      setPendingEditNodeId: () => undefined,
    },
    toolState: {
      getSettings: () => ({
        strokeColor: 'var(--foreground)',
        strokeOpacity: 100,
        strokeSize: 4,
      }),
      getActiveTool: () => 'draw',
      setActiveTool: () => undefined,
      setStrokeColor: () => undefined,
      setStrokeSize: () => undefined,
      setStrokeOpacity: () => undefined,
    },
    awareness: {
      core: {
        setLocalCursor: () => undefined,
        setLocalDragging: () => undefined,
        setLocalResizing: () => undefined,
        setLocalSelection: () => undefined,
      },
      presence: {
        setPresence,
      },
    },
  }
}
