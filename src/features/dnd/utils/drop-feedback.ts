import type { AnySidebarItem } from 'convex/sidebarItems/types/types'
import type { DropOutcome } from './drop-outcome'
import type { DropPlanningContext } from './drop-planning-context'
import { resolveSurfaceDropCommand } from './surface-drop-planner'
import {
  EMPTY_EDITOR_DROP_TYPE,
  SIDEBAR_ROOT_DROP_TYPE,
  TRASH_DROP_ZONE_TYPE,
} from './drop-target-data'
import type { ResolvedSidebarItemDropData, SidebarDropData } from './drop-target-data'
import { SIDEBAR_ITEM_TYPES } from 'convex/sidebarItems/types/baseTypes'
import type {
  FileSystemGlobalDropOptions,
  FileSystemGlobalDropTarget,
} from '~/features/filesystem/filesystem-drop-planner'
import { resolveGlobalFileSystemDropCommand } from '~/features/filesystem/filesystem-drop-planner'
import { assertNever } from '~/shared/utils/utils'

type DropFeedback = {
  outcome: DropOutcome | null
  rejectedItemCount?: number
}

export function toGlobalFileSystemDropTarget(
  dropTarget: SidebarDropData,
  ctx: DropPlanningContext,
): FileSystemGlobalDropTarget | null {
  switch (dropTarget.type) {
    case TRASH_DROP_ZONE_TYPE:
      return { type: 'trash' }
    case EMPTY_EDITOR_DROP_TYPE:
      return { type: 'open' }
    case SIDEBAR_ROOT_DROP_TYPE:
      return { type: 'root', label: ctx.campaignName || 'Root' }
    case SIDEBAR_ITEM_TYPES.folders:
      return {
        type: 'folder',
        folder: dropTarget as ResolvedSidebarItemDropData,
        ancestorIds: (dropTarget as ResolvedSidebarItemDropData).ancestorIds,
      }
    default:
      return null
  }
}

export function resolveDropFeedback(
  draggedItems: Array<AnySidebarItem> | null | undefined,
  dropTarget: SidebarDropData | null,
  ctx: DropPlanningContext,
  options: FileSystemGlobalDropOptions = {},
): DropFeedback {
  if (!dropTarget) return { outcome: null }
  if (!draggedItems || draggedItems.length === 0) return { outcome: null }

  const globalTarget = toGlobalFileSystemDropTarget(dropTarget, ctx)
  if (globalTarget) {
    const globalCommand = resolveGlobalFileSystemDropCommand(
      draggedItems,
      globalTarget,
      ctx,
      options,
    )
    switch (globalCommand.status) {
      case 'ready':
        return {
          outcome: {
            type: 'operation',
            action: globalCommand.action,
            label: globalCommand.label,
            execute: null,
          },
        }
      case 'blocked':
        return { outcome: { type: 'rejection', reason: globalCommand.reason } }
      case 'noop':
        break
      default:
        return assertNever(globalCommand)
    }
  }

  const surfaceCommand = resolveSurfaceDropCommand(draggedItems, dropTarget, ctx)
  switch (surfaceCommand.status) {
    case 'ready':
      return {
        outcome: {
          type: 'operation',
          action: surfaceCommand.action,
          label: surfaceCommand.label,
          execute: null,
        },
      }
    case 'partial':
    case 'failed':
      return {
        outcome: {
          type: 'operation',
          action: surfaceCommand.action,
          label: surfaceCommand.label,
          execute: null,
        },
        rejectedItemCount: surfaceCommand.rejectedItems.length,
      }
    case 'blocked':
      return { outcome: { type: 'rejection', reason: surfaceCommand.reason } }
    case 'noop':
      return { outcome: null }
    default:
      return assertNever(surfaceCommand)
  }
}
