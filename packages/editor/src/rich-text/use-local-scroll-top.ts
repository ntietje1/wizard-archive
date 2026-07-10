import { useEffect, useRef } from 'react'
import type { RefObject } from 'react'

export function useLocalScrollTop(viewportRef: RefObject<HTMLElement | null>) {
  const scrollTopRef = useRef(0)

  useEffect(() => {
    const viewport = viewportRef.current
    if (!viewport) return

    const onScroll = () => {
      scrollTopRef.current = viewport.scrollTop
    }

    viewport.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      viewport.removeEventListener('scroll', onScroll)
    }
  }, [viewportRef])

  return scrollTopRef
}
