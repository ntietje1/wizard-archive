import { createEmbedNodeContextMenuContributor } from '../nodes/embed/embed-node-context-menu'
import { createAndSelectEmbeddedCanvasNode } from '../runtime/document/canvas-document-commands'
import type {
  CanvasContextMenuAdapters,
  CanvasContextMenuCreateItemContext,
  CanvasEmbedNodeTarget,
  CanvasContextMenuItem,
} from '../runtime/context-menu/canvas-context-menu-types'
import { useCreateFileSystemItem } from '~/features/filesystem/useCreateFileSystemItem'
import { useEditorNavigation } from '~/features/sidebar/hooks/useEditorNavigation'
import { useActiveSidebarItems } from '~/features/sidebar/hooks/useSidebarItems'
import { useSidebarValidation } from '~/features/sidebar/hooks/useSidebarValidation'
import { SIDEBAR_ITEM_CREATION_COMMANDS } from '~/features/sidebar/sidebar-item-creation-catalog'
import type { SidebarItemCreationCommand } from '~/features/sidebar/sidebar-item-creation-catalog'
import { logger } from '~/shared/utils/logger'
import { toast } from 'sonner'

type ActiveSidebarItemsMap = ReturnType<typeof useActiveSidebarItems>['itemsMap']

function buildEmbeddedSidebarItemCreateItem({
  command,
  context,
  createItem,
  getDefaultName,
}: {
  command: SidebarItemCreationCommand
  context: CanvasContextMenuCreateItemContext
  createItem: ReturnType<typeof useCreateFileSystemItem>['createItem']
  getDefaultName: ReturnType<typeof useSidebarValidation>['getDefaultName']
}): CanvasContextMenuItem {
  return {
    id: `canvas-pane-create-${command.key}`,
    label: command.label,
    icon: command.icon,
    group: 'create',
    priority: command.priority,
    onSelect: async (menuContext) => {
      if (!context.canEdit) {
        return
      }

      const pointerPosition = menuContext.pointerPosition
      try {
        const result = await createItem({
          type: command.type,
          parentTarget: { kind: 'direct', parentId: context.canvasParentId },
          name: getDefaultName(command.type, context.canvasParentId),
        })

        createAndSelectEmbeddedCanvasNode({
          sidebarItemId: result.id,
          pointerPosition,
          screenToCanvasPosition: context.screenToCanvasPosition,
          createNode: context.createNode,
          setSelection: context.setSelection,
        })
      } catch (error) {
        logger.error('Failed to create embedded sidebar item from canvas context menu', {
          campaignId: context.campaignId,
          canvasParentId: context.canvasParentId,
          pointerPosition,
          type: command.type,
          error,
        })
        toast.error('Could not create item. Please try again.')
      }
    },
  }
}

export function useCanvasContextMenuAppAdapters(): CanvasContextMenuAdapters {
  const { createItem } = useCreateFileSystemItem()
  const { getDefaultName } = useSidebarValidation()
  const { navigateToItem } = useEditorNavigation()
  const { itemsMap } = useActiveSidebarItems()

  return {
    createItems: (context) =>
      SIDEBAR_ITEM_CREATION_COMMANDS.map((command) =>
        buildEmbeddedSidebarItemCreateItem({
          command,
          context,
          createItem,
          getDefaultName,
        }),
      ),
    getTargetContributors: (target) =>
      target.kind === 'embed-node'
        ? [
            createEmbedNodeContextMenuContributor({
              canOpenEmbedTarget: (embedTarget) =>
                embedTarget.target.kind === 'externalUrl' ||
                getSidebarItemForEmbedTarget(embedTarget, itemsMap) !== null,
              openEmbedTarget: async (embedTarget) => {
                if (embedTarget.target.kind === 'externalUrl') {
                  window.open(embedTarget.target.url, '_blank', 'noopener,noreferrer')
                  return true
                }

                if (embedTarget.target.kind !== 'sidebarItem') {
                  return false
                }

                const item = getSidebarItemForEmbedTarget(embedTarget, itemsMap)
                if (!item) {
                  return false
                }

                await navigateToItem(item.slug)
                return true
              },
            }),
          ]
        : [],
  }
}

function getSidebarItemForEmbedTarget(
  embedTarget: CanvasEmbedNodeTarget,
  itemsMap: ActiveSidebarItemsMap,
) {
  if (embedTarget.target.kind !== 'sidebarItem') return null
  for (const item of itemsMap.values()) {
    if (item._id === embedTarget.target.sidebarItemId) return item
  }
  return null
}
