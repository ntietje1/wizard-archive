import { useCallback, useRef, useState } from 'react'
import type { CanvasSurfaceSize } from './canvas-render-projection'

const EMPTY_SURFACE_SIZE: CanvasSurfaceSize = { width: 0, height: 0 }

export function useCanvasSurface() {
  const surface = useRef<HTMLElement>(null)
  const observer = useRef<ResizeObserver | null>(null)
  const frame = useRef<number | null>(null)
  const [size, setSize] = useState(EMPTY_SURFACE_SIZE)
  const attach = useCallback((element: HTMLElement | null) => {
    observer.current?.disconnect()
    observer.current = null
    if (frame.current !== null) cancelAnimationFrame(frame.current)
    frame.current = null
    surface.current = element
    if (!element) return

    const publish = (width: number, height: number) =>
      setSize((current) =>
        current.width === width && current.height === height ? current : { width, height },
      )
    const measure = () => {
      const bounds = element.getBoundingClientRect()
      publish(bounds.width, bounds.height)
    }
    measure()
    if (typeof requestAnimationFrame !== 'undefined') {
      frame.current = requestAnimationFrame(() => {
        frame.current = null
        measure()
      })
    }
    if (typeof ResizeObserver !== 'undefined') {
      observer.current = new ResizeObserver(([entry]) => {
        if (entry) publish(entry.contentRect.width, entry.contentRect.height)
        else measure()
      })
      observer.current.observe(element)
    }
  }, [])

  return { attach, size, surface }
}
