import { useEffect, useRef } from 'react'
import type { RefObject } from 'react'
import { getMeasuredCanvasNodesFromEngineSnapshot } from '../document/canvas-measured-nodes'
import { createCanvasSelectionGestureController } from './canvas-selection-gesture-controller'
import { isPrimarySelectionModifier } from '../../utils/canvas-selection-utils'
import { useCanvasModifierKeys } from '../interaction/use-canvas-modifier-keys'
import type { CanvasEngine } from '../../system/canvas-engine'
import type { CanvasViewportController } from '../../system/canvas-viewport-controller'
import type {
  CanvasAwarenessPresenceWriter,
  CanvasInteractionTools,
  CanvasSelectionController,
} from '../../tools/canvas-tool-types'

interface UseCanvasSelectionRectOptions {
  canvasEngine: CanvasEngine
  viewportController: Pick<CanvasViewportController, 'getZoom' | 'screenToCanvasPosition'>
  surfaceRef: RefObject<HTMLDivElement | null>
  awareness: CanvasAwarenessPresenceWriter
  interaction: Pick<CanvasInteractionTools, 'suppressNextSurfaceClick'>
  selection: Pick<
    CanvasSelectionController,
    'beginGesture' | 'cancelGesture' | 'commitGesture' | 'getSnapshot' | 'setGesturePreview'
  >
  enabled: boolean
}

function getCanvasSelectionSnapshot(canvasEngine: CanvasEngine) {
  const snapshot = canvasEngine.getSnapshot()
  return {
    nodes: snapshot.nodes,
    edges: snapshot.edges,
    measuredNodes: getMeasuredCanvasNodesFromEngineSnapshot(snapshot),
  }
}

export function useCanvasSelectionRect({
  canvasEngine,
  viewportController,
  surfaceRef,
  awareness,
  interaction,
  selection,
  enabled,
}: UseCanvasSelectionRectOptions) {
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
    const pane =
      surfaceRef.current?.querySelector<HTMLDivElement>('[data-canvas-pane="true"]') ??
      surfaceRef.current?.querySelector<HTMLDivElement>('.react-flow__pane')
    if (!pane) return

    const gestureController = createCanvasSelectionGestureController({
      viewport: {
        getZoom: viewportController.getZoom,
        screenToCanvasPosition: viewportController.screenToCanvasPosition,
      },
      getCanvasSnapshot: () => getCanvasSelectionSnapshot(canvasEngine),
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
  }, [canvasEngine, enabled, interaction, surfaceRef, viewportController])
}
