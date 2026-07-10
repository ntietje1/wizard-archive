import { useIsInteractiveCanvasRenderMode } from '../../runtime/providers/use-canvas-render-mode'
import { useCanvasEngineSelector } from '../../react/use-canvas-engine'
import {
  areCanvasVisualSelectionStatesEqual,
  getCanvasVisualSelectionState,
} from '../../system/canvas-selection'

const INACTIVE_EDGE_VISUAL_SELECTION = getCanvasVisualSelectionState({
  selected: false,
  pendingPreview: { kind: 'inactive' },
  id: '',
  kind: 'edge',
})

export function useCanvasEdgeVisualSelection(id: string) {
  const interactiveRenderMode = useIsInteractiveCanvasRenderMode()
  return useCanvasEngineSelector(
    (state) =>
      interactiveRenderMode
        ? getCanvasVisualSelectionState({
            selected: state.selection.edgeIds.has(id),
            pendingPreview: state.selection.pendingPreview,
            id,
            kind: 'edge',
          })
        : INACTIVE_EDGE_VISUAL_SELECTION,
    areCanvasVisualSelectionStatesEqual,
  )
}
