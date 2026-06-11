import { createEmbedNodeContextMenuContributor } from '../nodes/embed/embed-node-context-menu'
import { createAndSelectEmbeddedCanvasNode } from '../runtime/document/canvas-document-commands'
import type {
  CanvasEmbedNodeTarget,
  CanvasContextMenuItem,
  CanvasContextMenuCreateItemSourceContext,
  CanvasContextMenuSource,
} from '../runtime/context-menu/canvas-context-menu-types'
import { useCreateFileSystemItem } from '~/features/filesystem/useCreateFileSystemItem'
import { useEditorNavigation } from '~/features/sidebar/hooks/useEditorNavigation'
import { useFilteredSidebarItems } from '~/features/sidebar/hooks/useFilteredSidebarItems'
import { useSidebarValidation } from '~/features/sidebar/hooks/useSidebarValidation'
import { SIDEBAR_ITEM_CREATION_COMMANDS } from '~/features/sidebar/sidebar-item-creation-catalog'
import type { SidebarItemCreationCommand } from '~/features/sidebar/sidebar-item-creation-catalog'
import { logger } from '~/shared/utils/logger'
import { toast } from 'sonner'
import type { Id } from 'convex/_generated/dataModel'

type VisibleSidebarItemsMap = ReturnType<typeof useFilteredSidebarItems>['itemsMap']

type LiveCanvasContextMenuCreateItemContext = CanvasContextMenuCreateItemSourceContext & {
  campaignId: Id<'campaigns'>
  canvasParentId: Id<'sidebarItems'> | null
}

function buildEmbeddedSidebarItemCreateItem({
  command,
  context,
  createItem,
  getDefaultName,
}: {
  command: SidebarItemCreationCommand
  context: LiveCanvasContextMenuCreateItemContext
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

export function useCanvasContextMenuAppAdapters({
  campaignId,
  canvasParentId,
}: {
  campaignId: Id<'campaigns'>
  canvasParentId: Id<'sidebarItems'> | null
}): CanvasContextMenuSource {
  const { createItem } = useCreateFileSystemItem()
  const { getDefaultName } = useSidebarValidation()
  const { navigateToItem } = useEditorNavigation()
  const { itemsMap } = useFilteredSidebarItems()

  return {
    createItems: (context) =>
      SIDEBAR_ITEM_CREATION_COMMANDS.map((command) =>
        buildEmbeddedSidebarItemCreateItem({
          command,
          context: { ...context, campaignId, canvasParentId },
          createItem,
          getDefaultName,
        }),
      ),
    getTargetContributors: (target) => {
      if (target.kind !== 'embed-node') return []
      if (
        target.target.kind === 'sidebarItem' &&
        getSidebarItemForEmbedTarget(target, itemsMap) === null
      ) {
        return []
      }

      return [
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
    },
  }
}

function getSidebarItemForEmbedTarget(
  embedTarget: CanvasEmbedNodeTarget,
  itemsMap: VisibleSidebarItemsMap,
) {
  if (embedTarget.target.kind !== 'sidebarItem') return null
  for (const item of itemsMap.values()) {
    if (item._id === embedTarget.target.sidebarItemId) return item
  }
  return null
}
