import { useLayoutEffect, useRef } from 'react'
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
  const cleanupRef = useRef<(() => void) | null>(null)
  const attachedRef = useRef<{
    element: HTMLDivElement | null
    router: CanvasPointerRouter
  } | null>(null)

  useLayoutEffect(() => {
    router.setOptions(options)
  })

  // Ref mutations do not trigger effects, so this intentionally runs after every render
  // to attach once surfaceRef.current becomes available or changes.
  useLayoutEffect(() => {
    const element = surfaceRef.current
    const attached = attachedRef.current
    if (attached?.element === element && attached.router === router) {
      return
    }

    cleanupRef.current?.()
    attachedRef.current = { element, router }
    cleanupRef.current = element ? router.attach(element) : null
  })

  useLayoutEffect(
    () => () => {
      cleanupRef.current?.()
      cleanupRef.current = null
      attachedRef.current = null
    },
    [],
  )
}
