import { describe, expect, it, vi } from 'vite-plus/test'
import { createInitialCanvasSelectionState } from '../canvas-selection'
import {
  EMPTY_EDGE_IDS_BY_NODE_ID,
  EMPTY_EDGE_LOOKUP,
  EMPTY_EDGES,
  EMPTY_IDS,
  EMPTY_NODE_LOOKUP,
  EMPTY_NODES,
  EMPTY_SET,
} from '../canvas-document-projector'
import { createCanvasStore } from '../canvas-store'
import { DEFAULT_CANVAS_VIEWPORT } from '../canvas-viewport-manager'
import type { CanvasEngineSnapshot } from '../canvas-engine-types'

describe('createCanvasStore', () => {
  it('isolates throwing listeners across store and viewport notifications', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const store = createCanvasStore(createSnapshot())
    const throwingListener = vi.fn(() => {
      throw new Error('listener failed')
    })
    const storeListener = vi.fn()
    const viewportChangeListener = vi.fn()
    const viewportCommitListener = vi.fn()

    store.subscribe(throwingListener)
    store.subscribe(storeListener)
    store.subscribeViewportChange(throwingListener)
    store.subscribeViewportChange(viewportChangeListener)
    store.subscribeViewportCommit(throwingListener)
    store.subscribeViewportCommit(viewportCommitListener)

    store.notify()
    store.emitViewportChange({ x: 1, y: 2, zoom: 3 })
    store.emitViewportCommit({ x: 4, y: 5, zoom: 6 })

    expect(storeListener).toHaveBeenCalledTimes(1)
    expect(viewportChangeListener).toHaveBeenCalledWith({ x: 1, y: 2, zoom: 3 })
    expect(viewportCommitListener).toHaveBeenCalledWith({ x: 4, y: 5, zoom: 6 })
    expect(consoleError).toHaveBeenCalledTimes(3)

    consoleError.mockRestore()
  })

  it('notifies selector subscribers only when equality reports a changed value', () => {
    const store = createCanvasStore(createSnapshot())
    const listener = vi.fn()
    store.subscribeSelector((snapshot) => snapshot.viewport.zoom, listener)

    store.setSnapshot(
      { ...store.getSnapshot(), viewport: { x: 10, y: 0, zoom: 1 } },
      { notify: true },
    )
    store.setSnapshot(
      { ...store.getSnapshot(), viewport: { x: 10, y: 0, zoom: 2 } },
      { notify: true },
    )

    expect(listener).toHaveBeenCalledTimes(1)
    expect(listener).toHaveBeenCalledWith(2, 1)
  })

  it('applies version and notification options explicitly', () => {
    const store = createCanvasStore(createSnapshot())
    const listener = vi.fn()
    store.subscribe(listener)

    store.setSnapshot({ ...store.getSnapshot(), nodes: [] })
    expect(store.getSnapshot().version).toBe(0)
    expect(listener).not.toHaveBeenCalled()

    store.setSnapshot(
      { ...store.getSnapshot(), viewport: { x: 1, y: 2, zoom: 1 } },
      { incrementVersion: true, notify: true },
    )

    expect(store.getSnapshot().version).toBe(1)
    expect(listener).toHaveBeenCalledTimes(1)
  })
})

function createSnapshot(): CanvasEngineSnapshot {
  return {
    nodes: EMPTY_NODES,
    edges: EMPTY_EDGES,
    nodeIds: EMPTY_IDS,
    edgeIds: EMPTY_IDS,
    nodeLookup: EMPTY_NODE_LOOKUP,
    edgeLookup: EMPTY_EDGE_LOOKUP,
    edgeIdsByNodeId: EMPTY_EDGE_IDS_BY_NODE_ID,
    selection: createInitialCanvasSelectionState(),
    selectedNodeIds: EMPTY_SET,
    selectedEdgeIds: EMPTY_SET,
    dirtyNodeIds: EMPTY_SET,
    dirtyEdgeIds: EMPTY_SET,
    viewport: DEFAULT_CANVAS_VIEWPORT,
    cameraState: 'idle',
    debouncedZoomLevel: DEFAULT_CANVAS_VIEWPORT.zoom,
    version: 0,
  }
}
