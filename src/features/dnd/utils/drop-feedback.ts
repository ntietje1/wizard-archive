import type { AnySidebarItem } from 'convex/sidebarItems/types/types'
import type { DropOutcome } from './drop-outcome'
import type { DropPlanningContext } from './drop-planning-context'
import { resolveSurfaceDropCommand } from './surface-drop-planner'
import { EMPTY_EDITOR_DROP_TYPE } from './drop-target-data'
import type { SidebarDropData } from './drop-target-data'
import type { FileSystemDropOptions } from 'shared/sidebar-items/filesystem/intent-planning'
import {
  resolveFileSystemDropTarget,
  resolveGlobalFileSystemDropCommand,
} from '~/features/filesystem/filesystem-drop-planner'
import { assertNever } from '~/shared/utils/utils'

type DropFeedback = {
  outcome: DropOutcome | null
  rejectedItemCount?: number
}

export function resolveDropFeedback(
  draggedItems: Array<AnySidebarItem> | null | undefined,
  dropTarget: SidebarDropData | null,
  ctx: DropPlanningContext,
  options: FileSystemDropOptions = {},
): DropFeedback {
  if (!dropTarget) return { outcome: null }
  if (!draggedItems || draggedItems.length === 0) return { outcome: null }
  if (dropTarget.type === EMPTY_EDITOR_DROP_TYPE) {
    return {
      outcome: {
        type: 'operation',
        action: 'open',
        label: 'Open in editor',
      },
    }
  }

  const fileSystemTarget = resolveFileSystemDropTarget(dropTarget, ctx)
  if (fileSystemTarget) {
    const globalCommand = resolveGlobalFileSystemDropCommand(
      draggedItems,
      fileSystemTarget,
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
        },
      }
    case 'partial':
      return {
        outcome: {
          type: 'operation',
          action: surfaceCommand.action,
          label: surfaceCommand.label,
        },
        rejectedItemCount: surfaceCommand.rejectedItems.length,
      }
    case 'failed':
      return {
        outcome: {
          type: 'rejection',
          reason: surfaceCommand.rejectedItems[0]?.reason ?? 'unexpected_action',
        },
      }
    case 'blocked':
      return { outcome: { type: 'rejection', reason: surfaceCommand.reason } }
    case 'noop':
      return { outcome: null }
    default:
      return assertNever(surfaceCommand)
  }
}
