import { afterEach, describe, expect, it, vi } from 'vitest'
import { eraseToolSpec } from '../erase-tool-module'
import { clearEraseToolLocalOverlay } from '../erase-tool-local-overlay'
import type { CanvasToolRuntime } from '../../canvas-tool-types'
import type { CanvasDocumentNode } from 'convex/canvases/validation'

type PointerTarget = HTMLDivElement & {
  setPointerCapture: (pointerId: number) => void
  releasePointerCapture: (pointerId: number) => void
}

describe('eraseToolSpec', () => {
  afterEach(() => {
    clearEraseToolLocalOverlay()
  })

  it('deletes only stroke nodes intersected by the erase trail', () => {
    const deleteNodes = vi.fn()
    const controller = eraseToolSpec.createHandlers(
      createEraseRuntime({
        deleteNodes,
        nodes: [
          createStrokeNode('hit-stroke', [
            [10, 10, 0.5],
            [100, 10, 0.5],
          ]),
          createStrokeNode('missed-stroke', [
            [10, 120, 0.5],
            [100, 120, 0.5],
          ]),
          {
            id: 'text-node',
            type: 'text',
            position: { x: 0, y: 0 },
            data: {},
          },
        ],
      }),
    )
    const target = createPointerTarget()

    controller.onPointerDown?.(createPointerEvent(target, { clientX: 40, clientY: 0 }))
    controller.onPointerMove?.(createPointerEvent(target, { clientX: 40, clientY: 40 }))
    controller.onPointerUp?.(createPointerEvent(target, { clientX: 40, clientY: 40 }))

    expect(deleteNodes).toHaveBeenCalledWith(new Set(['hit-stroke']))
  })

  it('releases pointer capture and does not delete on cancel', () => {
    const deleteNodes = vi.fn()
    const controller = eraseToolSpec.createHandlers(
      createEraseRuntime({
        deleteNodes,
        nodes: [
          createStrokeNode('hit-stroke', [
            [10, 10, 0.5],
            [100, 10, 0.5],
          ]),
        ],
      }),
    )
    const target = createPointerTarget()

    controller.onPointerDown?.(createPointerEvent(target, { clientX: 40, clientY: 0 }))
    controller.onPointerMove?.(createPointerEvent(target, { clientX: 40, clientY: 40 }))
    controller.onPointerCancel?.(createPointerEvent(target, { clientX: 40, clientY: 40 }))

    expect(deleteNodes).not.toHaveBeenCalled()
    expect(target.releasePointerCapture).toHaveBeenCalledWith(1)
  })
})

function createEraseRuntime({
  deleteNodes,
  nodes,
}: {
  deleteNodes: (nodeIds: ReadonlySet<string>) => void
  nodes: Array<CanvasDocumentNode>
}): CanvasToolRuntime {
  return {
    viewport: {
      screenToCanvasPosition: ({ x, y }) => ({ x, y }),
      getZoom: () => 1,
    },
    commands: {
      createNode: () => undefined,
      patchNodeData: () => undefined,
      patchEdges: () => undefined,
      resizeNode: () => undefined,
      resizeNodes: () => undefined,
      deleteNodes,
      createEdge: () => undefined,
      deleteEdges: () => undefined,
      setNodePositions: () => undefined,
    },
    query: {
      getNodes: () => nodes,
      getEdges: () => [],
      getMeasuredNodes: () => [],
    },
    selection: {
      getSnapshot: () => ({ nodeIds: new Set<string>(), edgeIds: new Set<string>() }),
      setSelection: () => undefined,
      clearSelection: () => undefined,
      toggleNode: () => undefined,
      toggleEdge: () => undefined,
      beginGesture: () => undefined,
      setGesturePreview: () => undefined,
      commitGesture: () => undefined,
      cancelGesture: () => undefined,
    },
    interaction: {
      suppressNextSurfaceClick: () => undefined,
    },
    modifiers: {
      getShiftPressed: () => false,
      getPrimaryPressed: () => false,
    },
    editSession: {
      editingEmbedId: null,
      setEditingEmbedId: () => undefined,
      pendingEditNodeId: null,
      pendingEditNodePoint: null,
      setPendingEditNodeId: () => undefined,
      setPendingEditNodePoint: () => undefined,
    },
    toolState: {
      getSettings: () => ({
        edgeType: 'bezier',
        strokeColor: 'var(--foreground)',
        strokeOpacity: 100,
        strokeSize: 4,
      }),
      getActiveTool: () => 'erase',
      setActiveTool: () => undefined,
      setEdgeType: () => undefined,
      setStrokeColor: () => undefined,
      setStrokeSize: () => undefined,
      setStrokeOpacity: () => undefined,
    },
    awareness: {
      core: {
        setLocalCursor: () => undefined,
        setLocalResizing: () => undefined,
        setLocalSelection: () => undefined,
      },
      presence: {
        setPresence: () => undefined,
      },
    },
  }
}

function createStrokeNode(id: string, points: Array<[number, number, number]>): CanvasDocumentNode {
  return {
    id,
    type: 'stroke',
    position: { x: 0, y: 0 },
    width: 120,
    height: 40,
    data: {
      points,
      color: '#000',
      size: 8,
      opacity: 100,
      bounds: { x: 0, y: 0, width: 120, height: 40 },
    },
  }
}

function createPointerTarget() {
  const target = document.createElement('div') as PointerTarget
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
    target,
    ...overrides,
  } as PointerEvent
}
