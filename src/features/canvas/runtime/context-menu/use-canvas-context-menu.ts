import { createAndSelectEmbeddedCanvasNode } from '../document/canvas-document-commands'
import { useCanvasContextMenuCore } from './use-canvas-context-menu-core'
import { createEmbedNodeContextMenuContributor } from '../../nodes/embed/embed-node-context-menu'
import type { CanvasSelectionController } from '../../tools/canvas-tool-types'
import type { CanvasEngine } from '../../system/canvas-engine-types'
import type {
  CanvasContextMenuCommands,
  CanvasContextMenuItem,
  CanvasContextMenuPoint,
} from './canvas-context-menu-types'
import type { Id } from 'convex/_generated/dataModel'
import { useCreateFileSystemItem } from '~/features/filesystem/useCreateFileSystemItem'
import { useEditorNavigation } from '~/features/sidebar/hooks/useEditorNavigation'
import { useActiveSidebarItems } from '~/features/sidebar/hooks/useSidebarItems'
import { useSidebarValidation } from '~/features/sidebar/hooks/useSidebarValidation'
import { logger } from '~/shared/utils/logger'
import type { CanvasDocumentNode } from '~/features/canvas/domain/canvas-document'
import type { SidebarItemCreationType } from '~/features/sidebar/sidebar-item-creation-catalog'
import { SIDEBAR_ITEM_CREATION_COMMANDS } from '~/features/sidebar/sidebar-item-creation-catalog'

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
  const { createItem } = useCreateFileSystemItem()
  const { getDefaultName } = useSidebarValidation()
  const { navigateToItem } = useEditorNavigation()
  const { itemsMap } = useActiveSidebarItems()
  const createItems = buildSidebarCreateItems({
    campaignId,
    canEdit,
    canvasParentId,
    createItem,
    createNode,
    getDefaultName,
    screenToCanvasPosition,
    setSelection: selection.setSelection,
  })

  return useCanvasContextMenuCore({
    activeTool,
    canEdit,
    canvasEngine,
    createItems,
    createNode,
    getTargetContributors: (target) =>
      target.kind === 'embed-node'
        ? [
            createEmbedNodeContextMenuContributor({
              canOpenEmbedTarget: (embedTarget) => itemsMap.has(embedTarget.sidebarItemId),
              openEmbedTarget: async (embedTarget) => {
                const item = itemsMap.get(embedTarget.sidebarItemId)
                if (!item) {
                  return false
                }

                await navigateToItem(item.slug)
                return true
              },
            }),
          ]
        : [],
    setPendingEditNodeId,
    setPendingEditNodePoint,
    screenToCanvasPosition,
    selection,
    commands,
  })
}

function buildSidebarCreateItems({
  campaignId,
  canEdit,
  canvasParentId,
  createItem,
  createNode,
  getDefaultName,
  screenToCanvasPosition,
  setSelection,
}: {
  campaignId: Id<'campaigns'>
  canEdit: boolean
  canvasParentId: Id<'sidebarItems'> | null
  createItem: ReturnType<typeof useCreateFileSystemItem>['createItem']
  createNode: (node: CanvasDocumentNode) => void
  getDefaultName: ReturnType<typeof useSidebarValidation>['getDefaultName']
  screenToCanvasPosition: (position: CanvasContextMenuPoint) => { x: number; y: number }
  setSelection: CanvasSelectionController['setSelection']
}): Array<CanvasContextMenuItem> {
  const createSidebarItem = (
    id: string,
    label: string,
    icon: CanvasContextMenuItem['icon'],
    priority: number,
    type: SidebarItemCreationType,
  ): CanvasContextMenuItem => ({
    id,
    label,
    icon,
    group: 'create',
    priority,
    onSelect: async (context) => {
      if (!canEdit) {
        return
      }

      const pointerPosition = context.pointerPosition
      try {
        const result = await createItem({
          type,
          parentTarget: { kind: 'direct', parentId: canvasParentId },
          name: getDefaultName(type, canvasParentId),
        })

        createAndSelectEmbeddedCanvasNode({
          sidebarItemId: result.id,
          pointerPosition,
          screenToCanvasPosition,
          createNode,
          setSelection,
        })
      } catch (error) {
        logger.error('Failed to create embedded sidebar item from canvas context menu', {
          campaignId,
          canvasParentId,
          pointerPosition,
          type,
          error,
        })
      }
    },
  })

  return SIDEBAR_ITEM_CREATION_COMMANDS.map((command) =>
    createSidebarItem(
      `canvas-pane-create-${command.key}`,
      command.label,
      command.icon,
      command.priority,
      command.type,
    ),
  )
}
