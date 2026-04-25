import { useIsInteractiveCanvasRenderMode } from '../../runtime/providers/use-canvas-render-mode'
import { useCanvasEngineSelector } from '../../react/use-canvas-engine'
import {
  areCanvasVisualSelectionStatesEqual,
  getCanvasVisualSelectionState,
} from '../../system/canvas-selection'

const INACTIVE_NODE_VISUAL_SELECTION = getCanvasVisualSelectionState({
  selected: false,
  pendingPreview: { kind: 'inactive' },
  id: '',
  kind: 'node',
})

export function useCanvasNodeVisualSelection(id: string) {
  const interactiveRenderMode = useIsInteractiveCanvasRenderMode()
  return useCanvasEngineSelector(
    (state) =>
      interactiveRenderMode
        ? getCanvasVisualSelectionState({
            selected: state.selection.nodeIds.has(id),
            pendingPreview: state.selection.pendingPreview,
            id,
            kind: 'node',
          })
        : INACTIVE_NODE_VISUAL_SELECTION,
    areCanvasVisualSelectionStatesEqual,
  )
}
