import { useEffect } from 'react'
import { CanvasBackground } from './canvas-background'
import { cn } from '~/features/shadcn/lib/utils'
import type { CanvasEngine } from '../system/canvas-engine'
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
  useEffect(() => {
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
      className={cn('canvas-scene touch-none select-none overflow-hidden bg-background', className)}
      data-canvas-pane="true"
      data-testid={testId}
      {...surfaceProps}
    >
      <CanvasBackground backgroundRef={backgroundRef} testId={backgroundTestId} />
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
