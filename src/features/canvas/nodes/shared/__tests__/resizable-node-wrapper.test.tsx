import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { CanvasPendingSelectionPreviewOverlay } from '../../../components/canvas-pending-selection-preview-overlay'
import { CanvasSelectionResizeOverlay } from '../../../components/canvas-selection-resize-overlay'
import { createCanvasRuntime } from '../../../runtime/__tests__/canvas-runtime-test-utils'
import { CanvasRuntimeProvider } from '../../../runtime/providers/canvas-runtime-context'
import {
  clearCanvasDragSnapGuides,
  useCanvasDragSnapOverlayStore,
} from '../../../runtime/interaction/canvas-drag-snap-overlay'
import { CanvasEngineProvider } from '../../../react/canvas-engine-context'
import { CanvasNodeResizeMetadataProvider } from '../canvas-node-resize-metadata-provider'
import { ResizableNodeWrapper } from '../resizable-node-wrapper'
import { resolveSelectionResizeUpdates } from '../use-canvas-resize-session'
import type { CanvasNodeResizeUpdate } from '../../../tools/canvas-tool-types'
import type { CanvasNode as Node } from '~/features/canvas/types/canvas-domain-types'

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
      height: '36px',
      left: '-18px',
      top: '-18px',
      width: '36px',
    })
    expect(topZone).toHaveStyle({
      height: '36px',
      left: '18px',
      right: '18px',
      top: '-18px',
    })
    expect(rightZone).toHaveStyle({
      bottom: '18px',
      right: '-18px',
      top: '18px',
      width: '36px',
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
      height: '36px',
      left: '-18px',
      top: '-18px',
      width: '36px',
    })
    expect(topZone).toHaveStyle({
      height: '36px',
      left: '18px',
      right: '18px',
      top: '-18px',
    })
    expect(rightZone).toHaveStyle({
      bottom: '18px',
      right: '-18px',
      top: '18px',
      width: '36px',
    })
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

  it('shrinks multi-select gaps even when selected nodes are already at minimum width', () => {
    const runtime = renderSelectionResize({
      nodes: [
        createNode('node-1', { x: 10, y: 20 }, 50, 40),
        createNode('node-2', { x: 210, y: 20 }, 50, 40),
      ],
      selectedNodeIds: new Set(['node-1', 'node-2']),
    })

    const zone = screen.getByTestId('canvas-selection-resize-zone-right')
    act(() => {
      fireEvent.pointerDown(zone, { button: 0, pointerId: 1, clientX: 260, clientY: 40 })
      fireEvent.pointerMove(window, { pointerId: 1, clientX: 135, clientY: 40 })
    })

    expectMapEntries(runtime.nodeActions.onResizeMany, [
      ['node-1', { width: 50, height: 40, position: { x: -2.5, y: 20 } }],
      ['node-2', { width: 50, height: 40, position: { x: 97.5, y: 20 } }],
    ])
  })

  it('keeps single selected nodes clamped to their minimum size', () => {
    const runtime = renderSelectionResize({
      nodes: [createNode('node-1', { x: 10, y: 20 }, 50, 40)],
    })

    const zone = screen.getByTestId('canvas-selection-resize-zone-right')
    act(() => {
      fireEvent.pointerDown(zone, { button: 0, pointerId: 1, clientX: 60, clientY: 40 })
      fireEvent.pointerMove(window, { pointerId: 1, clientX: 25, clientY: 40 })
    })

    expectMapEntries(runtime.nodeActions.onResizeMany, [
      ['node-1', { width: 50, height: 40, position: { x: 10, y: 20 } }],
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
})

function renderSelectionResize({
  draggingNodeIds = new Set<string>(),
  nodes = [createNode('node-1', { x: 10, y: 20 }, 80, 40)],
  pendingPreview = null,
  selectedEdgeIds = new Set<string>(),
  selectedNodeIds = new Set(['node-1']),
}: {
  draggingNodeIds?: ReadonlySet<string>
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
              nodeType={node.type ?? 'test'}
              dragging={draggingNodeIds.has(node.id)}
              minHeight={node.type === 'stroke' ? 20 : 30}
              minWidth={node.type === 'stroke' ? 20 : 50}
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
  type = 'test',
): Node {
  return {
    data: {},
    id,
    type,
    position,
    width,
    height,
  }
}

function expectMapEntries(spy: unknown, entries: Array<[string, CanvasNodeResizeUpdate]>) {
  expect(spy).toHaveBeenCalled()
  const calls = (spy as ReturnType<typeof vi.fn>).mock.calls
  const lastCall = calls.at(-1)
  const updates = lastCall?.[0]
  expect(updates).toBeInstanceOf(Map)
  expect(Array.from((updates as Map<string, CanvasNodeResizeUpdate>).entries())).toEqual(entries)
}
