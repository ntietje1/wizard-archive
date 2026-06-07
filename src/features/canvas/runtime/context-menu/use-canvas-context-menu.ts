import { useCanvasContextMenuCore } from './use-canvas-context-menu-core'
import { useCanvasContextMenuAdapters } from './canvas-context-menu-adapters-context'
import type { CanvasSelectionController } from '../../tools/canvas-tool-types'
import type { CanvasEngine } from '../../system/canvas-engine-types'
import type { CanvasContextMenuCommands, CanvasContextMenuPoint } from './canvas-context-menu-types'
import type { Id } from 'convex/_generated/dataModel'
import type { CanvasDocumentNode } from '~/features/canvas/domain/canvas-document'

interface UseCanvasContextMenuOptions {
  activeTool: string
  canEdit: boolean
  campaignId: Id<'campaigns'>
  canvasParentId: Id<'sidebarItems'> | null
  canvasEngine: CanvasEngine
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
  campaignId,
  canvasParentId,
  canvasEngine,
  createNode,
  setPendingEditNodeId,
  setPendingEditNodePoint,
  screenToCanvasPosition,
  selection,
  commands,
}: UseCanvasContextMenuOptions) {
  const adapters = useCanvasContextMenuAdapters()
  const createItems =
    adapters?.createItems?.({
      campaignId,
      canEdit,
      canvasParentId,
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
    getTargetContributors: adapters?.getTargetContributors,
    setPendingEditNodeId,
    setPendingEditNodePoint,
    screenToCanvasPosition,
    selection,
    commands,
  })
}
