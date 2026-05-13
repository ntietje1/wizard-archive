import { SIDEBAR_ITEM_TYPES } from 'convex/sidebarItems/types/baseTypes'
import type { AnySidebarItem } from 'convex/sidebarItems/types/types'
import type { FileSystemDropOptions } from 'convex/sidebarItems/filesystem/intentPlanning'
import type { DropPlanningContext } from '~/features/dnd/utils/drop-planning-context'
import { SIDEBAR_ROOT_DROP_TYPE, TRASH_DROP_ZONE_TYPE } from '~/features/dnd/utils/drop-target-data'
import type {
  ResolvedSidebarItemDropData,
  SidebarDropData,
} from '~/features/dnd/utils/drop-target-data'
import { resolveGlobalFileSystemDropCommand } from './filesystem-drop-planner'
import type {
  FileSystemGlobalDropCommand,
  FileSystemGlobalDropTarget,
} from './filesystem-drop-planner'

function resolveGlobalFileSystemDropTarget(
  dropTarget: SidebarDropData,
  ctx: DropPlanningContext,
): FileSystemGlobalDropTarget | null {
  switch (dropTarget.type) {
    case TRASH_DROP_ZONE_TYPE:
      return { type: 'trash' }
    case SIDEBAR_ROOT_DROP_TYPE:
      return { type: 'root', label: ctx.campaignName || 'Root' }
    case SIDEBAR_ITEM_TYPES.folders: {
      const folderTarget = dropTarget as ResolvedSidebarItemDropData
      return {
        type: 'folder',
        folder: folderTarget,
        ancestorIds: folderTarget.ancestorIds,
      }
    }
    default:
      return null
  }
}

export function resolveGlobalFileSystemDrop(
  draggedItems: Array<AnySidebarItem>,
  dropTarget: SidebarDropData,
  ctx: DropPlanningContext,
  options: FileSystemDropOptions = {},
): { target: FileSystemGlobalDropTarget; command: FileSystemGlobalDropCommand } | null {
  const target = resolveGlobalFileSystemDropTarget(dropTarget, ctx)
  if (!target) return null
  return {
    target,
    command: resolveGlobalFileSystemDropCommand(draggedItems, target, ctx, options),
  }
}
