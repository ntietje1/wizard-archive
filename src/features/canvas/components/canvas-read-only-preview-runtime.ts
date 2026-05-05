import { useEffect, useLayoutEffect, useRef } from 'react'
import { applyCanvasBackgroundViewport } from './canvas-background-viewport'
import { resolveCanvasReadOnlyPreviewViewport } from './canvas-read-only-preview-fit'
import { createCanvasDomRuntime } from '../system/canvas-dom-runtime'
import { createCanvasEngine } from '../system/canvas-engine'
import { createCanvasViewportController } from '../system/canvas-viewport-controller'
import {
  readElementBorderBoxSize,
  readResizeObserverBorderBoxSize,
} from '../system/canvas-element-size'
import { useCanvasViewportInteractions } from '../runtime/interaction/use-canvas-viewport-interactions'
import type { CanvasElementSize } from '../system/canvas-element-size'
import type { CanvasDocumentEdge, CanvasDocumentNode } from '../types/canvas-domain-types'
import type { RefObject } from 'react'

export function useCanvasReadOnlyPreviewRuntime({
  edges,
  fitPadding,
  interactive,
  maxZoom,
  minZoom,
  nodes,
}: {
  edges: ReadonlyArray<CanvasDocumentEdge>
  fitPadding: number
  interactive: boolean
  maxZoom: number
  minZoom: number
  nodes: ReadonlyArray<CanvasDocumentNode>
}) {
  const surfaceRef = useRef<HTMLDivElement | null>(null)
  const backgroundRef = useRef<HTMLDivElement | null>(null)
  const viewportRef = useRef<HTMLDivElement | null>(null)
  const domRuntimeRef = useRef<ReturnType<typeof createCanvasDomRuntime> | null>(null)
  domRuntimeRef.current ??= createCanvasDomRuntime()
  const domRuntime = domRuntimeRef.current
  const canvasEngineRef = useRef<ReturnType<typeof createCanvasEngine> | null>(null)
  canvasEngineRef.current ??= createCanvasEngine({ domRuntime })
  const canvasEngine = canvasEngineRef.current
  const viewportControllerRef = useRef<ReturnType<typeof createCanvasViewportController> | null>(
    null,
  )
  viewportControllerRef.current ??= createCanvasViewportController({
    canvasEngine,
    domRuntime,
    getSurfaceElement: () => surfaceRef.current,
    maxZoom,
    minZoom,
  })
  const viewportController = viewportControllerRef.current

  useEffect(() => {
    canvasEngine.setDocumentSnapshot({ nodes, edges })
  }, [canvasEngine, edges, nodes])

  useLayoutEffect(() => {
    viewportController.setZoomBounds({ maxZoom, minZoom })
  }, [maxZoom, minZoom, viewportController])

  useCanvasReadOnlyPreviewFit({
    canvasEngine,
    fitPadding,
    maxZoom,
    minZoom,
    nodes,
    surfaceRef,
    viewportController,
  })
  useCanvasReadOnlyPreviewBackground({ backgroundRef, canvasEngine })

  useEffect(() => () => domRuntime.destroy(), [domRuntime])
  useEffect(() => () => canvasEngine.destroy(), [canvasEngine])
  useEffect(() => () => viewportController.destroy(), [viewportController])

  useCanvasViewportInteractions({
    ref: surfaceRef,
    viewportController,
    canPrimaryPan: () => interactive,
    enabled: interactive,
  })

  return {
    backgroundRef,
    canvasEngine,
    domRuntime,
    surfaceRef,
    viewportRef,
  }
}

function useCanvasReadOnlyPreviewBackground({
  backgroundRef,
  canvasEngine,
}: {
  backgroundRef: RefObject<HTMLElement | null>
  canvasEngine: ReturnType<typeof createCanvasEngine>
}) {
  useEffect(() => {
    const syncBackground = () => {
      applyCanvasBackgroundViewport(backgroundRef.current, canvasEngine.getSnapshot().viewport)
    }

    syncBackground()
    return canvasEngine.subscribeViewportChange(syncBackground)
  }, [backgroundRef, canvasEngine])
}

function useCanvasReadOnlyPreviewFit({
  canvasEngine,
  fitPadding,
  maxZoom,
  minZoom,
  nodes,
  surfaceRef,
  viewportController,
}: {
  canvasEngine: ReturnType<typeof createCanvasEngine>
  fitPadding: number
  maxZoom: number
  minZoom: number
  nodes: ReadonlyArray<CanvasDocumentNode>
  surfaceRef: RefObject<HTMLElement | null>
  viewportController: ReturnType<typeof createCanvasViewportController>
}) {
  const frameRef = useRef<number | null>(null)
  const pendingSizeRef = useRef<CanvasElementSize | null>(null)
  const lastSizeRef = useRef<CanvasElementSize | null>(null)

  useLayoutEffect(() => {
    const fitToSize = (size: CanvasElementSize) => {
      lastSizeRef.current = size
      const viewport = resolveCanvasReadOnlyPreviewViewport({
        fallbackNodes: nodes,
        fitPadding,
        minZoom,
        maxZoom,
        size,
        snapshot: canvasEngine.getSnapshot(),
      })
      viewportController.syncFromDocumentOrAdapter(viewport)
    }

    const scheduleFit = (size: CanvasElementSize) => {
      lastSizeRef.current = size
      pendingSizeRef.current = size
      if (frameRef.current !== null) {
        return
      }

      if (typeof requestAnimationFrame === 'undefined') {
        const nextSize = pendingSizeRef.current
        pendingSizeRef.current = null
        if (nextSize) {
          fitToSize(nextSize)
        }
        return
      }

      frameRef.current = requestAnimationFrame(() => {
        frameRef.current = null
        const nextSize = pendingSizeRef.current
        pendingSizeRef.current = null
        if (nextSize) {
          fitToSize(nextSize)
        }
      })
    }

    const element = surfaceRef.current
    if (!element) {
      return undefined
    }

    fitToSize(readElementBorderBoxSize(element))
    const unsubscribeEngine = canvasEngine.subscribe(() => {
      const size = lastSizeRef.current
      if (size) {
        scheduleFit(size)
      }
    })
    if (typeof ResizeObserver === 'undefined') {
      return unsubscribeEngine
    }

    const observer = new ResizeObserver(([entry]) => {
      if (entry) {
        scheduleFit(readResizeObserverBorderBoxSize(entry))
      }
    })
    observer.observe(element)
    return () => {
      unsubscribeEngine()
      observer.disconnect()
      if (frameRef.current !== null && typeof cancelAnimationFrame !== 'undefined') {
        cancelAnimationFrame(frameRef.current)
      }
      frameRef.current = null
      pendingSizeRef.current = null
    }
  }, [canvasEngine, fitPadding, maxZoom, minZoom, nodes, surfaceRef, viewportController])
}
