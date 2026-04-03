import { useEffect, useRef } from 'react'
import { useReactFlow } from '@xyflow/react'

const MIN_ZOOM = 0.1
const MAX_ZOOM = 4
const ZOOM_SENSITIVITY = 0.005
const PAN_SENSITIVITY = 1

export function useCanvasWheel() {
  const reactFlowInstance = useReactFlow()
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const handler = (e: WheelEvent) => {
      e.preventDefault()
      const { deltaX, deltaY, ctrlKey, shiftKey } = e
      if (ctrlKey) {
        const viewport = reactFlowInstance.getViewport()
        const rect = el.getBoundingClientRect()
        const mouseX = e.clientX - rect.left
        const mouseY = e.clientY - rect.top
        const newZoom = Math.min(
          MAX_ZOOM,
          Math.max(MIN_ZOOM, viewport.zoom * (1 - deltaY * ZOOM_SENSITIVITY)),
        )
        const scale = newZoom / viewport.zoom
        reactFlowInstance.setViewport({
          x: mouseX - (mouseX - viewport.x) * scale,
          y: mouseY - (mouseY - viewport.y) * scale,
          zoom: newZoom,
        })
      } else if (shiftKey) {
        const viewport = reactFlowInstance.getViewport()
        reactFlowInstance.setViewport({
          x: viewport.x - deltaY * PAN_SENSITIVITY,
          y: viewport.y,
          zoom: viewport.zoom,
        })
      } else {
        const viewport = reactFlowInstance.getViewport()
        reactFlowInstance.setViewport({
          x: viewport.x - deltaX * PAN_SENSITIVITY,
          y: viewport.y - deltaY * PAN_SENSITIVITY,
          zoom: viewport.zoom,
        })
      }
    }
    el.addEventListener('wheel', handler, { passive: false })
    return () => el.removeEventListener('wheel', handler)
  }, [reactFlowInstance])

  return ref
}
