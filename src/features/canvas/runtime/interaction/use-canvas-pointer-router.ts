import { useEffect, useRef } from 'react'
import { createCanvasPointerRouter } from './canvas-pointer-router'
import type { CanvasPointerRouter, CanvasPointerRouterOptions } from './canvas-pointer-router'
import type { RefObject } from 'react'

export function useCanvasPointerRouterController(): CanvasPointerRouter {
  const routerRef = useRef<CanvasPointerRouter | null>(null)
  routerRef.current ??= createCanvasPointerRouter()
  return routerRef.current
}

export function useCanvasPointerRouter({
  router,
  surfaceRef,
  options,
}: {
  router: CanvasPointerRouter
  surfaceRef: RefObject<HTMLDivElement | null>
  options: CanvasPointerRouterOptions
}) {
  router.setOptions(options)

  useEffect(() => router.attach(surfaceRef.current), [router, surfaceRef])
}
