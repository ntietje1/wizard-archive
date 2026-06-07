import { createEmbedNodeContextMenuContributor } from '../nodes/embed/embed-node-context-menu'
import { createAndSelectEmbeddedCanvasNode } from '../runtime/document/canvas-document-commands'
import type {
  CanvasContextMenuAdapters,
  CanvasContextMenuCreateItemContext,
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
import type { Id } from 'convex/_generated/dataModel'

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
                (embedTarget.target.kind === 'sidebarItem' &&
                  itemsMap.has(embedTarget.target.sidebarItemId as Id<'sidebarItems'>)),
              openEmbedTarget: async (embedTarget) => {
                if (embedTarget.target.kind === 'externalUrl') {
                  window.open(embedTarget.target.url, '_blank', 'noopener,noreferrer')
                  return true
                }

                if (embedTarget.target.kind !== 'sidebarItem') {
                  return false
                }

                const item = itemsMap.get(embedTarget.target.sidebarItemId as Id<'sidebarItems'>)
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
