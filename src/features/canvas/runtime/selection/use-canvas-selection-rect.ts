import { useEffect, useRef } from 'react'
import type { RefObject } from 'react'
import { useReactFlow, useStoreApi } from '@xyflow/react'
import { getMeasuredCanvasNodesFromLookup } from '../document/canvas-measured-nodes'
import { createCanvasSelectionGestureController } from './canvas-selection-gesture-controller'
import { isPrimarySelectionModifier } from '../../utils/canvas-selection-utils'
import { useCanvasModifierKeys } from '../interaction/use-canvas-modifier-keys'
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
    | 'beginGesture'
    | 'commitGestureSelection'
    | 'endGesture'
    | 'getSelectedNodeIds'
    | 'getSelectedEdgeIds'
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
  const { shiftPressed } = useCanvasModifierKeys()
  const awarenessRef = useRef(awareness)
  awarenessRef.current = awareness
  const selectionRef = useRef(selection)
  selectionRef.current = selection
  const shiftPressedRef = useRef(shiftPressed)
  shiftPressedRef.current = shiftPressed
  const gestureControllerRef = useRef<ReturnType<
    typeof createCanvasSelectionGestureController
  > | null>(null)

  useEffect(() => {
    gestureControllerRef.current?.refresh({ square: shiftPressed })
  }, [shiftPressed])

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
    gestureControllerRef.current = gestureController

    function handlePointerMove(event: PointerEvent) {
      gestureController.update(
        { x: event.clientX, y: event.clientY },
        { square: shiftPressedRef.current },
      )
    }

    function handlePointerUp() {
      window.removeEventListener('pointermove', handlePointerMove)
      window.removeEventListener('pointerup', handlePointerUp)
      window.removeEventListener('pointercancel', handlePointerCancel)
      if (gestureController.isTracking()) {
        gestureController.commit({ square: shiftPressedRef.current })
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

      gestureController.begin(
        {
          x: event.clientX,
          y: event.clientY,
        },
        isPrimarySelectionModifier(event) ? 'add' : 'replace',
      )
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
      if (gestureControllerRef.current === gestureController) {
        gestureControllerRef.current = null
      }
      gestureController.dispose()
    }
  }, [enabled, interaction, reactFlow, storeApi, surfaceRef])
}
