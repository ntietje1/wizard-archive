import { useLayoutEffect, useRef } from 'react'
import { CanvasBackground } from './canvas-background'
import { useCanvasBackgroundViewport } from './canvas-background-viewport'
import { cn } from '@wizard-archive/ui/shadcn/lib/utils'
import type { CanvasEngine } from '../system/canvas-engine-types'
import type { CanvasDomRuntime } from '../system/canvas-dom-runtime'
import type { HTMLAttributes, ReactNode, RefObject } from 'react'

interface CanvasSceneViewportProps {
  engine: CanvasEngine
  domRuntime: CanvasDomRuntime
  surfaceRef: RefObject<HTMLDivElement | null>
  viewportRef: RefObject<HTMLDivElement | null>
  className?: string
  backgroundRef?: RefObject<HTMLDivElement | null>
  backgroundTestId?: string
  testId: string
  children: ReactNode
  surfaceOverlay?: ReactNode
  surfaceProps?: Omit<HTMLAttributes<HTMLDivElement>, 'children' | 'className'>
}

export function CanvasSceneViewport({
  engine,
  domRuntime,
  surfaceRef,
  viewportRef,
  className,
  backgroundRef,
  backgroundTestId,
  testId,
  children,
  surfaceOverlay,
  surfaceProps,
}: CanvasSceneViewportProps) {
  const ownBackgroundRef = useRef<HTMLDivElement | null>(null)
  const setBackgroundRef = (element: HTMLDivElement | null) => {
    ownBackgroundRef.current = element
    if (backgroundRef) {
      backgroundRef.current = element
    }
  }

  useCanvasBackgroundViewport({ backgroundRef: ownBackgroundRef, canvasEngine: engine })

  useLayoutEffect(() => {
    const unregister = domRuntime.registerViewportElement(viewportRef.current)
    const snapshot = engine.getSnapshot()
    domRuntime.scheduleViewportTransform(snapshot.viewport)
    domRuntime.scheduleCameraState(snapshot.cameraState)
    engine.refreshCulling()
    domRuntime.flush()
    return unregister
  }, [domRuntime, engine, viewportRef])

  return (
    <div
      ref={surfaceRef}
      className={cn(
        'canvas-scene relative touch-none select-none overflow-hidden bg-background',
        className,
      )}
      {...surfaceProps}
      data-canvas-pane="true"
      data-testid={testId}
    >
      <CanvasBackground backgroundRef={setBackgroundRef} testId={backgroundTestId} />
      <div
        ref={viewportRef}
        data-canvas-viewport="true"
        className="canvas-scene__viewport absolute left-0 top-0 h-full w-full"
        style={{
          backfaceVisibility: 'hidden',
          transformOrigin: '0 0',
        }}
      >
        {children}
      </div>
      {surfaceOverlay}
    </div>
  )
}
