import { useEffect, useRef } from 'react'
import type { RefObject } from 'react'
import { useReactFlow, useStoreApi } from '@xyflow/react'
import { getMeasuredCanvasNodesFromLookup } from '../document/canvas-measured-nodes'
import { createCanvasSelectionGestureController } from './canvas-selection-gesture-controller'
import type {
  CanvasAwarenessPresenceWriter,
  CanvasInteractionTools,
  CanvasSelectionController,
} from '../../tools/canvas-tool-types'

interface UseCanvasSelectionRectOptions {
  surfaceRef: RefObject<HTMLDivElement | null>
  awareness: CanvasAwarenessPresenceWriter
  interaction: Pick<CanvasInteractionTools, 'suppressNextSurfaceClick'>
  selection: Pick<
    CanvasSelectionController,
    'beginGesture' | 'commitGestureSelection' | 'endGesture'
  >
  enabled: boolean
}

export function useCanvasSelectionRect({
  surfaceRef,
  awareness,
  interaction,
  selection,
  enabled,
}: UseCanvasSelectionRectOptions) {
  const reactFlow = useReactFlow()
  const storeApi = useStoreApi()
  const awarenessRef = useRef(awareness)
  awarenessRef.current = awareness
  const selectionRef = useRef(selection)
  selectionRef.current = selection

  useEffect(() => {
    if (!enabled) return
    const pane = surfaceRef.current?.querySelector<HTMLDivElement>('.react-flow__pane')
    if (!pane) return

    const gestureController = createCanvasSelectionGestureController({
      reactFlow,
      getMeasuredNodes: () => getMeasuredCanvasNodesFromLookup(storeApi.getState().nodeLookup),
      getAwareness: () => awarenessRef.current,
      interaction,
      getSelection: () => selectionRef.current,
      requestAnimationFrame,
      cancelAnimationFrame,
    })

    function handlePointerMove(event: PointerEvent) {
      gestureController.update({ x: event.clientX, y: event.clientY })
    }

    function handlePointerUp() {
      window.removeEventListener('pointermove', handlePointerMove)
      window.removeEventListener('pointerup', handlePointerUp)
      window.removeEventListener('pointercancel', handlePointerCancel)
      if (gestureController.isTracking()) {
        gestureController.commit()
      }
    }

    function handlePointerCancel() {
      window.removeEventListener('pointermove', handlePointerMove)
      window.removeEventListener('pointerup', handlePointerUp)
      window.removeEventListener('pointercancel', handlePointerCancel)
      if (gestureController.isTracking()) {
        gestureController.cancel()
      }
    }

    function handlePointerDown(event: PointerEvent) {
      if (event.button !== 0 || event.target !== pane) return

      gestureController.begin({
        x: event.clientX,
        y: event.clientY,
      })
      window.addEventListener('pointermove', handlePointerMove)
      window.addEventListener('pointerup', handlePointerUp)
      window.addEventListener('pointercancel', handlePointerCancel)
    }

    pane.addEventListener('pointerdown', handlePointerDown)

    return () => {
      pane.removeEventListener('pointerdown', handlePointerDown)
      window.removeEventListener('pointermove', handlePointerMove)
      window.removeEventListener('pointerup', handlePointerUp)
      window.removeEventListener('pointercancel', handlePointerCancel)
      gestureController.dispose()
    }
  }, [enabled, interaction, reactFlow, storeApi, surfaceRef])
}
