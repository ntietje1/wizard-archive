import { useEffect, useRef } from 'react'
import { useViewport } from '@xyflow/react'
import type { Id } from 'convex/_generated/dataModel'
import { savePersistedCanvasViewport } from './canvas-viewport-storage'
import type { PersistedCanvasViewport } from './canvas-viewport-storage'

const VIEWPORT_SAVE_DEBOUNCE_MS = 250

export function CanvasViewportPersistence({
  canvasId,
  initialViewport,
}: {
  canvasId: Id<'sidebarItems'>
  initialViewport: PersistedCanvasViewport
}) {
  const viewport = useViewport()
  const lastSavedViewportRef = useRef(initialViewport)
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current)
      }
    }
  }, [])

  useEffect(() => {
    const nextViewport = {
      x: viewport.x,
      y: viewport.y,
      zoom: viewport.zoom,
    } satisfies PersistedCanvasViewport

    if (persistedCanvasViewportsEqual(lastSavedViewportRef.current, nextViewport)) {
      return
    }

    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current)
    }

    saveTimeoutRef.current = setTimeout(() => {
      savePersistedCanvasViewport(canvasId, nextViewport)
      lastSavedViewportRef.current = nextViewport
      saveTimeoutRef.current = null
    }, VIEWPORT_SAVE_DEBOUNCE_MS)

    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current)
        saveTimeoutRef.current = null
      }
    }
  }, [canvasId, viewport.x, viewport.y, viewport.zoom])

  return null
}

function persistedCanvasViewportsEqual(
  left: PersistedCanvasViewport,
  right: PersistedCanvasViewport,
): boolean {
  return left.x === right.x && left.y === right.y && left.zoom === right.zoom
}
