import { useCanvasContextMenuCore } from './use-canvas-context-menu-core'
import type { CanvasSelectionController } from '../../tools/canvas-tool-types'
import type { CanvasEngine } from '../../system/canvas-engine-types'
import type {
  CanvasContextMenuCommands,
  CanvasContextMenuPoint,
  CanvasContextMenuSource,
} from './canvas-context-menu-types'
import type { CanvasDocumentNode } from '../../document-contract'

interface UseCanvasContextMenuOptions {
  activeTool: string
  canEdit: boolean
  canvasEngine: CanvasEngine
  source?: CanvasContextMenuSource
  createNode: (node: CanvasDocumentNode) => void
  setPendingEdit: (pendingEdit: { nodeId: string; point: CanvasContextMenuPoint } | null) => void
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
  setPendingEdit,
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
    setPendingEdit,
    screenToCanvasPosition,
    selection,
    commands,
  })
}
