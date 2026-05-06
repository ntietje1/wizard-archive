import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { CanvasPendingSelectionPreviewOverlay } from '../../../components/canvas-pending-selection-preview-overlay'
import { CanvasSelectionResizeOverlay } from '../../../components/canvas-selection-resize-overlay'
import { createCanvasRuntime } from '../../../runtime/__tests__/canvas-runtime-test-utils'
import { CanvasRuntimeProvider } from '../../../runtime/providers/canvas-runtime'
import {
  clearCanvasDragSnapGuides,
  useCanvasDragSnapOverlayStore,
} from '../../../runtime/interaction/canvas-drag-snap-overlay'
import { CanvasEngineProvider } from '../../../react/canvas-engine-context'
import { CANVAS_NODE_MIN_SIZE } from '../canvas-node-resize-constants'
import { CanvasNodeResizeMetadataProvider } from '../canvas-node-resize-metadata-provider'
import { ResizableNodeWrapper } from '../resizable-node-wrapper'
import { resolveSelectionResizeUpdates } from '../use-canvas-resize-session'
import type { CanvasNodeResizeUpdate } from '../../../tools/canvas-tool-types'
import type { CanvasDocumentNode as Node } from 'convex/canvases/validation'

const modifierState = vi.hoisted(() => ({
  shiftPressed: false,
  primaryPressed: false,
}))

vi.mock('../../../runtime/interaction/use-canvas-modifier-keys', () => ({
  useCanvasModifierKeys: () => modifierState,
}))

afterEach(() => {
  clearCanvasDragSnapGuides()
  modifierState.shiftPressed = false
  modifierState.primaryPressed = false
})

beforeAll(() => {
  Object.defineProperty(HTMLElement.prototype, 'setPointerCapture', {
    configurable: true,
    value: vi.fn(),
  })
  Object.defineProperty(HTMLElement.prototype, 'releasePointerCapture', {
    configurable: true,
    value: vi.fn(),
  })
})

describe('ResizableNodeWrapper', () => {
  it('shows aggregate pending-only preview chrome without resize zones', () => {
    renderSelectionResize({
      pendingPreview: { nodeIds: new Set(['node-1']), edgeIds: new Set() },
      selectedNodeIds: new Set(),
    })

    expect(screen.getByTestId('canvas-pending-selection-preview-wrapper')).toHaveStyle({
      height: '40px',
      transform: 'translate(10px, 20px)',
      width: '80px',
    })
    expect(screen.getByTestId('canvas-pending-selection-preview-fill')).toHaveClass('bg-primary/5')
    expect(screen.getByTestId('canvas-node-selection-indicator')).toHaveStyle({
      borderWidth: '1.5px',
      borderRadius: '2px',
      inset: '-3px',
      opacity: '0.55',
    })
    expect(screen.queryByTestId('selection-border')).toBeNull()
    expect(screen.queryByTestId('canvas-selection-resize-wrapper')).toBeNull()
    expect(screen.queryAllByTestId(/canvas-node-resize-handle-/)).toHaveLength(0)
    expect(screen.queryAllByTestId(/canvas-selection-resize-zone-/)).toHaveLength(0)
  })

  it('ignores pending-selected edges when computing aggregate pending preview bounds', () => {
    renderSelectionResize({
      nodes: [
        createNode('node-1', { x: 10, y: 20 }, 80, 40),
        createNode('node-2', { x: 150, y: 200 }, 50, 50),
      ],
      pendingPreview: {
        nodeIds: new Set(['node-1']),
        edgeIds: new Set(['edge-1']),
      },
      selectedNodeIds: new Set(),
    })

    expect(screen.getByTestId('canvas-pending-selection-preview-wrapper')).toHaveStyle({
      height: '40px',
      transform: 'translate(10px, 20px)',
      width: '80px',
    })
  })

  it('renders one filled resize wrapper without a duplicate node indicator for a single selected node', () => {
    renderSelectionResize()

    expect(screen.getByTestId('canvas-selection-resize-wrapper')).toBeInTheDocument()
    expect(screen.getByTestId('canvas-selection-resize-fill')).toBeInTheDocument()
    expect(screen.getByTestId('canvas-selection-resize-outline')).toBeInTheDocument()
    expect(screen.getByTestId('canvas-selection-resize-fill')).toHaveClass('bg-primary/5')
    expect(screen.queryByTestId('canvas-node-selection-indicator')).toBeNull()
    expect(screen.queryAllByTestId(/canvas-node-resize-handle-/)).toHaveLength(0)
    expect(screen.queryAllByTestId(/canvas-selection-resize-zone-/)).toHaveLength(8)
    expect(screen.queryByTestId('selection-border')).toBeNull()
  })

  it('renders one resize wrapper for multiple selected nodes', () => {
    renderSelectionResize({
      nodes: [
        createNode('node-1', { x: 10, y: 20 }, 80, 40),
        createNode('node-2', { x: 110, y: 80 }, 40, 30),
      ],
      selectedNodeIds: new Set(['node-1', 'node-2']),
    })

    const wrapper = screen.getByTestId('canvas-selection-resize-wrapper')
    const outline = screen.getByTestId('canvas-selection-resize-outline')
    expect(wrapper).toHaveStyle({
      height: '90px',
      transform: 'translate(10px, 20px)',
      width: '140px',
    })
    expect(outline).toHaveStyle({
      borderWidth: '1.5px',
      inset: '-3px',
    })
    const nodeIndicators = screen.getAllByTestId('canvas-node-selection-indicator')
    expect(nodeIndicators).toHaveLength(2)
    const nodeIndicatorStyle = nodeIndicators[0].getAttribute('style') ?? ''
    expect(nodeIndicatorStyle).toContain('border-color: var(--primary)')
    expect(nodeIndicatorStyle).toContain('border-style: solid')
    expect(nodeIndicatorStyle).toContain('border-width: 1.5px')
    expect(nodeIndicatorStyle).toContain('border-radius: 2px')
    expect(nodeIndicatorStyle).toContain('inset: -3px')
    expect(nodeIndicatorStyle).toContain('opacity: 0.55')
    expect(screen.queryAllByTestId(/canvas-node-resize-handle-/)).toHaveLength(0)
    expect(screen.queryAllByTestId(/canvas-selection-resize-zone-/)).toHaveLength(8)
  })

  it('makes the aggregate selection wrapper draggable through a selected node id', () => {
    renderSelectionResize({
      nodes: [
        createNode('node-1', { x: 10, y: 20 }, 80, 40),
        createNode('node-2', { x: 110, y: 20 }, 40, 40),
      ],
      selectedNodeIds: new Set(['node-1', 'node-2']),
    })

    expect(screen.getByTestId('canvas-selection-resize-wrapper')).toHaveAttribute(
      'data-canvas-selection-drag-node-id',
      'node-1',
    )
  })

  it('does not make the single-node selection wrapper draggable', () => {
    renderSelectionResize()

    expect(screen.getByTestId('canvas-selection-resize-wrapper')).not.toHaveAttribute(
      'data-canvas-selection-drag-node-id',
    )
  })

  it('labels aggregate resize handles as corners or edges', () => {
    renderSelectionResize()

    expect(screen.getByTestId('canvas-selection-resize-zone-top-left')).toHaveAccessibleName(
      'Resize top-left selection corner',
    )
    expect(screen.getByTestId('canvas-selection-resize-zone-top')).toHaveAccessibleName(
      'Resize top selection edge',
    )
  })

  it('keeps individual selected-node borders screen-constant with zoom-aware local styles', () => {
    const runtime = renderSelectionResize({
      nodes: [
        createNode('node-1', { x: 10, y: 20 }, 80, 40),
        createNode('node-2', { x: 110, y: 80 }, 40, 30),
      ],
      selectedNodeIds: new Set(['node-1', 'node-2']),
    })

    const getFirstIndicator = () => screen.getAllByTestId('canvas-node-selection-indicator')[0]
    expect(getFirstIndicator()).toHaveStyle({
      borderWidth: '1.5px',
      borderRadius: '2px',
      inset: '-3px',
      opacity: '0.55',
    })

    act(() => {
      runtime.canvasEngine.setViewportLive({ x: 5, y: -10, zoom: 2 })
    })

    expect(getFirstIndicator()).toHaveStyle({
      borderWidth: '0.75px',
      borderRadius: '1px',
      inset: '-1.5px',
      opacity: '0.55',
    })
  })

  it('hides the aggregate resize wrapper but keeps local selection borders while dragging', () => {
    renderSelectionResize({
      draggingNodeIds: new Set(['node-1', 'node-2']),
      nodes: [
        createNode('node-1', { x: 10, y: 20 }, 80, 40),
        createNode('node-2', { x: 110, y: 80 }, 40, 30),
      ],
      selectedNodeIds: new Set(['node-1', 'node-2']),
    })

    expect(screen.queryByTestId('canvas-selection-resize-wrapper')).toBeNull()
    expect(screen.getAllByTestId('canvas-node-selection-indicator')).toHaveLength(2)
  })

  it('renders local selection borders after node content so they move with node wrappers', () => {
    renderSelectionResize({
      nodes: [
        createNode('node-1', { x: 10, y: 20 }, 80, 40),
        createNode('node-2', { x: 110, y: 80 }, 40, 30),
      ],
      selectedNodeIds: new Set(['node-1', 'node-2']),
    })

    const nodeBody = screen.getAllByText('node body')[0]
    const nodeIndicator = screen.getAllByTestId('canvas-node-selection-indicator')[0]

    expect(nodeBody.closest('[data-testid="canvas-node"]')).toContainElement(nodeIndicator)
    expect(
      nodeBody.compareDocumentPosition(nodeIndicator) & globalThis.Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy()
  })

  it('ignores selected edges when computing wrapper bounds', () => {
    renderSelectionResize({
      selectedEdgeIds: new Set(['edge-1']),
    })

    expect(screen.getByTestId('canvas-selection-resize-wrapper')).toHaveStyle({
      height: '40px',
      transform: 'translate(10px, 20px)',
      width: '80px',
    })
  })

  it('keeps zones and outline screen-constant while the wrapper tracks viewport zoom', () => {
    const runtime = renderSelectionResize()
    const wrapper = screen.getByTestId('canvas-selection-resize-wrapper')
    const outline = screen.getByTestId('canvas-selection-resize-outline')
    const cornerZone = screen.getByTestId('canvas-selection-resize-zone-top-left')
    const topZone = screen.getByTestId('canvas-selection-resize-zone-top')
    const rightZone = screen.getByTestId('canvas-selection-resize-zone-right')

    expect(wrapper).toHaveStyle({
      height: '40px',
      transform: 'translate(10px, 20px)',
      width: '80px',
    })
    expect(outline).toHaveStyle({
      borderWidth: '1.5px',
      inset: '-3px',
    })
    expect(cornerZone).toHaveStyle({
      height: '18px',
      left: '-9px',
      top: '-9px',
      width: '18px',
    })
    expect(topZone).toHaveStyle({
      height: '18px',
      left: '9px',
      right: '9px',
      top: '-9px',
    })
    expect(rightZone).toHaveStyle({
      bottom: '9px',
      right: '-9px',
      top: '9px',
      width: '18px',
    })

    expect(screen.queryByTestId('canvas-node-selection-indicator')).toBeNull()

    act(() => {
      runtime.canvasEngine.setViewportLive({ x: 5, y: -10, zoom: 2 })
    })

    expect(wrapper).toHaveStyle({
      height: '80px',
      transform: 'translate(25px, 30px)',
      width: '160px',
    })
    expect(outline).toHaveStyle({
      borderWidth: '1.5px',
      inset: '-3px',
    })
    expect(cornerZone).toHaveStyle({
      height: '18px',
      left: '-9px',
      top: '-9px',
      width: '18px',
    })
    expect(topZone).toHaveStyle({
      height: '18px',
      left: '9px',
      right: '9px',
      top: '-9px',
    })
    expect(rightZone).toHaveStyle({
      bottom: '9px',
      right: '-9px',
      top: '9px',
      width: '18px',
    })
  })

  it('uses larger resize interaction zones for coarse pointer devices', () => {
    const restorePointerMedia = stubPointerMedia(true)
    try {
      renderSelectionResize()

      expect(screen.getByTestId('canvas-selection-resize-zone-top-left')).toHaveStyle({
        height: '36px',
        left: '-18px',
        top: '-18px',
        width: '36px',
      })
    } finally {
      restorePointerMedia()
    }
  })

  it('hides the committed resize wrapper while a selection preview is active', () => {
    renderSelectionResize({
      pendingPreview: { nodeIds: new Set(['other-node']), edgeIds: new Set() },
    })

    expect(screen.queryByTestId('canvas-selection-resize-wrapper')).toBeNull()
    expect(screen.queryByTestId('canvas-node-selection-indicator')).toBeNull()
  })

  it('resizes all selected nodes from one aggregate side zone', () => {
    const runtime = renderSelectionResize({
      nodes: [
        createNode('node-1', { x: 10, y: 20 }, 80, 40),
        createNode('node-2', { x: 110, y: 20 }, 40, 40),
      ],
      selectedNodeIds: new Set(['node-1', 'node-2']),
    })

    const zone = screen.getByTestId('canvas-selection-resize-zone-right')
    act(() => {
      fireEvent.pointerDown(zone, { button: 0, pointerId: 1, clientX: 150, clientY: 40 })
      fireEvent.pointerMove(window, { pointerId: 1, clientX: 290, clientY: 40 })
      fireEvent.pointerUp(window, { pointerId: 1, clientX: 290, clientY: 40 })
    })

    expectMapEntries(runtime.nodeActions.onResizeMany, [
      ['node-1', { width: 160, height: 40, position: { x: 10, y: 20 } }],
      ['node-2', { width: 80, height: 40, position: { x: 210, y: 20 } }],
    ])
    expectMapEntries(runtime.nodeActions.onResizeManyEnd, [
      ['node-1', { width: 160, height: 40, position: { x: 10, y: 20 } }],
      ['node-2', { width: 80, height: 40, position: { x: 210, y: 20 } }],
    ])
  })

  it('updates the aggregate resize wrapper during live multiselect resize', () => {
    renderSelectionResize({
      nodes: [
        createNode('node-1', { x: 10, y: 20 }, 80, 40),
        createNode('node-2', { x: 110, y: 20 }, 40, 40),
      ],
      selectedNodeIds: new Set(['node-1', 'node-2']),
    })

    const wrapper = screen.getByTestId('canvas-selection-resize-wrapper')
    const zone = screen.getByTestId('canvas-selection-resize-zone-right')
    act(() => {
      fireEvent.pointerDown(zone, { button: 0, pointerId: 1, clientX: 150, clientY: 40 })
      fireEvent.pointerMove(window, { pointerId: 1, clientX: 290, clientY: 40 })
    })

    expect(wrapper).toHaveStyle({
      height: '40px',
      transform: 'translate(10px, 20px)',
      width: '280px',
    })
  })

  it('keeps the aggregate resize wrapper around minimum-clamped nodes while shrinking', () => {
    renderSelectionResize({
      nodes: [
        createNode('node-1', { x: 10, y: 20 }, CANVAS_NODE_MIN_SIZE, CANVAS_NODE_MIN_SIZE),
        createNode('node-2', { x: 210, y: 20 }, CANVAS_NODE_MIN_SIZE, CANVAS_NODE_MIN_SIZE),
      ],
      selectedNodeIds: new Set(['node-1', 'node-2']),
    })

    const wrapper = screen.getByTestId('canvas-selection-resize-wrapper')
    const zone = screen.getByTestId('canvas-selection-resize-zone-right')
    act(() => {
      fireEvent.pointerDown(zone, { button: 0, pointerId: 1, clientX: 220, clientY: 25 })
      fireEvent.pointerMove(window, { pointerId: 1, clientX: 115, clientY: 25 })
    })

    expect(wrapper).toHaveStyle({
      height: '10px',
      transform: 'translate(7.5px, 20px)',
      width: '110px',
    })
  })

  it('shrinks multi-select gaps even when selected nodes are already at minimum width', () => {
    const runtime = renderSelectionResize({
      nodes: [
        createNode('node-1', { x: 10, y: 20 }, CANVAS_NODE_MIN_SIZE, CANVAS_NODE_MIN_SIZE),
        createNode('node-2', { x: 210, y: 20 }, CANVAS_NODE_MIN_SIZE, CANVAS_NODE_MIN_SIZE),
      ],
      selectedNodeIds: new Set(['node-1', 'node-2']),
    })

    const zone = screen.getByTestId('canvas-selection-resize-zone-right')
    act(() => {
      fireEvent.pointerDown(zone, { button: 0, pointerId: 1, clientX: 220, clientY: 25 })
      fireEvent.pointerMove(window, { pointerId: 1, clientX: 115, clientY: 25 })
    })

    expectMapEntries(runtime.nodeActions.onResizeMany, [
      [
        'node-1',
        { width: CANVAS_NODE_MIN_SIZE, height: CANVAS_NODE_MIN_SIZE, position: { x: 7.5, y: 20 } },
      ],
      [
        'node-2',
        {
          width: CANVAS_NODE_MIN_SIZE,
          height: CANVAS_NODE_MIN_SIZE,
          position: { x: 107.5, y: 20 },
        },
      ],
    ])
  })

  it('keeps single selected nodes clamped to their minimum size', () => {
    const runtime = renderSelectionResize({
      nodes: [createNode('node-1', { x: 10, y: 20 }, CANVAS_NODE_MIN_SIZE, CANVAS_NODE_MIN_SIZE)],
    })

    const zone = screen.getByTestId('canvas-selection-resize-zone-right')
    act(() => {
      fireEvent.pointerDown(zone, { button: 0, pointerId: 1, clientX: 20, clientY: 25 })
      fireEvent.pointerMove(window, { pointerId: 1, clientX: -90, clientY: 25 })
    })

    expectMapEntries(runtime.nodeActions.onResizeMany, [
      [
        'node-1',
        { width: CANVAS_NODE_MIN_SIZE, height: CANVAS_NODE_MIN_SIZE, position: { x: 10, y: 20 } },
      ],
    ])
  })

  it('keeps single locked-aspect corner resize smooth when the pointer moves off ratio', () => {
    const runtime = renderSelectionResize({
      lockedAspectRatio: 2,
      nodes: [createNode('node-1', { x: 10, y: 20 }, 100, 50, 'embed')],
    })

    const zone = screen.getByTestId('canvas-selection-resize-zone-bottom-right')
    act(() => {
      fireEvent.pointerDown(zone, { button: 0, pointerId: 1, clientX: 110, clientY: 70 })
      fireEvent.pointerMove(window, { pointerId: 1, clientX: 160, clientY: 44.9 })
    })

    expectMapEntries(runtime.nodeActions.onResizeMany, [
      ['node-1', { width: 150, height: 75, position: { x: 10, y: 20 } }],
    ])
  })

  it('keeps aspect-ratio locked nodes locked inside a group resize', () => {
    const updates = resolveSelectionResizeUpdates({
      handlePosition: 'right',
      startBounds: { x: 10, y: 20, width: 140, height: 40 },
      nextBounds: { x: 10, y: 20, width: 280, height: 40 },
      nodes: [
        {
          id: 'node-1',
          bounds: { x: 10, y: 20, width: 80, height: 40 },
          dragging: false,
          metadata: { dragging: false, lockedAspectRatio: 2, minHeight: 20, minWidth: 20 },
        },
        {
          id: 'node-2',
          bounds: { x: 110, y: 20, width: 40, height: 40 },
          dragging: false,
          metadata: { dragging: false, minHeight: 20, minWidth: 20 },
        },
      ],
    })

    expect(updates.get('node-1')).toEqual({
      width: 160,
      height: 80,
      position: { x: 10, y: 0 },
    })
    expect(updates.get('node-2')).toEqual({
      width: 80,
      height: 40,
      position: { x: 210, y: 20 },
    })
  })

  it('keeps snapping active for the aggregate wrapper', () => {
    modifierState.primaryPressed = true
    const runtime = renderSelectionResize({
      nodes: [
        createNode('node-1', { x: 10, y: 20 }, 80, 40),
        createNode('node-2', { x: 120, y: 120 }, 80, 40),
      ],
      selectedNodeIds: new Set(['node-1']),
    })

    const zone = screen.getByTestId('canvas-selection-resize-zone-bottom-right')
    act(() => {
      fireEvent.pointerDown(zone, { button: 0, pointerId: 1, clientX: 90, clientY: 60 })
      fireEvent.pointerMove(window, { pointerId: 1, clientX: 118, clientY: 75, ctrlKey: true })
    })

    expectMapEntries(runtime.nodeActions.onResizeMany, [
      ['node-1', { width: 110, height: 55, position: { x: 10, y: 20 } }],
    ])
    expect(useCanvasDragSnapOverlayStore.getState().guides).toContainEqual(
      expect.objectContaining({ orientation: 'vertical', position: 120 }),
    )
  })

  it('refreshes resize geometry when modifier keys change during a session', () => {
    const runtime = renderSelectionResize()

    const zone = screen.getByTestId('canvas-selection-resize-zone-bottom-right')
    act(() => {
      fireEvent.pointerDown(zone, { button: 0, pointerId: 1, clientX: 90, clientY: 60 })
      fireEvent.pointerMove(window, { pointerId: 1, clientX: 110, clientY: 65 })
    })

    expectMapEntries(runtime.nodeActions.onResizeMany, [
      ['node-1', { width: 100, height: 45, position: { x: 10, y: 20 } }],
    ])

    modifierState.shiftPressed = true
    act(() => {
      fireEvent.keyDown(window, { key: 'Shift' })
    })

    expectMapEntries(runtime.nodeActions.onResizeMany, [
      ['node-1', { width: 45, height: 45, position: { x: 10, y: 20 } }],
    ])
  })

  it('restores preview bounds and clears resize state on cancel', () => {
    const runtime = renderSelectionResize()

    const zone = screen.getByTestId('canvas-selection-resize-zone-right')
    act(() => {
      fireEvent.pointerDown(zone, { button: 0, pointerId: 1, clientX: 90, clientY: 40 })
      fireEvent.pointerMove(window, { pointerId: 1, clientX: 120, clientY: 40 })
      fireEvent.pointerCancel(window, { pointerId: 1, clientX: 120, clientY: 40 })
    })

    expectMapEntries(runtime.nodeActions.onResizeManyCancel, [
      ['node-1', { width: 80, height: 40, position: { x: 10, y: 20 } }],
    ])
    expect(runtime.nodeActions.onResizeManyEnd).not.toHaveBeenCalled()
  })

  it('ignores resize move, cancel, and up events from other pointers', () => {
    const runtime = renderSelectionResize()

    const zone = screen.getByTestId('canvas-selection-resize-zone-right')
    act(() => {
      fireEvent.pointerDown(zone, { button: 0, pointerId: 1, clientX: 90, clientY: 40 })
      fireEvent.pointerMove(window, { pointerId: 2, clientX: 140, clientY: 40 })
      fireEvent.pointerCancel(window, { pointerId: 2, clientX: 140, clientY: 40 })
      fireEvent.pointerUp(window, { pointerId: 2, clientX: 140, clientY: 40 })
    })

    expect(runtime.nodeActions.onResizeMany).not.toHaveBeenCalled()
    expect(runtime.nodeActions.onResizeManyCancel).not.toHaveBeenCalled()
    expect(runtime.nodeActions.onResizeManyEnd).not.toHaveBeenCalled()

    act(() => {
      fireEvent.pointerMove(window, { pointerId: 1, clientX: 120, clientY: 40 })
      fireEvent.pointerUp(window, { pointerId: 1, clientX: 120, clientY: 40 })
    })

    expectMapEntries(runtime.nodeActions.onResizeMany, [
      ['node-1', { width: 110, height: 40, position: { x: 10, y: 20 } }],
    ])
    expectMapEntries(runtime.nodeActions.onResizeManyEnd, [
      ['node-1', { width: 110, height: 40, position: { x: 10, y: 20 } }],
    ])
  })
})

function renderSelectionResize({
  draggingNodeIds = new Set<string>(),
  lockedAspectRatio,
  nodes = [createNode('node-1', { x: 10, y: 20 }, 80, 40)],
  pendingPreview = null,
  selectedEdgeIds = new Set<string>(),
  selectedNodeIds = new Set(['node-1']),
}: {
  draggingNodeIds?: ReadonlySet<string>
  lockedAspectRatio?: number
  nodes?: Array<Node>
  pendingPreview?: { nodeIds: ReadonlySet<string>; edgeIds: ReadonlySet<string> } | null
  selectedEdgeIds?: ReadonlySet<string>
  selectedNodeIds?: ReadonlySet<string>
} = {}) {
  const runtime = createCanvasRuntime({
    nodeActions: {
      onResizeMany: vi.fn(),
      onResizeManyCancel: vi.fn(),
      onResizeManyEnd: vi.fn(),
    },
  })
  runtime.canvasEngine.setDocumentSnapshot({ nodes })
  runtime.canvasEngine.setSelection({
    nodeIds: selectedNodeIds,
    edgeIds: selectedEdgeIds,
  })
  if (draggingNodeIds.size > 0) {
    runtime.canvasEngine.startDrag(draggingNodeIds)
  }
  if (pendingPreview) {
    runtime.canvasEngine.setSelectionGesturePreview(pendingPreview)
  }

  render(
    <CanvasEngineProvider engine={runtime.canvasEngine}>
      <CanvasRuntimeProvider {...runtime}>
        <CanvasNodeResizeMetadataProvider>
          {nodes.map((node) => (
            <ResizableNodeWrapper
              key={node.id}
              id={node.id}
              nodeType={node.type}
              dragging={draggingNodeIds.has(node.id)}
              lockedAspectRatio={lockedAspectRatio}
            >
              <div>node body</div>
            </ResizableNodeWrapper>
          ))}
          <CanvasPendingSelectionPreviewOverlay />
          <CanvasSelectionResizeOverlay />
        </CanvasNodeResizeMetadataProvider>
      </CanvasRuntimeProvider>
    </CanvasEngineProvider>,
  )

  return runtime
}

function createNode(
  id: string,
  position: { x: number; y: number },
  width: number,
  height: number,
  type: Node['type'] = 'text',
): Node {
  return {
    data: {},
    id,
    type,
    position,
    width,
    height,
  } as Node
}

function expectMapEntries(spy: unknown, entries: Array<[string, CanvasNodeResizeUpdate]>) {
  expect(spy).toHaveBeenCalled()
  const calls = (spy as ReturnType<typeof vi.fn>).mock.calls
  const lastCall = calls.at(-1)
  const updates = lastCall?.[0]
  expect(updates).toBeInstanceOf(Map)
  expect(Array.from((updates as Map<string, CanvasNodeResizeUpdate>).entries())).toEqual(entries)
}

function stubPointerMedia(coarsePointer: boolean) {
  const originalMatchMedia = Object.getOwnPropertyDescriptor(window, 'matchMedia')
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    value: vi.fn((query: string) => ({
      matches: query === '(pointer: coarse)' ? coarsePointer : false,
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  })

  return () => {
    if (originalMatchMedia) {
      Object.defineProperty(window, 'matchMedia', originalMatchMedia)
    } else {
      Reflect.deleteProperty(window, 'matchMedia')
    }
  }
}
