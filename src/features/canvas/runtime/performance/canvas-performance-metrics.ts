import type { XYPosition } from '@xyflow/react'

interface CanvasPerformanceMetric {
  name: string
  durationMs: number
  timestampMs: number
  details?: Record<string, unknown>
}

interface CanvasPerformanceRuntime {
  clearCanvas: () => void
  getCounts: () => { nodes: number; edges: number }
  seedTextNodes: (options: {
    count: number
    columns?: number
    spacingX?: number
    spacingY?: number
    start?: XYPosition
  }) => void
  seedStrokeNodes: (options: {
    count: number
    columns?: number
    spacingX?: number
    spacingY?: number
    start?: XYPosition
    pointsPerStroke?: number
  }) => void
  selectFirstNodes: (count: number) => void
  getSelectedCount: () => number
  profileSelectedNodeDrag: (options: { delta: XYPosition; steps: number }) => void
  getNodePosition: (nodeId: string) => XYPosition | null
  setViewport: (viewport: { x: number; y: number; zoom: number }) => void
  getViewport: () => { x: number; y: number; zoom: number }
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
  action: () => TResult,
): TResult {
  const collector = getCanvasPerformanceCollector()
  if (!collector) {
    return action()
  }

  const start = performance.now()
  try {
    return action()
  } finally {
    const endTime = performance.now()
    const entry = {
      name,
      details,
      durationMs: endTime - start,
      timestampMs: endTime,
    }
    collector.entries.push(entry)
    collector.record?.(entry)
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
  collector.entries.push(entry)
  collector.record?.(entry)
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
