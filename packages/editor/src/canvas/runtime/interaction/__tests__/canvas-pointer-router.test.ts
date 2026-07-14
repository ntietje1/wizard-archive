import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test'
import { testCanvasNodeId } from 'shared/test/canvas-node-id'
import { createCanvasPointerRouter } from '../canvas-pointer-router'
import { createCanvasToolLocalOverlayStore } from '../../../stores/canvas-tool-local-overlay-store'
import type { CanvasEngine } from '../../../system/canvas-engine-types'
import type { CanvasPointerRouterOptions } from '../canvas-pointer-router'
import type { CanvasToolHandlers, CanvasToolId } from '../../../tools/canvas-tool-types'
import type { CanvasSelectionSnapshot } from '../../../system/canvas-selection'
import type {
  CanvasDocumentEdge as Edge,
  CanvasDocumentNode as Node,
} from '../../../document-contract'
describe('createCanvasPointerRouter', () => {
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
    document.body.replaceChildren()
    vi.unstubAllGlobals()
  })

  it('runs rectangle selection from an empty pane and suppresses the following click', () => {
    const { surface, viewport } = createCanvasDom()
    const selection = createSelectionMock()
    const router = createCanvasPointerRouter()
    router.setOptions(
      createRouterOptions({
        activeTool: 'select',
        selection,
        nodes: [
          {
            id: testCanvasNodeId('node-1'),
            type: 'text',
            data: {},
            position: { x: 10, y: 10 },
            width: 80,
            height: 80,
          },
        ],
        nodeLookup: new Map([
          [
            testCanvasNodeId('node-1'),
            {
              node: {
                id: testCanvasNodeId('node-1'),
                type: 'text',
                data: {},
                position: { x: 10, y: 10 },
              },
              measured: { width: 80, height: 80 },
            },
          ],
        ]),
      }),
    )
    const detach = router.attach(surface)

    viewport.dispatchEvent(createPointerEvent('pointerdown', { clientX: 10, clientY: 10 }))
    window.dispatchEvent(createPointerEvent('pointermove', { clientX: 90, clientY: 90 }))
    flushAnimationFrame()
    window.dispatchEvent(createPointerEvent('pointerup', { clientX: 90, clientY: 90 }))
    const click = new MouseEvent('click', { bubbles: true, cancelable: true })
    viewport.dispatchEvent(click)

    expect(selection.beginGesture).toHaveBeenCalledWith('marquee', 'replace')
    expect(selection.setGesturePreview).toHaveBeenCalledWith({
      nodeIds: new Set([testCanvasNodeId('node-1')]),
      edgeIds: new Set(),
    })
    expect(selection.commitGesture).toHaveBeenCalledTimes(1)
    expect(click.defaultPrevented).toBe(true)

    detach()
  })

  it('cancels rectangle selections when the router is disabled', () => {
    const { surface, viewport } = createCanvasDom()
    const selection = createSelectionMock()
    const router = createCanvasPointerRouter()
    router.setOptions(
      createRouterOptions({
        activeTool: 'select',
        selection,
        nodes: [createMeasuredNode('node-1', 10, 10)],
        nodeLookup: new Map([
          [testCanvasNodeId('node-1'), createInternalNode(testCanvasNodeId('node-1'), 10, 10)],
        ]),
      }),
    )
    const detach = router.attach(surface)

    viewport.dispatchEvent(createPointerEvent('pointerdown', { clientX: 10, clientY: 10 }))
    window.dispatchEvent(createPointerEvent('pointermove', { clientX: 90, clientY: 90 }))
    flushAnimationFrame()
    router.setOptions(createRouterOptions({ activeTool: 'select', enabled: false, selection }))
    window.dispatchEvent(createPointerEvent('pointerup', { clientX: 90, clientY: 90 }))

    expect(selection.beginGesture).toHaveBeenCalledTimes(1)
    expect(selection.cancelGesture).toHaveBeenCalledTimes(1)
    expect(selection.commitGesture).not.toHaveBeenCalled()

    detach()
  })

  it('clears selection on select and lasso empty-pane clicks but preserves it for primary modifier clicks', () => {
    const { surface, viewport } = createCanvasDom()
    const selection = createSelectionMock()
    const router = createCanvasPointerRouter()
    router.setOptions(createRouterOptions({ activeTool: 'select', selection }))
    const detach = router.attach(surface)

    viewport.dispatchEvent(createPointerEvent('pointerdown', { clientX: 10, clientY: 10 }))
    window.dispatchEvent(createPointerEvent('pointerup', { clientX: 10, clientY: 10 }))
    expect(selection.clearSelection).toHaveBeenCalledTimes(1)

    router.setOptions(createRouterOptions({ activeTool: 'lasso', selection }))
    viewport.dispatchEvent(createPointerEvent('pointerdown', { clientX: 10, clientY: 10 }))
    window.dispatchEvent(createPointerEvent('pointerup', { clientX: 10, clientY: 10 }))
    expect(selection.clearSelection).toHaveBeenCalledTimes(2)

    viewport.dispatchEvent(
      createPointerEvent('pointerdown', { clientX: 10, clientY: 10, ctrlKey: true }),
    )
    window.dispatchEvent(
      createPointerEvent('pointerup', { clientX: 10, clientY: 10, ctrlKey: true }),
    )
    expect(selection.clearSelection).toHaveBeenCalledTimes(2)

    detach()
  })

  it('prevents native text selection while lassoing over node text', () => {
    const { surface, text } = createCanvasDom()
    const selection = createSelectionMock()
    const router = createCanvasPointerRouter()
    router.setOptions(createRouterOptions({ activeTool: 'lasso', selection }))
    const detach = router.attach(surface)

    text.dispatchEvent(createPointerEvent('pointerdown', { clientX: 0, clientY: 0 }))
    window.dispatchEvent(createPointerEvent('pointermove', { clientX: 50, clientY: 50 }))
    const selectStart = new Event('selectstart', { bubbles: true, cancelable: true })
    window.dispatchEvent(selectStart)

    expect(selectStart.defaultPrevented).toBe(true)

    window.dispatchEvent(createPointerEvent('pointercancel', { clientX: 50, clientY: 50 }))
    detach()
  })

  it('coalesces lasso previews and commits the cached rendered preview', () => {
    const { surface, node } = createCanvasDom()
    const selection = createSelectionMock({
      nodeIds: new Set(['existing-node']),
      edgeIds: new Set(['existing-edge']),
    })
    const localOverlayStore = createCanvasToolLocalOverlayStore()
    const router = createCanvasPointerRouter()
    router.setOptions(
      createRouterOptions({
        activeTool: 'lasso',
        localOverlay: localOverlayStore.getState(),
        selection,
        nodes: [
          createMeasuredNode('inside-node', 20, 20),
          createMeasuredNode('outside-node', 200, 200),
        ],
        nodeLookup: new Map([
          [
            testCanvasNodeId('inside-node'),
            createInternalNode(testCanvasNodeId('inside-node'), 20, 20),
          ],
          [
            testCanvasNodeId('outside-node'),
            createInternalNode(testCanvasNodeId('outside-node'), 200, 200),
          ],
        ]),
      }),
    )
    const detach = router.attach(surface)

    node.dispatchEvent(createPointerEvent('pointerdown', { clientX: 0, clientY: 0, ctrlKey: true }))
    window.dispatchEvent(createPointerEvent('pointermove', { clientX: 100, clientY: 0 }))
    window.dispatchEvent(createPointerEvent('pointermove', { clientX: 100, clientY: 100 }))
    window.dispatchEvent(createPointerEvent('pointermove', { clientX: 0, clientY: 100 }))

    expect(requestAnimationFrame).toHaveBeenCalledTimes(1)
    expect(selection.setGesturePreview).not.toHaveBeenCalled()
    expect(localOverlayStore.getState().lassoPoints).toEqual([
      { x: 0, y: 0 },
      { x: 100, y: 0 },
      { x: 100, y: 100 },
      { x: 0, y: 100 },
    ])

    flushAnimationFrame()
    window.dispatchEvent(createPointerEvent('pointermove', { clientX: -20, clientY: 50 }))
    window.dispatchEvent(createPointerEvent('pointerup', { clientX: -20, clientY: 50 }))

    expect(selection.beginGesture).toHaveBeenCalledWith('lasso', 'add')
    expect(selection.setGesturePreview).toHaveBeenCalledWith({
      nodeIds: new Set(['existing-node', testCanvasNodeId('inside-node')]),
      edgeIds: new Set(['existing-edge']),
    })
    expect(selection.commitGesture).toHaveBeenCalledTimes(1)
    expect(cancelAnimationFrame).toHaveBeenCalledTimes(1)

    detach()
  })

  it('returns to the pointer tool when a lasso gesture finishes', () => {
    const { surface, node } = createCanvasDom()
    const setActiveTool = vi.fn()
    const router = createCanvasPointerRouter()
    router.setOptions(createRouterOptions({ activeTool: 'lasso', setActiveTool }))
    const detach = router.attach(surface)

    node.dispatchEvent(createPointerEvent('pointerdown', { clientX: 0, clientY: 0 }))
    window.dispatchEvent(createPointerEvent('pointermove', { clientX: 100, clientY: 0 }))
    window.dispatchEvent(createPointerEvent('pointerup', { clientX: 100, clientY: 100 }))

    expect(setActiveTool).toHaveBeenCalledExactlyOnceWith('select')

    detach()
  })

  it('routes non-selection tool gestures through fixed handlers for the whole gesture', () => {
    const { surface, viewport } = createCanvasDom()
    const initialHandlers: CanvasToolHandlers = {
      onPointerDown: vi.fn(),
      onPointerMove: vi.fn(),
      onPointerUp: vi.fn(),
    }
    const replacementHandlers: CanvasToolHandlers = {
      onPointerDown: vi.fn(),
      onPointerMove: vi.fn(),
      onPointerUp: vi.fn(),
    }
    const router = createCanvasPointerRouter()
    router.setOptions(
      createRouterOptions({ activeTool: 'draw', activeToolHandlers: initialHandlers }),
    )
    const detach = router.attach(surface)

    viewport.dispatchEvent(createPointerEvent('pointerdown', { pointerId: 7 }))
    router.setOptions(
      createRouterOptions({ activeTool: 'draw', activeToolHandlers: replacementHandlers }),
    )
    window.dispatchEvent(createPointerEvent('pointermove', { pointerId: 7 }))
    window.dispatchEvent(createPointerEvent('pointerup', { pointerId: 7 }))

    expect(initialHandlers.onPointerDown).toHaveBeenCalledTimes(1)
    expect(initialHandlers.onPointerMove).toHaveBeenCalledTimes(1)
    expect(initialHandlers.onPointerUp).toHaveBeenCalledTimes(1)
    expect(replacementHandlers.onPointerMove).not.toHaveBeenCalled()

    detach()
  })

  it('cancels active tool gestures when the router is disabled', () => {
    const { surface, viewport } = createCanvasDom()
    const activeToolHandlers: CanvasToolHandlers = {
      onPointerCancel: vi.fn(),
      onPointerDown: vi.fn(),
      onPointerMove: vi.fn(),
      onPointerUp: vi.fn(),
    }
    const router = createCanvasPointerRouter()
    router.setOptions(createRouterOptions({ activeTool: 'draw', activeToolHandlers }))
    const detach = router.attach(surface)

    viewport.dispatchEvent(createPointerEvent('pointerdown', { pointerId: 7 }))
    router.setOptions(
      createRouterOptions({ activeTool: 'draw', activeToolHandlers, enabled: false }),
    )
    window.dispatchEvent(createPointerEvent('pointermove', { pointerId: 7 }))
    window.dispatchEvent(createPointerEvent('pointerup', { pointerId: 7 }))

    expect(activeToolHandlers.onPointerDown).toHaveBeenCalledTimes(1)
    expect(activeToolHandlers.onPointerCancel).toHaveBeenCalledTimes(1)
    expect(activeToolHandlers.onPointerMove).not.toHaveBeenCalled()
    expect(activeToolHandlers.onPointerUp).not.toHaveBeenCalled()

    detach()
  })

  it('routes select-tool node drags through the node drag controller', () => {
    const { surface, node } = createCanvasDom()
    const nodeDragController = createNodeDragControllerMock()
    const router = createCanvasPointerRouter()
    router.setOptions(createRouterOptions({ activeTool: 'select', nodeDragController }))
    const detach = router.attach(surface)

    node.dispatchEvent(createPointerEvent('pointerdown', { pointerId: 7 }))
    window.dispatchEvent(createPointerEvent('pointermove', { clientX: 10, pointerId: 8 }))
    window.dispatchEvent(createPointerEvent('pointerup', { clientX: 10, pointerId: 8 }))
    window.dispatchEvent(createPointerEvent('pointermove', { clientX: 20, pointerId: 7 }))
    window.dispatchEvent(createPointerEvent('pointerup', { clientX: 20, pointerId: 7 }))

    expect(nodeDragController.begin).toHaveBeenCalledWith(
      testCanvasNodeId('node-1'),
      expect.any(Event),
    )
    expect(nodeDragController.update).toHaveBeenCalledTimes(1)
    expect(nodeDragController.commit).toHaveBeenCalledTimes(1)
    expect(nodeDragController.cancel).not.toHaveBeenCalled()

    detach()
  })

  it('cancels select-tool node drags when the router is disabled', () => {
    const { surface, node } = createCanvasDom()
    const nodeDragController = createNodeDragControllerMock()
    const router = createCanvasPointerRouter()
    router.setOptions(createRouterOptions({ activeTool: 'select', nodeDragController }))
    const detach = router.attach(surface)

    node.dispatchEvent(createPointerEvent('pointerdown', { pointerId: 7 }))
    router.setOptions(
      createRouterOptions({ activeTool: 'select', enabled: false, nodeDragController }),
    )
    window.dispatchEvent(createPointerEvent('pointermove', { clientX: 20, pointerId: 7 }))
    window.dispatchEvent(createPointerEvent('pointerup', { clientX: 20, pointerId: 7 }))

    expect(nodeDragController.begin).toHaveBeenCalledTimes(1)
    expect(nodeDragController.cancel).toHaveBeenCalledTimes(1)
    expect(nodeDragController.update).not.toHaveBeenCalled()
    expect(nodeDragController.commit).not.toHaveBeenCalled()

    detach()
  })

  it('routes select-tool aggregate selection wrapper drags through the node drag controller', () => {
    const { surface, selectionDragWrapper } = createCanvasDom()
    const nodeDragController = createNodeDragControllerMock()
    const router = createCanvasPointerRouter()
    router.setOptions(createRouterOptions({ activeTool: 'select', nodeDragController }))
    const detach = router.attach(surface)

    selectionDragWrapper.dispatchEvent(createPointerEvent('pointerdown', { pointerId: 7 }))
    window.dispatchEvent(createPointerEvent('pointermove', { clientX: 20, pointerId: 7 }))
    window.dispatchEvent(createPointerEvent('pointerup', { clientX: 20, pointerId: 7 }))

    expect(nodeDragController.begin).toHaveBeenCalledWith(
      testCanvasNodeId('node-1'),
      expect.any(Event),
    )
    expect(nodeDragController.update).toHaveBeenCalledTimes(1)
    expect(nodeDragController.commit).toHaveBeenCalledTimes(1)

    detach()
  })

  it('toggles the selected node when modifier-clicking the aggregate selection wrapper', () => {
    const { surface, selectionDragWrapper } = createCanvasDom()
    const selection = createSelectionMock()
    const nodeDragController = createNodeDragControllerMock()
    const router = createCanvasPointerRouter()
    router.setOptions(createRouterOptions({ activeTool: 'select', nodeDragController, selection }))
    const detach = router.attach(surface)

    selectionDragWrapper.dispatchEvent(
      createPointerEvent('pointerdown', { ctrlKey: true, pointerId: 7 }),
    )
    window.dispatchEvent(createPointerEvent('pointerup', { ctrlKey: true, pointerId: 7 }))

    expect(nodeDragController.begin).toHaveBeenCalledWith(
      testCanvasNodeId('node-1'),
      expect.any(Event),
    )
    expect(nodeDragController.commit).toHaveBeenCalledTimes(1)
    expect(selection.toggleNode).toHaveBeenCalledExactlyOnceWith(testCanvasNodeId('node-1'), true)

    detach()
  })

  it('uses the clicked selected node for aggregate selection wrapper modifier-clicks', () => {
    const { surface, selectionDragWrapper } = createCanvasDom()
    const selection = createSelectionMock({
      nodeIds: new Set([testCanvasNodeId('node-1'), 'node-2']),
      edgeIds: new Set(),
    })
    const nodeDragController = createNodeDragControllerMock()
    const router = createCanvasPointerRouter()
    selectionDragWrapper.dataset.canvasSelectionDragNodeId = 'node-2'
    router.setOptions(
      createRouterOptions({
        activeTool: 'select',
        nodeDragController,
        nodeLookup: new Map([
          [testCanvasNodeId('node-1'), createInternalNode(testCanvasNodeId('node-1'), 0, 0)],
          ['node-2', createInternalNode('node-2', 100, 0)],
        ]),
        selection,
      }),
    )
    const detach = router.attach(surface)

    selectionDragWrapper.dispatchEvent(
      createPointerEvent('pointerdown', { clientX: 10, clientY: 10, ctrlKey: true, pointerId: 7 }),
    )
    window.dispatchEvent(
      createPointerEvent('pointerup', { clientX: 10, clientY: 10, ctrlKey: true, pointerId: 7 }),
    )

    expect(selection.toggleNode).toHaveBeenCalledExactlyOnceWith('node-2', true)

    detach()
  })

  it('ignores keyboard handlers while disabled', () => {
    const { surface } = createCanvasDom()
    const activeToolHandlers: CanvasToolHandlers = {
      onKeyDown: vi.fn(),
      onKeyUp: vi.fn(),
    }
    const router = createCanvasPointerRouter()
    router.setOptions(
      createRouterOptions({ activeTool: 'draw', activeToolHandlers, enabled: false }),
    )
    const detach = router.attach(surface)

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'a' }))
    window.dispatchEvent(new KeyboardEvent('keyup', { key: 'a' }))

    expect(activeToolHandlers.onKeyDown).not.toHaveBeenCalled()
    expect(activeToolHandlers.onKeyUp).not.toHaveBeenCalled()

    detach()
  })

  it('treats editable text targets as interactive children', () => {
    const { surface, text } = createCanvasDom()
    text.setAttribute('contenteditable', 'plaintext-only')
    const selection = createSelectionMock()
    const router = createCanvasPointerRouter()
    router.setOptions(createRouterOptions({ activeTool: 'lasso', selection }))
    const detach = router.attach(surface)

    text.dispatchEvent(createPointerEvent('pointerdown'))

    expect(selection.beginGesture).not.toHaveBeenCalled()

    detach()
  })

  it('routes non-editing canvas text editor targets as node drags', () => {
    const { surface, text } = createCanvasDom()
    text.className = 'canvas-text-editor'
    text.setAttribute('contenteditable', 'true')
    const nodeDragController = createNodeDragControllerMock()
    const router = createCanvasPointerRouter()
    router.setOptions(createRouterOptions({ activeTool: 'select', nodeDragController }))
    const detach = router.attach(surface)

    text.dispatchEvent(createPointerEvent('pointerdown', { pointerId: 7 }))

    expect(nodeDragController.begin).toHaveBeenCalledTimes(1)

    detach()
  })

  it('treats editing canvas text editor targets as interactive children', () => {
    const { surface, text } = createCanvasDom()
    text.className = 'canvas-text-editor nodrag nopan'
    text.setAttribute('contenteditable', 'true')
    const nodeDragController = createNodeDragControllerMock()
    const router = createCanvasPointerRouter()
    router.setOptions(createRouterOptions({ activeTool: 'select', nodeDragController }))
    const detach = router.attach(surface)

    text.dispatchEvent(createPointerEvent('pointerdown', { pointerId: 7 }))

    expect(nodeDragController.begin).not.toHaveBeenCalled()

    detach()
  })

  it('cancels select-tool node drags without committing them', () => {
    const { surface, node } = createCanvasDom()
    const nodeDragController = createNodeDragControllerMock()
    const router = createCanvasPointerRouter()
    router.setOptions(createRouterOptions({ activeTool: 'select', nodeDragController }))
    const detach = router.attach(surface)

    node.dispatchEvent(createPointerEvent('pointerdown', { pointerId: 7 }))
    window.dispatchEvent(createPointerEvent('pointercancel', { pointerId: 7 }))

    expect(nodeDragController.begin).toHaveBeenCalledTimes(1)
    expect(nodeDragController.cancel).toHaveBeenCalledTimes(1)
    expect(nodeDragController.commit).not.toHaveBeenCalled()

    detach()
  })

  function flushAnimationFrame() {
    const callbacks = Array.from(rafCallbacks.values())
    rafCallbacks.clear()

    for (const callback of callbacks) {
      callback(performance.now())
    }
  }
})

function createRouterOptions({
  activeTool,
  activeToolHandlers = {},
  enabled = true,
  setActiveTool = vi.fn(),
  nodeDragController = null,
  selection = createSelectionMock(),
  nodes = [],
  edges = [],
  nodeLookup = new Map(),
  localOverlay = createCanvasToolLocalOverlayStore().getState(),
}: {
  activeTool: CanvasToolId
  activeToolHandlers?: CanvasToolHandlers
  enabled?: boolean
  setActiveTool?: CanvasPointerRouterOptions['setActiveTool']
  nodeDragController?: CanvasPointerRouterOptions['nodeDragController']
  selection?: ReturnType<typeof createSelectionMock>
  nodes?: Array<Node>
  edges?: Array<Edge>
  nodeLookup?: Map<string, unknown>
  localOverlay?: CanvasPointerRouterOptions['localOverlay']
}): CanvasPointerRouterOptions {
  return {
    activeTool,
    activeToolHandlers,
    awareness: { setPresence: vi.fn() },
    canvasEngine: {
      getSnapshot: () => ({ nodes, edges, nodeLookup }),
    } as unknown as CanvasEngine,
    enabled,
    getShiftPressed: () => false,
    localOverlay,
    nodeDragController,
    selection,
    setActiveTool,
    viewportController: {
      getZoom: () => 1,
      screenToCanvasPosition: ({ x, y }) => ({ x, y }),
    },
  }
}

function createSelectionMock(
  snapshot: CanvasSelectionSnapshot = { nodeIds: new Set(), edgeIds: new Set() },
) {
  return {
    beginGesture: vi.fn(),
    cancelGesture: vi.fn(),
    clearSelection: vi.fn(),
    commitGesture: vi.fn(),
    getSnapshot: vi.fn(() => snapshot),
    setGesturePreview: vi.fn(),
    toggleNode: vi.fn(),
  }
}

function createCanvasDom() {
  const surface = document.createElement('div')
  const pane = document.createElement('div')
  pane.className = 'canvas-scene'
  pane.dataset.canvasPane = 'true'
  const viewport = document.createElement('div')
  viewport.dataset.canvasViewport = 'true'
  const edgeLayer = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
  edgeLayer.dataset.canvasEdgeLayer = 'true'
  const edge = document.createElementNS('http://www.w3.org/2000/svg', 'g')
  edge.dataset.canvasEdgeId = 'edge-1'
  const node = document.createElement('div')
  node.className = 'canvas-node-shell'
  node.dataset.nodeId = testCanvasNodeId('node-1')
  const text = document.createElement('p')
  text.textContent = 'node text'
  const handle = document.createElement('button')
  handle.dataset.canvasNodeHandle = 'true'
  const resizeZone = document.createElement('button')
  resizeZone.className = 'canvas-selection-resize-zone'
  const input = document.createElement('input')
  const selectionDragWrapper = document.createElement('div')
  selectionDragWrapper.dataset.canvasSelectionDragNodeId = testCanvasNodeId('node-1')

  edgeLayer.appendChild(edge)
  node.append(text, handle, resizeZone, input)
  viewport.append(edgeLayer, node)
  pane.append(viewport, selectionDragWrapper)
  surface.appendChild(pane)
  document.body.appendChild(surface)

  return {
    edge,
    handle,
    input,
    node,
    pane,
    resizeZone,
    selectionDragWrapper,
    surface,
    text,
    viewport,
  }
}

function createNodeDragControllerMock(): NonNullable<
  CanvasPointerRouterOptions['nodeDragController']
> {
  return {
    begin: vi.fn(() => true),
    update: vi.fn(() => true),
    commit: vi.fn(() => true),
    cancel: vi.fn(() => true),
    profileDrag: vi.fn(),
    destroy: vi.fn(),
  }
}

function createMeasuredNode(id: string, x: number, y: number): Node {
  return {
    id: testCanvasNodeId(id),
    type: 'text',
    data: {},
    position: { x, y },
    width: 40,
    height: 40,
  }
}

function createInternalNode(id: string, x: number, y: number) {
  return {
    node: {
      id,
      type: 'text',
      data: {},
      position: { x, y },
    },
    measured: { width: 40, height: 40 },
  }
}

function createPointerEvent(
  type: string,
  init: {
    button?: number
    buttons?: number
    clientX?: number
    clientY?: number
    ctrlKey?: boolean
    pointerId?: number
  } = {},
): PointerEvent {
  const event = new Event(type, { bubbles: true, cancelable: true }) as PointerEvent
  Object.defineProperties(event, {
    button: { value: init.button ?? 0 },
    buttons: { value: init.buttons ?? 1 },
    clientX: { value: init.clientX ?? 0 },
    clientY: { value: init.clientY ?? 0 },
    ctrlKey: { value: init.ctrlKey ?? false },
    metaKey: { value: false },
    pointerId: { value: init.pointerId ?? 1 },
    shiftKey: { value: false },
  })
  return event
}
