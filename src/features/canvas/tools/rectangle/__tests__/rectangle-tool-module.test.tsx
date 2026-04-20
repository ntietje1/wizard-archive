import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { rectangleToolModule } from '../rectangle-tool-module'
import type { CanvasToolServices } from '../../canvas-tool-types'
import { useRectangleToolLocalOverlayStore } from '../rectangle-tool-local-overlay'

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

describe('rectangleToolModule', () => {
  beforeEach(() => {
    vi.stubGlobal('requestAnimationFrame', ((callback: FrameRequestCallback) => {
      callback(0)
      return 1
    }) as typeof requestAnimationFrame)
    vi.stubGlobal('cancelAnimationFrame', vi.fn())
    useRectangleToolLocalOverlayStore.getState().reset()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    useRectangleToolLocalOverlayStore.getState().reset()
  })

  it('creates a square when shift is held during rectangle creation', () => {
    const createNode = vi.fn()
    const replaceNodes = vi.fn()
    const controller = rectangleToolModule.create(
      createRectangleEnvironment({
        createNode,
        replaceNodes,
        getShiftPressed: () => true,
      }),
    )
    const target = createPointerTarget()

    controller.onPointerDown?.(createPointerEvent(target, { clientX: 10, clientY: 10 }))
    controller.onPointerMove?.(createPointerEvent(target, { clientX: 50, clientY: 20 }))
    controller.onPointerUp?.(createPointerEvent(target, { clientX: 50, clientY: 20 }))

    expect(createNode).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'rectangle',
        position: { x: 10, y: 10 },
        width: 10,
        height: 10,
      }),
    )
    expect(replaceNodes).toHaveBeenCalledTimes(1)
  })

  it('updates the live rectangle immediately when shift is pressed and released mid-drag', () => {
    let shiftPressed = false
    const controller = rectangleToolModule.create(
      createRectangleEnvironment({
        createNode: vi.fn(),
        replaceNodes: vi.fn(),
        getShiftPressed: () => shiftPressed,
      }),
    )
    const target = createPointerTarget()

    controller.onPointerDown?.(createPointerEvent(target, { clientX: 10, clientY: 10 }))
    controller.onPointerMove?.(createPointerEvent(target, { clientX: 50, clientY: 20 }))

    expect(useRectangleToolLocalOverlayStore.getState().dragRect).toEqual({
      x: 10,
      y: 10,
      width: 40,
      height: 10,
    })

    shiftPressed = true
    controller.onKeyDown?.(new KeyboardEvent('keydown', { key: 'Shift' }))

    expect(useRectangleToolLocalOverlayStore.getState().dragRect).toEqual({
      x: 10,
      y: 10,
      width: 10,
      height: 10,
    })

    shiftPressed = false
    controller.onKeyUp?.(new KeyboardEvent('keyup', { key: 'Shift' }))

    expect(useRectangleToolLocalOverlayStore.getState().dragRect).toEqual({
      x: 10,
      y: 10,
      width: 40,
      height: 10,
    })
  })
})

function createRectangleEnvironment({
  createNode,
  replaceNodes,
  getShiftPressed,
}: {
  createNode: (node: unknown) => void
  replaceNodes: (nodeIds: Array<string>) => void
  getShiftPressed: () => boolean
}): CanvasToolServices {
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
      replace: () => undefined,
      replaceNodes,
      replaceEdges: () => undefined,
      clear: () => undefined,
      getSelectedNodeIds: () => [],
      getSelectedEdgeIds: () => [],
      toggleNodeFromTarget: () => undefined,
      toggleEdgeFromTarget: () => undefined,
      beginGesture: () => undefined,
      commitGestureSelection: () => undefined,
      endGesture: () => undefined,
    },
    interaction: {
      suppressNextSurfaceClick: () => undefined,
    },
    modifiers: {
      getShiftPressed,
      getPrimaryPressed: () => false,
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
      getActiveTool: () => 'rectangle',
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
        setPresence: () => undefined,
      },
    },
  }
}
