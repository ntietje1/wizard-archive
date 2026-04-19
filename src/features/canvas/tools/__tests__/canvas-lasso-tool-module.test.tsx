import { describe, expect, it, vi } from 'vitest'
import { lassoToolModule } from '../lasso-tool-module'
import type { CanvasMeasuredNode, CanvasToolEnvironment, CanvasToolId } from '../canvas-tool-types'
import type { SelectingState } from '../../utils/canvas-awareness-types'

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
    target,
    ...overrides,
  } as PointerEvent
}

describe('lassoToolModule', () => {
  it('selects measured nodes enclosed by the lasso path', () => {
    const clearSelection = vi.fn()
    const setNodeSelection = vi.fn()
    const setActiveTool = vi.fn()
    const setLassoPath = vi.fn()
    const setLocalSelecting = vi.fn()

    const runtime = createLassoEnvironment({
      getMeasuredNodes: () => [
        {
          id: 'embed-1',
          type: 'embed',
          position: { x: 20, y: 20 },
          width: 40,
          height: 40,
          data: {},
        },
      ],
      setNodeSelection,
      clearSelection,
      setLassoPath,
      setLocalSelecting,
      setActiveTool,
    })

    const controller = lassoToolModule.create(runtime)
    const target = createPointerTarget()

    controller.onPointerDown?.(createPointerEvent(target, { clientX: 0, clientY: 0 }))
    controller.onPointerMove?.(createPointerEvent(target, { clientX: 100, clientY: 0 }))
    controller.onPointerMove?.(createPointerEvent(target, { clientX: 100, clientY: 100 }))
    controller.onPointerMove?.(createPointerEvent(target, { clientX: 0, clientY: 100 }))
    controller.onPointerUp?.(createPointerEvent(target, { clientX: 0, clientY: 0 }))

    expect(clearSelection).toHaveBeenCalledTimes(1)
    expect(setLassoPath).toHaveBeenCalledTimes(5)
    expect(setLassoPath).toHaveBeenLastCalledWith([])
    expect(setLocalSelecting).toHaveBeenCalledWith(expect.objectContaining({ type: 'lasso' }))
    expect(setLocalSelecting).toHaveBeenLastCalledWith(null)
    expect(setNodeSelection).toHaveBeenCalledWith(['embed-1'])
    expect(setActiveTool).toHaveBeenCalledWith('select')
    expect(target.setPointerCapture).toHaveBeenCalledWith(1)
    expect(target.releasePointerCapture).toHaveBeenCalledWith(1)
  })

  it('publishes a fresh local lasso path array on each pointer update so the local overlay rerenders', () => {
    const setLassoPath = vi.fn()
    const controller = lassoToolModule.create(
      createLassoEnvironment({
        getMeasuredNodes: () => [],
        clearSelection: vi.fn(),
        setNodeSelection: vi.fn(),
        setLassoPath,
        setLocalSelecting: vi.fn(),
        setActiveTool: vi.fn(),
      }),
    )
    const target = createPointerTarget()

    controller.onPointerDown?.(createPointerEvent(target, { clientX: 0, clientY: 0 }))
    controller.onPointerMove?.(createPointerEvent(target, { clientX: 100, clientY: 0 }))
    controller.onPointerMove?.(createPointerEvent(target, { clientX: 100, clientY: 100 }))

    const firstPath = setLassoPath.mock.calls[0]?.[0]
    const secondPath = setLassoPath.mock.calls[1]?.[0]
    const thirdPath = setLassoPath.mock.calls[2]?.[0]

    expect(firstPath).toEqual([{ x: 0, y: 0 }])
    expect(secondPath).toEqual([
      { x: 0, y: 0 },
      { x: 100, y: 0 },
    ])
    expect(thirdPath).toEqual([
      { x: 0, y: 0 },
      { x: 100, y: 0 },
      { x: 100, y: 100 },
    ])
    expect(secondPath).not.toBe(firstPath)
    expect(thirdPath).not.toBe(secondPath)
  })

  it('clears selection when no measured nodes fall inside the lasso', () => {
    const setNodeSelection = vi.fn()
    const controller = lassoToolModule.create(
      createLassoEnvironment({
        getMeasuredNodes: () => [
          {
            id: 'outside-node',
            type: 'embed',
            position: { x: 200, y: 200 },
            width: 40,
            height: 40,
            data: {},
          },
        ],
        clearSelection: vi.fn(),
        setNodeSelection,
        setLassoPath: vi.fn(),
        setLocalSelecting: vi.fn(),
        setActiveTool: vi.fn(),
      }),
    )
    const target = createPointerTarget()

    controller.onPointerDown?.(createPointerEvent(target, { clientX: 0, clientY: 0 }))
    controller.onPointerMove?.(createPointerEvent(target, { clientX: 100, clientY: 0 }))
    controller.onPointerMove?.(createPointerEvent(target, { clientX: 100, clientY: 100 }))
    controller.onPointerMove?.(createPointerEvent(target, { clientX: 0, clientY: 100 }))
    controller.onPointerUp?.(createPointerEvent(target, { clientX: 0, clientY: 0 }))

    expect(setNodeSelection).toHaveBeenCalledWith([])
  })

  it('selects only the measured nodes that are fully enclosed by the lasso', () => {
    const setNodeSelection = vi.fn()
    const controller = lassoToolModule.create(
      createLassoEnvironment({
        getMeasuredNodes: () => [
          {
            id: 'inside-node',
            type: 'embed',
            position: { x: 20, y: 20 },
            width: 40,
            height: 40,
            data: {},
          },
          {
            id: 'outside-node',
            type: 'embed',
            position: { x: 200, y: 200 },
            width: 40,
            height: 40,
            data: {},
          },
          {
            id: 'partially-outside-node',
            type: 'embed',
            position: { x: 80, y: 80 },
            width: 40,
            height: 40,
            data: {},
          },
        ],
        clearSelection: vi.fn(),
        setNodeSelection,
        setLassoPath: vi.fn(),
        setLocalSelecting: vi.fn(),
        setActiveTool: vi.fn(),
      }),
    )
    const target = createPointerTarget()

    controller.onPointerDown?.(createPointerEvent(target, { clientX: 0, clientY: 0 }))
    controller.onPointerMove?.(createPointerEvent(target, { clientX: 100, clientY: 0 }))
    controller.onPointerMove?.(createPointerEvent(target, { clientX: 100, clientY: 100 }))
    controller.onPointerMove?.(createPointerEvent(target, { clientX: 0, clientY: 100 }))
    controller.onPointerUp?.(createPointerEvent(target, { clientX: 0, clientY: 0 }))

    expect(setNodeSelection).toHaveBeenCalledWith(['inside-node'])
  })
})

function createLassoEnvironment({
  getMeasuredNodes,
  clearSelection,
  setNodeSelection,
  setLassoPath,
  setLocalSelecting,
  setActiveTool,
}: {
  getMeasuredNodes: () => Array<CanvasMeasuredNode>
  clearSelection: () => void
  setNodeSelection: (nodeIds: Array<string>) => void
  setLassoPath: (path: Array<{ x: number; y: number }>) => void
  setLocalSelecting: (selecting: SelectingState | null) => void
  setActiveTool: (tool: CanvasToolId) => void
}): CanvasToolEnvironment {
  return {
    viewport: {
      screenToFlowPosition: ({ x, y }) => ({ x, y }),
      getZoom: () => 1,
    },
    document: {
      createNode: () => undefined,
      updateNode: () => undefined,
      updateNodeData: () => undefined,
      resizeNode: () => undefined,
      deleteNodes: () => undefined,
      createEdge: () => undefined,
      deleteEdges: () => undefined,
      setNodePosition: () => undefined,
      getNodes: () => [],
      getEdges: () => [],
      getMeasuredNodes,
    },
    selection: {
      setNodeSelection,
      clearSelection,
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
      getActiveTool: () => 'lasso',
      setActiveTool,
      setStrokeColor: () => undefined,
      setStrokeSize: () => undefined,
      setStrokeOpacity: () => undefined,
    },
    interaction: {
      setLocalDrawing: () => undefined,
      setLassoPath,
      setSelectionDragRect: () => undefined,
      setErasingStrokeIds: () => undefined,
      setRectDeselectedIds: () => undefined,
    },
    awareness: {
      setLocalCursor: () => undefined,
      setLocalDragging: () => undefined,
      setLocalResizing: () => undefined,
      setLocalSelection: () => undefined,
      setLocalDrawing: () => undefined,
      setLocalSelecting,
    },
  }
}
