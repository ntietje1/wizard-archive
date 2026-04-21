import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { CanvasProviders } from '../../../runtime/providers/canvas-runtime-context'
import { useCanvasSelectionState } from '../../../runtime/selection/use-canvas-selection-state'
import {
  clearCanvasPendingSelectionPreview,
  setCanvasPendingSelectionPreview,
} from '../../../runtime/selection/use-canvas-pending-selection-preview'
import { ResizableNodeWrapper } from '../resizable-node-wrapper'

const modifierState = vi.hoisted(() => ({
  shiftPressed: false,
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

vi.mock('../../../runtime/interaction/use-canvas-modifier-keys', () => ({
  useCanvasModifierKeys: () => modifierState,
}))

vi.mock('@xyflow/react', () => ({
  useInternalNode: () => useInternalNodeMock(),
  useReactFlow: () => ({
    screenToFlowPosition: screenToFlowPositionMock,
  }),
}))

afterEach(() => {
  clearCanvasPendingSelectionPreview()
  useCanvasSelectionState.getState().reset()
  modifierState.shiftPressed = false
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
    setCanvasPendingSelectionPreview({ nodeIds: ['node-1'], edgeIds: [] })
    renderWrapper({ selected: false })

    expect(screen.getByTestId('selection-border')).toBeInTheDocument()
    expect(screen.queryAllByTestId(/canvas-node-resize-handle-/)).toHaveLength(0)
  })

  it('hides the local selection border for excluded committed nodes while keeping committed resize handles', () => {
    setCanvasPendingSelectionPreview({ nodeIds: ['other-node'], edgeIds: [] })
    renderWrapper({ selected: true })

    expect(screen.queryByTestId('selection-border')).toBeNull()
    expect(screen.queryAllByTestId(/canvas-node-resize-handle-/)).toHaveLength(4)
  })

  it('resizes to a square while shift is held', () => {
    modifierState.shiftPressed = true
    const providerValues = createProviderValues()
    useCanvasSelectionState.getState().setSelection({
      nodeIds: ['node-1'],
      edgeIds: [],
    })

    render(
      <CanvasProviders runtime={providerValues}>
        <ResizableNodeWrapper id="node-1" nodeType="test" dragging={false}>
          <div>node body</div>
        </ResizableNodeWrapper>
      </CanvasProviders>,
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
      nodeIds: ['node-1'],
      edgeIds: [],
    })

    render(
      <CanvasProviders runtime={providerValues}>
        <ResizableNodeWrapper id="node-1" nodeType="test" dragging={false}>
          <div>node body</div>
        </ResizableNodeWrapper>
      </CanvasProviders>,
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

  it('keeps resize handles above overlay children such as stroke hit targets', () => {
    const providerValues = createProviderValues()
    useCanvasSelectionState.getState().setSelection({
      nodeIds: ['node-1'],
      edgeIds: [],
    })

    render(
      <CanvasProviders runtime={providerValues}>
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
      </CanvasProviders>,
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
})

function renderWrapper({ selected }: { selected: boolean }) {
  useCanvasSelectionState.getState().setSelection({
    nodeIds: selected ? ['node-1'] : [],
    edgeIds: [],
  })

  return render(
    <CanvasProviders runtime={createProviderValues()}>
      <ResizableNodeWrapper id="node-1" nodeType="test" dragging={false}>
        <div>node body</div>
      </ResizableNodeWrapper>
    </CanvasProviders>,
  )
}

function createProviderValues() {
  return {
    canEdit: true,
    remoteHighlights: new Map(),
    history: {
      canUndo: false,
      canRedo: false,
      undo: () => undefined,
      redo: () => undefined,
    },
    editSession: {
      editingEmbedId: null,
      setEditingEmbedId: () => undefined,
      pendingEditNodeId: null,
      pendingEditNodePoint: null,
      setPendingEditNodeId: () => undefined,
      setPendingEditNodePoint: () => undefined,
    },
    nodeActions: {
      updateNodeData: () => undefined,
      onResize: vi.fn(),
      onResizeEnd: vi.fn(),
    },
  }
}
