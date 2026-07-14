import { toast } from 'sonner'
import { createEmbedNodeContextMenuContributor } from '../../nodes/embed/embed-node-context-menu'
import { createAndSelectResourceCanvasNode } from '../document/canvas-document-commands'
import { SIDEBAR_ITEM_CREATION_COMMANDS } from '../../../workspace/sidebar/creation-catalog'
import {
  sidebarItemOpenInNewTabMenuItem,
  sidebarRevealMenuItem,
} from '../../../workspace/sidebar/menu-items'
import type {
  CanvasEmbedNodeTarget,
  CanvasContextMenuContributor,
  CanvasContextMenuItem,
  CanvasContextMenuCreateItemSourceContext,
  CanvasContextMenuSource,
} from './canvas-context-menu-types'
import type { SidebarItemCreationCommand } from '../../../workspace/sidebar/creation-catalog'
import type { CanvasDocumentSession } from '../../session-contract'
import type { SidebarItemId } from '../../../../../../shared/common/ids'
import type { CanvasContextMenuRuntime } from './canvas-context-menu-runtime'

export function createWorkspaceCanvasContextMenuSource({
  runtime,
  session,
  showItemInSidebar,
}: {
  runtime: CanvasContextMenuRuntime
  session: CanvasDocumentSession
  showItemInSidebar: (itemId: SidebarItemId) => void
}): CanvasContextMenuSource | undefined {
  if (session.status !== 'ready') return undefined
  const { filesystem } = runtime

  return {
    createItems: (context) => {
      if (!context.canEdit || !session.canEdit || !filesystem.permissions.canEdit) {
        return []
      }

      return SIDEBAR_ITEM_CREATION_COMMANDS.map((command, index) =>
        buildEmbeddedSidebarItemCreateItem({
          command,
          context,
          filesystem,
          priority: index,
          session,
        }),
      )
    },
    getTargetContributors: (target) => {
      if (target.kind !== 'embed-node') return []
      if (target.target.kind === 'resource' && !getSidebarItemForEmbedTarget(filesystem, target)) {
        return []
      }

      return [
        createEmbedNodeContextMenuContributor({
          canOpenEmbedTarget: (embedTarget) =>
            embedTarget.target.kind === 'externalUrl' ||
            getSidebarItemForEmbedTarget(filesystem, embedTarget) !== null,
          openEmbedTarget: async (embedTarget) => openEmbedTarget(runtime, embedTarget),
        }),
        createSidebarItemEmbedRevealContributor({
          resolveSidebarItemForEmbedTarget: (embedTarget) =>
            getSidebarItemForEmbedTarget(filesystem, embedTarget),
          openItem: runtime.navigation.openItem,
          showItemInSidebar,
        }),
      ]
    },
  }
}

function createSidebarItemEmbedRevealContributor({
  openItem,
  resolveSidebarItemForEmbedTarget,
  showItemInSidebar,
}: {
  openItem: CanvasContextMenuRuntime['navigation']['openItem']
  resolveSidebarItemForEmbedTarget: (target: CanvasEmbedNodeTarget) => { id: SidebarItemId } | null
  showItemInSidebar: (itemId: SidebarItemId) => void
}): CanvasContextMenuContributor {
  return {
    id: 'embed-node-show-in-sidebar',
    surfaces: ['canvas'],
    applies: (context) =>
      context.target.kind === 'embed-node' &&
      resolveSidebarItemForEmbedTarget(context.target) !== null,
    getItems: (context) => {
      if (context.target.kind !== 'embed-node') return []
      const item = resolveSidebarItemForEmbedTarget(context.target)
      if (!item) return []

      return [
        {
          ...sidebarItemOpenInNewTabMenuItem,
          group: 'navigation',
          priority: 1,
          onSelect: async () => {
            await openItem(item.id, { target: 'separate' })
          },
        },
        {
          ...sidebarRevealMenuItem,
          group: 'navigation',
          priority: 2,
          onSelect: () => {
            showItemInSidebar(item.id)
          },
        },
      ]
    },
  }
}

function buildEmbeddedSidebarItemCreateItem({
  command,
  context,
  filesystem,
  priority,
  session,
}: {
  command: SidebarItemCreationCommand
  context: CanvasContextMenuCreateItemSourceContext
  filesystem: CanvasContextMenuRuntime['filesystem']
  priority: number
  session: Extract<CanvasDocumentSession, { status: 'ready' }>
}): CanvasContextMenuItem {
  return {
    id: `canvas-pane-create-${command.key}`,
    label: command.label,
    icon: command.icon,
    group: 'create',
    priority,
    onSelect: async (menuContext) => {
      if (!context.canEdit || !session.canEdit || !filesystem.permissions.canEdit) {
        return
      }

      const pointerPosition = menuContext.pointerPosition
      try {
        const result = await filesystem.operations.createItem({
          type: command.type,
          parentTarget: { kind: 'direct', parentId: session.parentId },
          name: command.defaultName,
        })
        if (result.status !== 'completed') {
          toast.error('Could not create item. Please try again.')
          return
        }

        try {
          createAndSelectResourceCanvasNode({
            resourceId: result.id,
            pointerPosition,
            screenToCanvasPosition: context.screenToCanvasPosition,
            createNode: context.createNode,
            setSelection: context.setSelection,
          })
        } catch {
          toast.error('Item created, but could not add it to the canvas.')
        }
      } catch {
        toast.error('Could not create item. Please try again.')
      }
    },
  }
}

function getSidebarItemForEmbedTarget(
  filesystem: CanvasContextMenuRuntime['filesystem'],
  embedTarget: CanvasEmbedNodeTarget,
) {
  if (embedTarget.target.kind !== 'resource') return null
  return filesystem.catalog.getKnownItemById(embedTarget.target.resourceId as SidebarItemId) ?? null
}

async function openEmbedTarget(
  runtime: CanvasContextMenuRuntime,
  embedTarget: CanvasEmbedNodeTarget,
) {
  if (embedTarget.target.kind === 'externalUrl') {
    await runtime.navigation.openExternalUrl(embedTarget.target.url)
    return true
  }

  const item = getSidebarItemForEmbedTarget(runtime.filesystem, embedTarget)
  if (!item) {
    toast.error('Could not open item. It may have moved or been deleted.')
    return false
  }

  await runtime.navigation.openItem(item.id)
  return true
}
