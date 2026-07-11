import { useEffect, useRef } from 'react'
import type { RefObject } from 'react'

export function useLocalScrollTop(viewportRef: RefObject<HTMLElement | null>) {
  const scrollTopRef = useRef(0)
  const viewport = viewportRef.current

  useEffect(() => {
    if (!viewport) return

    scrollTopRef.current = viewport.scrollTop
    const onScroll = () => {
      scrollTopRef.current = viewport.scrollTop
    }

    viewport.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      viewport.removeEventListener('scroll', onScroll)
    }
  }, [viewport])

  return scrollTopRef
}
