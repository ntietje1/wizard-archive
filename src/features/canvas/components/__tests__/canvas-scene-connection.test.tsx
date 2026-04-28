import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { CanvasScene } from '../canvas-scene'
import { CanvasEngineProvider } from '../../react/canvas-engine-context'
import { createCanvasRuntime } from '../../runtime/__tests__/canvas-runtime-test-utils'
import { CanvasRuntimeProvider } from '../../runtime/providers/canvas-runtime-context'
import { createCanvasDomRuntime } from '../../system/canvas-dom-runtime'
import { createCanvasEngine } from '../../system/canvas-engine'
import type { CanvasConnection, CanvasDocumentNode as Node } from '../../types/canvas-domain-types'

vi.mock('../canvas-background', () => ({
  CanvasBackground: () => null,
}))

vi.mock('../canvas-edge-renderer', () => ({
  CanvasEdgeRenderer: () => null,
}))

vi.mock('../canvas-local-overlays-host', () => ({
  CanvasLocalOverlaysHost: () => null,
}))

vi.mock('../canvas-awareness-host', () => ({
  CanvasAwarenessHost: () => null,
}))

vi.mock('../canvas-node-renderer', () => ({
  CanvasNodeRenderer: () => (
    <>
      <div data-node-id="source" data-testid="source-node">
        <div
          data-canvas-node-handle="true"
          data-handle-id="right"
          data-handle-position="right"
          data-testid="source-right-handle"
        />
        <div
          data-canvas-node-handle="true"
          data-handle-id="left"
          data-handle-position="left"
          data-testid="source-left-handle"
        />
      </div>
      <div data-node-id="target" data-testid="target-node">
        <div
          data-canvas-node-handle="true"
          data-handle-id="left"
          data-handle-position="left"
          data-testid="target-left-handle"
        />
      </div>
    </>
  ),
}))

const sourceNode: Node = {
  id: 'source',
  type: 'text',
  position: { x: 0, y: 0 },
  width: 100,
  height: 50,
  data: {},
}
const targetNode: Node = {
  id: 'target',
  type: 'text',
  position: { x: 200, y: 0 },
  width: 100,
  height: 50,
  data: {},
}

let engine: ReturnType<typeof createCanvasEngine> | null = null
let domRuntime: ReturnType<typeof createCanvasDomRuntime> | null = null

function setElementRect(
  element: Element,
  rect: { left: number; top: number; width: number; height: number },
) {
  Object.defineProperty(element, 'getBoundingClientRect', {
    configurable: true,
    value: () => ({
      ...rect,
      bottom: rect.top + rect.height,
      right: rect.left + rect.width,
      x: rect.left,
      y: rect.top,
      toJSON: () => ({}),
    }),
  })
}

function renderScene(createEdgeFromConnection = vi.fn(), canEdit = true) {
  engine?.destroy()
  domRuntime?.destroy()
  domRuntime = createCanvasDomRuntime()
  engine = createCanvasEngine({ domRuntime })
  const currentEngine = engine
  const currentDomRuntime = domRuntime
  currentEngine.setDocumentSnapshot({ nodes: [sourceNode, targetNode] })
  render(
    <CanvasEngineProvider engine={currentEngine}>
      <CanvasRuntimeProvider
        {...createCanvasRuntime({
          canEdit,
          canvasEngine: currentEngine,
          domRuntime: currentDomRuntime,
        })}
      >
        <CanvasScene
          canEdit={canEdit}
          remoteUsers={[]}
          sceneHandlers={{ createEdgeFromConnection }}
          onNodeContextMenu={vi.fn()}
          onEdgeContextMenu={vi.fn()}
          onPaneContextMenu={vi.fn()}
        />
      </CanvasRuntimeProvider>
    </CanvasEngineProvider>,
  )

  setElementRect(screen.getByTestId('canvas-scene'), { left: 0, top: 0, width: 800, height: 600 })
  setElementRect(screen.getByTestId('source-right-handle'), {
    left: 96,
    top: 21,
    width: 8,
    height: 8,
  })
  setElementRect(screen.getByTestId('source-left-handle'), {
    left: -4,
    top: 21,
    width: 8,
    height: 8,
  })
  setElementRect(screen.getByTestId('target-left-handle'), {
    left: 196,
    top: 21,
    width: 8,
    height: 8,
  })

  return { createEdgeFromConnection }
}

async function startConnectionDrag() {
  fireEvent.pointerDown(screen.getByTestId('source-right-handle'), {
    button: 0,
    clientX: 100,
    clientY: 25,
    pointerId: 1,
  })
  await waitFor(() => expect(screen.getByTestId('canvas-connection-preview')).toBeInTheDocument())
}

describe('CanvasScene connection creation', () => {
  afterEach(() => {
    engine?.destroy()
    engine = null
    domRuntime?.destroy()
    domRuntime = null
    vi.clearAllMocks()
  })

  it('snaps the live preview to a nearby compatible handle and commits that target', async () => {
    const createEdgeFromConnection = vi.fn()
    renderScene(createEdgeFromConnection)

    await startConnectionDrag()
    fireEvent.pointerMove(window, { clientX: 206, clientY: 25, pointerId: 1 })

    await waitFor(() =>
      expect(screen.getByTestId('canvas-connection-preview')).toHaveAttribute(
        'data-snap-target',
        'true',
      ),
    )

    fireEvent.pointerUp(window, { clientX: 206, clientY: 25, pointerId: 1 })

    expect(createEdgeFromConnection).toHaveBeenCalledWith({
      source: 'source',
      target: 'target',
      sourceHandle: 'right',
      targetHandle: 'left',
    } satisfies CanvasConnection)
  })

  it('cancels the connection when pointer-up has no snapped target', async () => {
    const createEdgeFromConnection = vi.fn()
    renderScene(createEdgeFromConnection)

    await startConnectionDrag()
    fireEvent.pointerUp(window, { clientX: 500, clientY: 500, pointerId: 1 })

    expect(createEdgeFromConnection).not.toHaveBeenCalled()
  })

  it('does not snap or commit to a handle on the source node', async () => {
    const createEdgeFromConnection = vi.fn()
    renderScene(createEdgeFromConnection)

    await startConnectionDrag()
    fireEvent.pointerMove(window, { clientX: 0, clientY: 25, pointerId: 1 })
    fireEvent.pointerUp(window, { clientX: 0, clientY: 25, pointerId: 1 })

    expect(createEdgeFromConnection).not.toHaveBeenCalled()
  })

  it('does not start connection creation while editing is disabled', () => {
    const createEdgeFromConnection = vi.fn()
    renderScene(createEdgeFromConnection, false)

    fireEvent.pointerDown(screen.getByTestId('source-right-handle'), {
      button: 0,
      clientX: 100,
      clientY: 25,
      pointerId: 1,
    })

    expect(screen.queryByTestId('canvas-connection-preview')).toBeNull()
    expect(createEdgeFromConnection).not.toHaveBeenCalled()
  })

  it('cancels the active connection draft on escape', async () => {
    const createEdgeFromConnection = vi.fn()
    renderScene(createEdgeFromConnection)

    await startConnectionDrag()
    fireEvent.keyDown(screen.getByTestId('canvas-scene'), { key: 'Escape' })
    fireEvent.pointerUp(window, { clientX: 206, clientY: 25, pointerId: 1 })

    expect(screen.queryByTestId('canvas-connection-preview')).toBeNull()
    expect(createEdgeFromConnection).not.toHaveBeenCalled()
  })

  it('ignores move, cancel, and up events from other pointers', async () => {
    const createEdgeFromConnection = vi.fn()
    renderScene(createEdgeFromConnection)

    await startConnectionDrag()
    fireEvent.pointerMove(window, { clientX: 206, clientY: 25, pointerId: 2 })
    fireEvent.pointerCancel(window, { clientX: 206, clientY: 25, pointerId: 2 })
    fireEvent.pointerUp(window, { clientX: 206, clientY: 25, pointerId: 2 })

    expect(screen.getByTestId('canvas-connection-preview')).toHaveAttribute(
      'data-snap-target',
      'false',
    )
    expect(createEdgeFromConnection).not.toHaveBeenCalled()

    fireEvent.pointerMove(window, { clientX: 206, clientY: 25, pointerId: 1 })
    fireEvent.pointerUp(window, { clientX: 206, clientY: 25, pointerId: 1 })

    expect(createEdgeFromConnection).toHaveBeenCalledWith({
      source: 'source',
      target: 'target',
      sourceHandle: 'right',
      targetHandle: 'left',
    } satisfies CanvasConnection)
  })
})
