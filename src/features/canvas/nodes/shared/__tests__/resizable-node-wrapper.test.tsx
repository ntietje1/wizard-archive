import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { createCanvasRuntime } from '../../../runtime/__tests__/canvas-runtime-test-utils'
import { CanvasRuntimeProvider } from '../../../runtime/providers/canvas-runtime-context'
import { CanvasRenderModeProvider } from '../../../runtime/providers/canvas-render-mode-context'
import {
  clearCanvasDragSnapGuides,
  useCanvasDragSnapOverlayStore,
} from '../../../runtime/interaction/canvas-drag-snap-overlay'
import { CanvasEngineProvider } from '../../../react/canvas-engine-context'
import { ResizableNodeWrapper } from '../resizable-node-wrapper'
import type { CanvasNode as Node } from '~/features/canvas/types/canvas-domain-types'

const modifierState = vi.hoisted(() => ({
  shiftPressed: false,
  primaryPressed: false,
}))
const canvasNodes = vi.hoisted(() => ({
  current: [
    {
      id: 'node-1',
      type: 'test',
      position: { x: 10, y: 20 },
      width: 80,
      height: 40,
    },
  ],
}))
let lastRuntime: ReturnType<typeof createCanvasRuntime> | null = null

vi.mock('../../../runtime/interaction/use-canvas-modifier-keys', () => ({
  useCanvasModifierKeys: () => modifierState,
}))

afterEach(() => {
  clearCanvasDragSnapGuides()
  modifierState.shiftPressed = false
  modifierState.primaryPressed = false
  canvasNodes.current = [
    {
      id: 'node-1',
      type: 'test',
      position: { x: 10, y: 20 },
      width: 80,
      height: 40,
    },
  ]
  lastRuntime = null
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
    renderWrapper({
      selected: false,
      pendingPreview: { nodeIds: new Set(['node-1']), edgeIds: new Set() },
    })

    expect(screen.getByTestId('selection-border')).toBeInTheDocument()
    expect(screen.queryAllByTestId(/canvas-node-resize-handle-/)).toHaveLength(0)
  })

  it('hides the local selection border for excluded committed nodes while keeping committed resize handles', () => {
    renderWrapper({
      selected: true,
      pendingPreview: { nodeIds: new Set(['other-node']), edgeIds: new Set() },
    })

    expect(screen.queryByTestId('selection-border')).toBeNull()
    expect(screen.queryAllByTestId(/canvas-node-resize-handle-/)).toHaveLength(4)
  })

  it('resizes to a square while shift is held', () => {
    modifierState.shiftPressed = true
    const providerValues = createProviderValues()
    providerValues.canvasEngine.setSelection({
      nodeIds: new Set(['node-1']),
      edgeIds: new Set<string>(),
    })

    renderWithRuntime(
      providerValues,
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
    providerValues.canvasEngine.setSelection({
      nodeIds: new Set(['node-1']),
      edgeIds: new Set<string>(),
    })

    renderWithRuntime(
      providerValues,
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
    modifierState.primaryPressed = true
    const providerValues = createProviderValues()
    providerValues.canvasEngine.setSelection({
      nodeIds: new Set(['node-1']),
      edgeIds: new Set<string>(),
    })
    setResizeSnapTargets([
      {
        id: 'node-2',
        type: 'test',
        position: { x: 120, y: 120 },
        width: 80,
        height: 40,
      },
    ])

    renderWithRuntime(
      providerValues,
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
    modifierState.shiftPressed = true
    modifierState.primaryPressed = true
    const providerValues = createProviderValues()
    providerValues.canvasEngine.setSelection({
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

    renderWithRuntime(
      providerValues,
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
    providerValues.canvasEngine.setSelection({
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

    renderWithRuntime(
      providerValues,
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
    providerValues.canvasEngine.setSelection({
      nodeIds: new Set(['node-1']),
      edgeIds: new Set<string>(),
    })

    renderWithRuntime(
      providerValues,
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
    const providerValues = createProviderValues()
    providerValues.canvasEngine.setSelection({
      nodeIds: new Set(['node-1']),
      edgeIds: new Set<string>(),
    })

    renderWithRuntime(
      providerValues,
      <CanvasRenderModeProvider mode="embedded-readonly">
        <CanvasRuntimeProvider {...providerValues}>
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
    providerValues.canvasEngine.setSelection({
      nodeIds: new Set(['node-1']),
      edgeIds: new Set<string>(),
    })

    renderWithRuntime(
      providerValues,
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
    modifierState.primaryPressed = true
    const providerValues = createProviderValues()
    providerValues.canvasEngine.setSelection({
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

    renderWithRuntime(
      providerValues,
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
    providerValues.canvasEngine.setSelection({
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

    renderWithRuntime(
      providerValues,
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

function renderWrapper({
  selected,
  pendingPreview = null,
}: {
  selected: boolean
  pendingPreview?: { nodeIds: ReadonlySet<string>; edgeIds: ReadonlySet<string> } | null
}) {
  const providerValues = createProviderValues()
  providerValues.canvasEngine.setSelection({
    nodeIds: selected ? new Set(['node-1']) : new Set<string>(),
    edgeIds: new Set<string>(),
  })
  if (pendingPreview) {
    providerValues.canvasEngine.setSelectionGesturePreview(pendingPreview)
  }

  return renderWithRuntime(
    providerValues,
    <CanvasRuntimeProvider {...providerValues}>
      <ResizableNodeWrapper id="node-1" nodeType="test" dragging={false}>
        <div>node body</div>
      </ResizableNodeWrapper>
    </CanvasRuntimeProvider>,
  )
}

function renderWithRuntime(
  runtime: ReturnType<typeof createCanvasRuntime>,
  ui: React.ReactElement,
) {
  return render(<CanvasEngineProvider engine={runtime.canvasEngine}>{ui}</CanvasEngineProvider>)
}

function createProviderValues() {
  const runtime = createCanvasRuntime({
    nodeActions: {
      onResize: vi.fn(),
      onResizeEnd: vi.fn(),
    },
  })
  runtime.canvasEngine.setDocumentSnapshot({ nodes: canvasNodes.current as Array<Node> })
  lastRuntime = runtime
  return runtime
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
  canvasNodes.current = [
    {
      id: 'node-1',
      type: 'test',
      position: { x: 10, y: 20 },
      width: 80,
      height: 40,
    },
    ...extraNodes,
  ]
  lastRuntime?.canvasEngine.setDocumentSnapshot({ nodes: canvasNodes.current as Array<Node> })
}
