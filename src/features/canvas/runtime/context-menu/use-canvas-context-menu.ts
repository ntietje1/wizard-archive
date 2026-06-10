import { useCanvasContextMenuCore } from './use-canvas-context-menu-core'
import type { CanvasSelectionController } from '../../tools/canvas-tool-types'
import type { CanvasEngine } from '../../system/canvas-engine-types'
import type {
  CanvasContextMenuCommands,
  CanvasContextMenuPoint,
  CanvasContextMenuSource,
} from './canvas-context-menu-types'
import type { CanvasDocumentNode } from '~/features/canvas/domain/canvas-document'

interface UseCanvasContextMenuOptions {
  activeTool: string
  canEdit: boolean
  canvasEngine: CanvasEngine
  source?: CanvasContextMenuSource
  createNode: (node: CanvasDocumentNode) => void
  setPendingEditNodeId: (nodeId: string | null) => void
  setPendingEditNodePoint: (point: CanvasContextMenuPoint | null) => void
  screenToCanvasPosition: (position: CanvasContextMenuPoint) => { x: number; y: number }
  selection: Pick<CanvasSelectionController, 'clearSelection' | 'getSnapshot' | 'setSelection'>
  commands: CanvasContextMenuCommands
}

export function useCanvasContextMenu({
  activeTool,
  canEdit,
  canvasEngine,
  source,
  createNode,
  setPendingEditNodeId,
  setPendingEditNodePoint,
  screenToCanvasPosition,
  selection,
  commands,
}: UseCanvasContextMenuOptions) {
  const createItems =
    source?.createItems?.({
      canEdit,
      createNode,
      screenToCanvasPosition,
      setSelection: selection.setSelection,
    }) ?? []

  return useCanvasContextMenuCore({
    activeTool,
    canEdit,
    canvasEngine,
    createItems,
    createNode,
    getTargetContributors: source?.getTargetContributors,
    setPendingEditNodeId,
    setPendingEditNodePoint,
    screenToCanvasPosition,
    selection,
    commands,
  })
}
