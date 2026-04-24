import { useEffect, useMemo, useRef } from 'react'
import type { RefObject } from 'react'
import type { CanvasInteractionTools } from '../../tools/canvas-tool-types'

export function useCanvasSurfaceClickGuard(
  surfaceRef: RefObject<HTMLDivElement | null>,
): CanvasInteractionTools {
  const suppressNextClickRef = useRef(false)

  useEffect(() => {
    const surfaceElement = surfaceRef.current
    if (!surfaceElement) return

    const onClickCapture = (event: MouseEvent) => {
      if (!suppressNextClickRef.current) return

      suppressNextClickRef.current = false
      event.preventDefault()
      event.stopPropagation()
      event.stopImmediatePropagation?.()
    }

    surfaceElement.addEventListener('click', onClickCapture, true)

    return () => {
      surfaceElement.removeEventListener('click', onClickCapture, true)
    }
  }, [surfaceRef])

  return useMemo(
    () => ({
      suppressNextSurfaceClick: () => {
        suppressNextClickRef.current = true
      },
    }),
    [],
  )
}
