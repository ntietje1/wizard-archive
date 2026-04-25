import { useEffect, useRef } from 'react'
import type { RefObject } from 'react'
import { getMeasuredCanvasNodesFromEngineSnapshot } from '../document/canvas-measured-nodes'
import { createCanvasSelectionGestureController } from './canvas-selection-gesture-controller'
import { isPrimarySelectionModifier } from '../../utils/canvas-selection-utils'
import { useCanvasModifierKeys } from '../interaction/use-canvas-modifier-keys'
import { isCanvasEmptyPaneTarget } from '../interaction/canvas-pane-targets'
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
  const modifiers = useCanvasModifierKeys()
  const shiftPressed = readShiftModifier(modifiers)
  const modifiersRef = useRef(modifiers)
  modifiersRef.current = modifiers
  const awarenessRef = useRef(awareness)
  awarenessRef.current = awareness
  const selectionRef = useRef(selection)
  selectionRef.current = selection
  const gestureControllerRef = useRef<ReturnType<
    typeof createCanvasSelectionGestureController
  > | null>(null)

  useEffect(() => {
    gestureControllerRef.current?.refresh({ square: shiftPressed })
  }, [shiftPressed])

  useEffect(() => {
    if (!enabled) return
    const pane = surfaceRef.current?.querySelector<HTMLDivElement>('[data-canvas-pane="true"]')
    if (!pane) return
    const paneElement = pane

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
        { square: event.shiftKey || readShiftModifier(modifiersRef.current) },
      )
    }

    function handlePointerUp() {
      window.removeEventListener('pointermove', handlePointerMove)
      window.removeEventListener('pointerup', handlePointerUp)
      window.removeEventListener('pointercancel', handlePointerCancel)
      if (gestureController.isTracking()) {
        gestureController.commit({ square: readShiftModifier(modifiersRef.current) })
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

    function handleKeyChange(event: KeyboardEvent) {
      if (event.key === 'Shift') {
        gestureController.refresh({ square: event.type === 'keydown' })
      }
    }

    function handlePointerDown(event: PointerEvent) {
      if (event.button !== 0 || !isCanvasEmptyPaneTarget(event.target, paneElement)) return

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
    window.addEventListener('keydown', handleKeyChange)
    window.addEventListener('keyup', handleKeyChange)

    return () => {
      pane.removeEventListener('pointerdown', handlePointerDown)
      window.removeEventListener('keydown', handleKeyChange)
      window.removeEventListener('keyup', handleKeyChange)
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

function readShiftModifier(modifiers: ReturnType<typeof useCanvasModifierKeys>) {
  return modifiers.getShiftPressed?.() ?? modifiers.shiftPressed
}
