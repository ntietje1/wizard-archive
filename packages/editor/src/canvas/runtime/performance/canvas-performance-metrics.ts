import type { ResourceId, CanvasNodeId } from '../../../resources/domain-id'
import type { CanvasPosition } from '../../types/canvas-domain-types'
import type {
  CanvasDocumentEdge,
  CanvasDocumentNode,
  CanvasTextDocumentNode,
} from '../../document-contract'

interface CanvasPerformanceMetric {
  name: string
  durationMs: number
  timestampMs: number
  details?: Record<string, unknown>
}

type CanvasRuntimeSelectionInput =
  | { nodeIds: Array<CanvasNodeId>; edgeIds?: Array<string> }
  | { nodeIds?: Array<CanvasNodeId>; edgeIds: Array<string> }

interface CanvasPerformanceRuntime {
  clearCanvas: () => void
  getCounts: () => { nodes: number; edges: number }
  getCanvasId: () => ResourceId
  getSnapshot: () => {
    nodes: Array<CanvasDocumentNode>
    edges: Array<CanvasDocumentEdge>
    selection: { nodeIds: Array<CanvasNodeId>; edgeIds: Array<string> }
    viewport: { x: number; y: number; zoom: number }
  }
  getMetrics: () => Array<CanvasPerformanceMetric>
  clearMetrics: () => void
  /**
   * Sets runtime selection explicitly. Pass an empty array to clear one axis;
   * omitting both nodeIds and edgeIds is invalid.
   */
  setSelection: (selection: CanvasRuntimeSelectionInput) => void
  seedTextNodes: (options: {
    count: number
    columns?: number
    nodeIds?: Array<CanvasNodeId>
    labelPrefix?: string
    size?: { width: number; height: number }
    spacingX?: number
    spacingY?: number
    /** Grid origin for generated text nodes. */
    start?: CanvasPosition
    style?: Partial<CanvasTextDocumentNode['data']>
    zIndex?: number
  }) => void
  seedCoordinateProbeNode: (options: { id: CanvasNodeId; start?: CanvasPosition }) => void
  seedStrokeNodes: (options: {
    count: number
    columns?: number
    nodeIds?: Array<CanvasNodeId>
    spacingX?: number
    spacingY?: number
    /** Grid origin for generated stroke nodes. */
    start?: CanvasPosition
    pointsPerStroke?: number
    style?: {
      color?: string
      opacity?: number
      size?: number
    }
    zIndex?: number
  }) => void
  seedEdge: (options: {
    id?: string
    source: CanvasNodeId
    target: CanvasNodeId
    sourceHandle?: string
    targetHandle?: string
    type?: CanvasDocumentEdge['type']
    style?: CanvasDocumentEdge['style']
    zIndex?: number
  }) => void
  seedEmbedNode: (options: {
    id: CanvasNodeId
    resourceId: ResourceId
    position: CanvasPosition
    width?: number
    height?: number
    zIndex?: number
  }) => void
  selectFirstNodes: (count: number) => void
  getSelectedCount: () => number
  profileSelectedNodeDrag: (options: { delta: CanvasPosition; steps: number }) => void
  getNodePosition: (nodeId: string) => CanvasPosition | null
  setViewport: (viewport: { x: number; y: number; zoom: number }) => void
  getViewport: () => { x: number; y: number; zoom: number }
  flushUpdates: () => Promise<void>
  updateSelectedNodeSurface: () => void
}

interface CanvasPerformanceCollector {
  enabled?: boolean
  entries: Array<CanvasPerformanceMetric>
  record?: (entry: CanvasPerformanceMetric) => void
}

declare global {
  interface Window {
    __WA_CANVAS_PERF__?: CanvasPerformanceCollector
    __WA_CANVAS_PERF_RUNTIME__?: CanvasPerformanceRuntime
  }
}

function getCanvasPerformanceCollector(): CanvasPerformanceCollector | null {
  if (typeof window === 'undefined') {
    return null
  }

  const collector = window.__WA_CANVAS_PERF__
  return collector?.enabled ? collector : null
}

export function isCanvasPerformanceEnabled() {
  return getCanvasPerformanceCollector() !== null
}

export function measureCanvasPerformance<TResult>(
  name: string,
  details: Record<string, unknown>,
  action: () => Promise<TResult>,
): Promise<TResult>
export function measureCanvasPerformance<TResult>(
  name: string,
  details: Record<string, unknown>,
  action: () => TResult,
): TResult
export function measureCanvasPerformance<TResult>(
  name: string,
  details: Record<string, unknown>,
  action: () => TResult | Promise<TResult>,
): TResult | Promise<TResult> {
  const collector = getCanvasPerformanceCollector()
  if (!collector) {
    return action()
  }

  const start = performance.now()
  const record = () => {
    const endTime = performance.now()
    const entry = {
      name,
      details,
      durationMs: endTime - start,
      timestampMs: endTime,
    }
    tryStoreCanvasPerformanceMetric(collector, entry)
  }

  try {
    const result = action()
    if (result instanceof Promise) {
      return result.finally(record)
    }

    record()
    return result
  } catch (error) {
    record()
    throw error
  }
}

export function recordCanvasPerformanceMetric(
  name: string,
  durationMs: number,
  details?: Record<string, unknown>,
) {
  const collector = getCanvasPerformanceCollector()
  if (!collector) {
    return
  }

  const entry = {
    name,
    details,
    durationMs,
    timestampMs: performance.now(),
  }
  tryStoreCanvasPerformanceMetric(collector, entry)
}

export function exposeCanvasPerformanceRuntime(runtime: CanvasPerformanceRuntime) {
  if (typeof window === 'undefined' || !isCanvasPerformanceEnabled()) {
    return () => undefined
  }

  window.__WA_CANVAS_PERF_RUNTIME__ = runtime
  return () => {
    if (window.__WA_CANVAS_PERF_RUNTIME__ === runtime) {
      window.__WA_CANVAS_PERF_RUNTIME__ = undefined
    }
  }
}

function tryStoreCanvasPerformanceMetric(
  collector: CanvasPerformanceCollector,
  entry: CanvasPerformanceMetric,
) {
  try {
    collector.entries.push(entry)
    collector.record?.(entry)
  } catch {
    // Debug collectors must not alter editor runtime behavior.
  }
}
