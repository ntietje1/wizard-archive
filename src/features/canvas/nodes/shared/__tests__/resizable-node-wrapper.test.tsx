import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { createCanvasRuntime } from '../../../runtime/__tests__/canvas-runtime-test-utils'
import { CanvasRuntimeProvider } from '../../../runtime/providers/canvas-runtime-context'
import { CanvasRenderModeProvider } from '../../../runtime/providers/canvas-render-mode-context'
import {
  clearCanvasDragSnapGuides,
  useCanvasDragSnapOverlayStore,
} from '../../../runtime/interaction/canvas-drag-snap-overlay'
import { useCanvasSelectionState } from '../../../runtime/selection/use-canvas-selection-state'
import {
  clearCanvasPendingSelectionPreview,
  setCanvasPendingSelectionPreview,
} from '../../../runtime/selection/use-canvas-pending-selection-preview'
import { ResizableNodeWrapper } from '../resizable-node-wrapper'

const modifierState = vi.hoisted(() => ({
  shiftPressed: false,
  primaryPressed: false,
}))
const useInternalNodeMock = vi.hoisted(() =>
  vi.fn(() => ({
    id: 'node-1',
    position: { x: 10, y: 20 },
    measured: { width: 80, height: 40 },
    internals: { positionAbsolute: { x: 10, y: 20 } },
  })),
)
const screenToFlowPositionMock = vi.hoisted(() =>
  vi.fn(({ x, y }: { x: number; y: number }) => ({ x, y })),
)
const getNodesMock = vi.hoisted(() =>
  vi.fn(() => [
    {
      id: 'node-1',
      type: 'test',
      position: { x: 10, y: 20 },
      width: 80,
      height: 40,
    },
  ]),
)
const getZoomMock = vi.hoisted(() => vi.fn(() => 1))

vi.mock('../../../runtime/interaction/use-canvas-modifier-keys', () => ({
  useCanvasModifierKeys: () => modifierState,
}))

vi.mock('@xyflow/react', () => ({
  useInternalNode: () => useInternalNodeMock(),
  useReactFlow: () => ({
    getNodes: getNodesMock,
    getZoom: getZoomMock,
    screenToFlowPosition: screenToFlowPositionMock,
  }),
}))

afterEach(() => {
  clearCanvasDragSnapGuides()
  clearCanvasPendingSelectionPreview()
  useCanvasSelectionState.getState().reset()
  modifierState.shiftPressed = false
  modifierState.primaryPressed = false
  getNodesMock.mockReset()
  getNodesMock.mockReturnValue([
    {
      id: 'node-1',
      type: 'test',
      position: { x: 10, y: 20 },
      width: 80,
      height: 40,
    },
  ])
  getZoomMock.mockReset()
  getZoomMock.mockReturnValue(1)
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
  it('renders the normal selection border for pending-only preview nodes without resize handles', () => {
    setCanvasPendingSelectionPreview({ nodeIds: new Set(['node-1']), edgeIds: new Set() })
    renderWrapper({ selected: false })

    expect(screen.getByTestId('selection-border')).toBeInTheDocument()
    expect(screen.queryAllByTestId(/canvas-node-resize-handle-/)).toHaveLength(0)
  })

  it('hides the local selection border for excluded committed nodes while keeping committed resize handles', () => {
    setCanvasPendingSelectionPreview({ nodeIds: new Set(['other-node']), edgeIds: new Set() })
    renderWrapper({ selected: true })

    expect(screen.queryByTestId('selection-border')).toBeNull()
    expect(screen.queryAllByTestId(/canvas-node-resize-handle-/)).toHaveLength(4)
  })

  it('resizes to a square while shift is held', () => {
    modifierState.shiftPressed = true
    const providerValues = createProviderValues()
    useCanvasSelectionState.getState().setSelection({
      nodeIds: new Set(['node-1']),
      edgeIds: new Set<string>(),
    })

    render(
      <CanvasRuntimeProvider {...providerValues}>
        <ResizableNodeWrapper id="node-1" nodeType="test" dragging={false}>
          <div>node body</div>
        </ResizableNodeWrapper>
      </CanvasRuntimeProvider>,
    )

    const handle = screen.getByTestId('canvas-node-resize-handle-bottom-right')
    act(() => {
      fireEvent.pointerDown(handle, { button: 0, pointerId: 1, clientX: 90, clientY: 60 })
      fireEvent.pointerMove(window, { pointerId: 1, clientX: 110, clientY: 65, shiftKey: true })
      fireEvent.pointerUp(window, { pointerId: 1, clientX: 110, clientY: 65, shiftKey: true })
    })

    expect(providerValues.nodeActions.onResize).toHaveBeenCalledWith('node-1', 50, 50, {
      x: 10,
      y: 20,
    })
    expect(providerValues.nodeActions.onResizeEnd).toHaveBeenCalledWith('node-1', 50, 50, {
      x: 10,
      y: 20,
    })
  })

  it('recomputes the live resize immediately when shift is pressed and released mid-drag', () => {
    const providerValues = createProviderValues()
    useCanvasSelectionState.getState().setSelection({
      nodeIds: new Set(['node-1']),
      edgeIds: new Set<string>(),
    })

    render(
      <CanvasRuntimeProvider {...providerValues}>
        <ResizableNodeWrapper id="node-1" nodeType="test" dragging={false}>
          <div>node body</div>
        </ResizableNodeWrapper>
      </CanvasRuntimeProvider>,
    )

    const handle = screen.getByTestId('canvas-node-resize-handle-bottom-right')
    act(() => {
      fireEvent.pointerDown(handle, { button: 0, pointerId: 1, clientX: 90, clientY: 60 })
      fireEvent.pointerMove(window, { pointerId: 1, clientX: 110, clientY: 65 })
    })

    expect(providerValues.nodeActions.onResize).toHaveBeenLastCalledWith('node-1', 100, 45, {
      x: 10,
      y: 20,
    })

    act(() => {
      fireEvent.keyDown(window, { key: 'Shift' })
    })

    expect(providerValues.nodeActions.onResize).toHaveBeenLastCalledWith('node-1', 50, 50, {
      x: 10,
      y: 20,
    })

    act(() => {
      fireEvent.keyUp(window, { key: 'Shift' })
    })

    expect(providerValues.nodeActions.onResize).toHaveBeenLastCalledWith('node-1', 100, 45, {
      x: 10,
      y: 20,
    })
  })

  it('snaps ctrl-resizing to nearby node edges and centers', () => {
    const providerValues = createProviderValues()
    useCanvasSelectionState.getState().setSelection({
      nodeIds: new Set(['node-1']),
      edgeIds: new Set<string>(),
    })
    getNodesMock.mockReturnValue([
      {
        id: 'node-1',
        type: 'test',
        position: { x: 10, y: 20 },
        width: 80,
        height: 40,
      },
      {
        id: 'node-2',
        type: 'test',
        position: { x: 120, y: 120 },
        width: 80,
        height: 40,
      },
    ])

    render(
      <CanvasRuntimeProvider {...providerValues}>
        <ResizableNodeWrapper id="node-1" nodeType="test" dragging={false}>
          <div>node body</div>
        </ResizableNodeWrapper>
      </CanvasRuntimeProvider>,
    )

    const handle = screen.getByTestId('canvas-node-resize-handle-bottom-right')
    act(() => {
      fireEvent.pointerDown(handle, { button: 0, pointerId: 1, clientX: 90, clientY: 60 })
      fireEvent.pointerMove(window, { pointerId: 1, clientX: 125, clientY: 63, ctrlKey: true })
    })

    expect(useCanvasDragSnapOverlayStore.getState().guides).toContainEqual(
      expect.objectContaining({ orientation: 'vertical', position: 120 }),
    )
    expect(providerValues.nodeActions.onResize).toHaveBeenLastCalledWith('node-1', 110, 43, {
      x: 10,
      y: 20,
    })

    act(() => {
      fireEvent.pointerUp(window, { pointerId: 1, clientX: 125, clientY: 63, ctrlKey: true })
    })

    expect(providerValues.nodeActions.onResizeEnd).toHaveBeenLastCalledWith('node-1', 110, 43, {
      x: 10,
      y: 20,
    })
    expect(useCanvasDragSnapOverlayStore.getState().guides).toEqual([])
  })

  it('snaps shift-resizing to nearby node edges while staying square', () => {
    const providerValues = createProviderValues()
    useCanvasSelectionState.getState().setSelection({
      nodeIds: new Set(['node-1']),
      edgeIds: new Set<string>(),
    })
    setResizeSnapTargets([
      {
        id: 'node-2',
        type: 'test',
        position: { x: 120, y: 300 },
        width: 80,
        height: 40,
      },
    ])

    render(
      <CanvasRuntimeProvider {...providerValues}>
        <ResizableNodeWrapper id="node-1" nodeType="test" dragging={false}>
          <div>node body</div>
        </ResizableNodeWrapper>
      </CanvasRuntimeProvider>,
    )

    const handle = screen.getByTestId('canvas-node-resize-handle-bottom-right')
    act(() => {
      fireEvent.pointerDown(handle, { button: 0, pointerId: 1, clientX: 90, clientY: 60 })
      fireEvent.pointerMove(window, {
        pointerId: 1,
        clientX: 125,
        clientY: 135,
        shiftKey: true,
        ctrlKey: true,
      })
    })

    expect(useCanvasDragSnapOverlayStore.getState().guides).toContainEqual(
      expect.objectContaining({ orientation: 'vertical', position: 120 }),
    )
    expect(providerValues.nodeActions.onResize).toHaveBeenLastCalledWith('node-1', 110, 110, {
      x: 10,
      y: 20,
    })

    act(() => {
      fireEvent.pointerUp(window, {
        pointerId: 1,
        clientX: 125,
        clientY: 135,
        shiftKey: true,
        ctrlKey: true,
      })
    })

    expect(providerValues.nodeActions.onResizeEnd).toHaveBeenLastCalledWith('node-1', 110, 110, {
      x: 10,
      y: 20,
    })
    expect(useCanvasDragSnapOverlayStore.getState().guides).toEqual([])
  })

  it('recomputes the live resize immediately when the primary snap modifier is pressed and released mid-drag', () => {
    const providerValues = createProviderValues()
    useCanvasSelectionState.getState().setSelection({
      nodeIds: new Set(['node-1']),
      edgeIds: new Set<string>(),
    })
    setResizeSnapTargets([
      {
        id: 'node-2',
        type: 'test',
        position: { x: 120, y: 300 },
        width: 80,
        height: 40,
      },
    ])

    render(
      <CanvasRuntimeProvider {...providerValues}>
        <ResizableNodeWrapper id="node-1" nodeType="test" dragging={false}>
          <div>node body</div>
        </ResizableNodeWrapper>
      </CanvasRuntimeProvider>,
    )

    const handle = screen.getByTestId('canvas-node-resize-handle-bottom-right')
    act(() => {
      fireEvent.pointerDown(handle, { button: 0, pointerId: 1, clientX: 90, clientY: 60 })
      fireEvent.pointerMove(window, { pointerId: 1, clientX: 125, clientY: 63 })
    })

    expect(providerValues.nodeActions.onResize).toHaveBeenLastCalledWith('node-1', 115, 43, {
      x: 10,
      y: 20,
    })
    expect(useCanvasDragSnapOverlayStore.getState().guides).toEqual([])

    act(() => {
      fireEvent.keyDown(window, { key: 'Control' })
    })

    expect(providerValues.nodeActions.onResize).toHaveBeenLastCalledWith('node-1', 110, 43, {
      x: 10,
      y: 20,
    })
    expect(useCanvasDragSnapOverlayStore.getState().guides).toContainEqual(
      expect.objectContaining({ orientation: 'vertical', position: 120 }),
    )

    act(() => {
      fireEvent.keyUp(window, { key: 'Control' })
    })

    expect(providerValues.nodeActions.onResize).toHaveBeenLastCalledWith('node-1', 115, 43, {
      x: 10,
      y: 20,
    })
    expect(useCanvasDragSnapOverlayStore.getState().guides).toEqual([])
  })

  it('keeps resize handles above overlay children such as stroke hit targets', () => {
    const providerValues = createProviderValues()
    useCanvasSelectionState.getState().setSelection({
      nodeIds: new Set(['node-1']),
      edgeIds: new Set<string>(),
    })

    render(
      <CanvasRuntimeProvider {...providerValues}>
        <ResizableNodeWrapper id="node-1" nodeType="stroke" dragging={false}>
          <div
            style={{
              position: 'absolute',
              inset: 0,
              pointerEvents: 'auto',
            }}
          >
            overlay
          </div>
        </ResizableNodeWrapper>
      </CanvasRuntimeProvider>,
    )

    const handle = screen.getByTestId('canvas-node-resize-handle-bottom-right')

    expect(handle).toHaveClass('canvas-node-resize-handle')
    expect(handle).toHaveStyle({
      width: '16px',
      height: '16px',
      right: '-8px',
      bottom: '-8px',
    })

    act(() => {
      fireEvent.pointerDown(handle, { button: 0, pointerId: 1, clientX: 90, clientY: 60 })
      fireEvent.pointerMove(window, { pointerId: 1, clientX: 110, clientY: 75 })
      fireEvent.pointerUp(window, { pointerId: 1, clientX: 110, clientY: 75 })
    })

    expect(providerValues.nodeActions.onResize).toHaveBeenCalled()
    expect(providerValues.nodeActions.onResizeEnd).toHaveBeenCalled()
  })

  it('suppresses selection chrome and resize handles in embedded read-only mode', () => {
    useCanvasSelectionState.getState().setSelection({
      nodeIds: new Set(['node-1']),
      edgeIds: new Set<string>(),
    })

    render(
      <CanvasRenderModeProvider mode="embedded-readonly">
        <CanvasRuntimeProvider {...createProviderValues()}>
          <ResizableNodeWrapper id="node-1" nodeType="test" dragging={false}>
            <div>node body</div>
          </ResizableNodeWrapper>
        </CanvasRuntimeProvider>
      </CanvasRenderModeProvider>,
    )

    expect(screen.queryByTestId('selection-border')).toBeNull()
    expect(screen.queryAllByTestId(/canvas-node-resize-handle-/)).toHaveLength(0)
  })

  it('locks resizing to the provided aspect ratio', () => {
    const providerValues = createProviderValues()
    useCanvasSelectionState.getState().setSelection({
      nodeIds: new Set(['node-1']),
      edgeIds: new Set<string>(),
    })

    render(
      <CanvasRuntimeProvider {...providerValues}>
        <ResizableNodeWrapper id="node-1" nodeType="test" dragging={false} lockedAspectRatio={2}>
          <div>node body</div>
        </ResizableNodeWrapper>
      </CanvasRuntimeProvider>,
    )

    const handle = screen.getByTestId('canvas-node-resize-handle-bottom-right')
    act(() => {
      fireEvent.pointerDown(handle, { button: 0, pointerId: 1, clientX: 90, clientY: 60 })
      fireEvent.pointerMove(window, { pointerId: 1, clientX: 110, clientY: 65 })
      fireEvent.pointerUp(window, { pointerId: 1, clientX: 110, clientY: 65 })
    })

    expect(providerValues.nodeActions.onResize).toHaveBeenLastCalledWith('node-1', 100, 50, {
      x: 10,
      y: 20,
    })
    expect(providerValues.nodeActions.onResizeEnd).toHaveBeenLastCalledWith('node-1', 100, 50, {
      x: 10,
      y: 20,
    })
  })

  it('snaps aspect-locked resizing on a single axis while preserving the ratio', () => {
    const providerValues = createProviderValues()
    useCanvasSelectionState.getState().setSelection({
      nodeIds: new Set(['node-1']),
      edgeIds: new Set<string>(),
    })
    setResizeSnapTargets([
      {
        id: 'node-2',
        type: 'test',
        position: { x: 300, y: 75 },
        width: 80,
        height: 40,
      },
    ])

    render(
      <CanvasRuntimeProvider {...providerValues}>
        <ResizableNodeWrapper id="node-1" nodeType="test" dragging={false} lockedAspectRatio={2}>
          <div>node body</div>
        </ResizableNodeWrapper>
      </CanvasRuntimeProvider>,
    )

    const handle = screen.getByTestId('canvas-node-resize-handle-bottom-right')
    act(() => {
      fireEvent.pointerDown(handle, { button: 0, pointerId: 1, clientX: 90, clientY: 60 })
      fireEvent.pointerMove(window, { pointerId: 1, clientX: 110, clientY: 72, ctrlKey: true })
    })

    expect(useCanvasDragSnapOverlayStore.getState().guides).toContainEqual(
      expect.objectContaining({ orientation: 'horizontal', position: 75 }),
    )
    expect(providerValues.nodeActions.onResize).toHaveBeenLastCalledWith('node-1', 110, 55, {
      x: 10,
      y: 20,
    })

    act(() => {
      fireEvent.pointerUp(window, { pointerId: 1, clientX: 110, clientY: 72, ctrlKey: true })
    })

    expect(providerValues.nodeActions.onResizeEnd).toHaveBeenLastCalledWith('node-1', 110, 55, {
      x: 10,
      y: 20,
    })
    expect(useCanvasDragSnapOverlayStore.getState().guides).toEqual([])
  })

  it('keeps snapping active when shift is released mid-drag after starting with square snapping', () => {
    modifierState.shiftPressed = true
    modifierState.primaryPressed = true
    const providerValues = createProviderValues()
    useCanvasSelectionState.getState().setSelection({
      nodeIds: new Set(['node-1']),
      edgeIds: new Set<string>(),
    })
    setResizeSnapTargets([
      {
        id: 'node-2',
        type: 'test',
        position: { x: 120, y: 300 },
        width: 80,
        height: 40,
      },
    ])

    render(
      <CanvasRuntimeProvider {...providerValues}>
        <ResizableNodeWrapper id="node-1" nodeType="test" dragging={false}>
          <div>node body</div>
        </ResizableNodeWrapper>
      </CanvasRuntimeProvider>,
    )

    const handle = screen.getByTestId('canvas-node-resize-handle-bottom-right')
    act(() => {
      fireEvent.pointerDown(handle, { button: 0, pointerId: 1, clientX: 90, clientY: 60 })
      fireEvent.pointerMove(window, {
        pointerId: 1,
        clientX: 125,
        clientY: 135,
        shiftKey: true,
        ctrlKey: true,
      })
    })

    expect(providerValues.nodeActions.onResize).toHaveBeenLastCalledWith('node-1', 110, 110, {
      x: 10,
      y: 20,
    })

    act(() => {
      fireEvent.keyUp(window, { key: 'Shift' })
    })

    expect(providerValues.nodeActions.onResize).toHaveBeenLastCalledWith('node-1', 110, 115, {
      x: 10,
      y: 20,
    })
    expect(useCanvasDragSnapOverlayStore.getState().guides).toContainEqual(
      expect.objectContaining({ orientation: 'vertical', position: 120 }),
    )
  })
})

function renderWrapper({ selected }: { selected: boolean }) {
  useCanvasSelectionState.getState().setSelection({
    nodeIds: selected ? new Set(['node-1']) : new Set<string>(),
    edgeIds: new Set<string>(),
  })

  return render(
    <CanvasRuntimeProvider {...createProviderValues()}>
      <ResizableNodeWrapper id="node-1" nodeType="test" dragging={false}>
        <div>node body</div>
      </ResizableNodeWrapper>
    </CanvasRuntimeProvider>,
  )
}

function createProviderValues() {
  return createCanvasRuntime({
    nodeActions: {
      updateNodeData: () => undefined,
      onResize: vi.fn(),
      onResizeEnd: vi.fn(),
    },
  })
}

function setResizeSnapTargets(
  extraNodes: Array<{
    id: string
    type: string
    position: { x: number; y: number }
    width: number
    height: number
  }>,
) {
  getNodesMock.mockReturnValue([
    {
      id: 'node-1',
      type: 'test',
      position: { x: 10, y: 20 },
      width: 80,
      height: 40,
    },
    ...extraNodes,
  ])
}
