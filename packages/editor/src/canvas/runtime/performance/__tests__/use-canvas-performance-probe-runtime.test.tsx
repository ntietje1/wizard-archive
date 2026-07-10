import { renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test'
import * as Y from 'yjs'
import { useCanvasPerformanceProbeRuntime } from '../use-canvas-performance-probe-runtime'
import type { CanvasDragController } from '../../../system/canvas-drag-controller'
import type { CanvasEngine } from '../../../system/canvas-engine-types'
import type { CanvasViewportController } from '../../../system/canvas-viewport-controller'
import type {
  CanvasDocumentWriter,
  CanvasSelectionController,
} from '../../../tools/canvas-tool-types'
import type { CanvasDocumentEdge, CanvasDocumentNode } from '../../../document-contract'
import type { SidebarItemId } from '../../../../../../../shared/common/ids'

describe('useCanvasPerformanceProbeRuntime', () => {
  beforeEach(() => {
    window.__WA_CANVAS_PERF__ = { enabled: true, entries: [] }
  })

  afterEach(() => {
    window.__WA_CANVAS_PERF__ = undefined
    window.__WA_CANVAS_PERF_RUNTIME__ = undefined
  })

  it('seeds text nodes with finite grid inputs', () => {
    const harness = createPerformanceHarness()
    renderHook(() => useCanvasPerformanceProbeRuntime(harness))

    window.__WA_CANVAS_PERF_RUNTIME__?.seedTextNodes({
      count: 2,
      start: { x: 10, y: 20 },
      spacingX: 30,
      spacingY: 40,
      size: { width: 120, height: 48 },
    })

    expect(harness.nodesMap.size).toBe(2)
    expect([...harness.nodesMap.keys()]).toEqual(['perf-node-0', 'perf-node-1'])
  })

  it('rejects invalid probe geometry before mutating the document', () => {
    const harness = createPerformanceHarness()
    renderHook(() => useCanvasPerformanceProbeRuntime(harness))

    expect(() =>
      window.__WA_CANVAS_PERF_RUNTIME__?.seedTextNodes({
        count: 1,
        spacingX: Number.POSITIVE_INFINITY,
      }),
    ).toThrow('spacingX must be finite')
    expect(harness.nodesMap.size).toBe(0)

    expect(() => window.__WA_CANVAS_PERF_RUNTIME__?.setViewport({ x: 0, y: 0, zoom: 0 })).toThrow(
      'viewport.zoom must be a positive finite number',
    )
    expect(harness.viewportController.syncFromDocumentOrAdapter).not.toHaveBeenCalled()
  })

  it('flushes pending provider updates when requested', async () => {
    const flushUpdates = vi.fn(() => Promise.resolve())
    const harness = createPerformanceHarness({ flushUpdates })
    renderHook(() => useCanvasPerformanceProbeRuntime(harness))

    await window.__WA_CANVAS_PERF_RUNTIME__?.flushUpdates()

    expect(flushUpdates).toHaveBeenCalledTimes(1)
  })
})

function createPerformanceHarness({
  flushUpdates,
}: {
  flushUpdates?: () => Promise<void>
} = {}) {
  const doc = new Y.Doc()
  const nodesMap = doc.getMap<CanvasDocumentNode>('nodes')
  const edgesMap = doc.getMap<CanvasDocumentEdge>('edges')
  const viewportController = {
    getViewport: vi.fn(() => ({ x: 0, y: 0, zoom: 1 })),
    syncFromDocumentOrAdapter: vi.fn(),
  } as unknown as CanvasViewportController

  return {
    canvasId: 'canvas-id' as SidebarItemId,
    canvasEngine: {
      getSnapshot: () => ({ nodeLookup: new Map() }),
    } as unknown as CanvasEngine,
    canEdit: true,
    documentWriter: {
      execute: vi.fn((command) => ({
        type: 'completed' as const,
        command: command.type,
        affectedCount: 0,
      })),
      createNode: vi.fn(),
      createNodes: vi.fn(),
      createEdge: vi.fn(),
      deleteEdges: vi.fn(),
      deleteNodes: vi.fn(),
      patchEdges: vi.fn(),
      patchNodeData: vi.fn(),
      resizeNode: vi.fn(),
      resizeNodes: vi.fn(),
      setNodePositions: vi.fn(),
    } satisfies CanvasDocumentWriter,
    doc,
    dragController: {
      profileDrag: vi.fn(),
    } as unknown as CanvasDragController,
    edgesMap,
    nodesMap,
    provider: flushUpdates ? ({ flushUpdates } as never) : null,
    selection: {
      clearSelection: vi.fn(),
      getSnapshot: vi.fn(() => ({ nodeIds: new Set<string>(), edgeIds: new Set<string>() })),
      setSelection: vi.fn(),
    } as unknown as CanvasSelectionController,
    viewportController,
  }
}
