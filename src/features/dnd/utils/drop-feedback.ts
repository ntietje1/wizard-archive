import type { AnySidebarItem } from 'convex/sidebarItems/types/types'
import type { DropOutcome } from './drop-outcome'
import { resolveDropOutcome } from './drop-outcome-planner'
import type { DropPlanningContext } from './drop-planning-context'
import { resolveGlobalDropCommand } from './global-drop-planner'
import type { GlobalDropOptions } from './global-drop-planner'
import { SIDEBAR_ITEM_TYPES } from 'convex/sidebarItems/types/baseTypes'
import { resolveSurfaceDropCommand } from './surface-drop-planner'
import type { SidebarDropData } from './drop-target-data'
import { assertNever } from '~/shared/utils/utils'

export type DropFeedback = {
  outcome: DropOutcome | null
  rejectedItemCount?: number
}

export function resolveDropFeedback(
  draggedItems: Array<AnySidebarItem> | null | undefined,
  dropTarget: SidebarDropData | null,
  ctx: DropPlanningContext,
  options: GlobalDropOptions = {},
): DropFeedback {
  if (!dropTarget) return { outcome: null }
  if (!draggedItems || draggedItems.length === 0) return { outcome: null }

  const globalCommand = resolveGlobalDropCommand(draggedItems, dropTarget, ctx, options)
  switch (globalCommand.status) {
    case 'ready':
      if (globalCommand.action === 'copy') {
        return {
          outcome: {
            type: 'operation',
            action: 'copy',
            label:
              dropTarget.type === SIDEBAR_ITEM_TYPES.folders
                ? `Copy to "${dropTarget.name || 'Unnamed folder'}"`
                : `Copy to "${ctx.campaignName || 'Root'}"`,
            execute: null,
          },
        }
      }
      return {
        outcome: resolveDropOutcome(
          globalCommand.action === 'open' ? globalCommand.item : (globalCommand.items[0] ?? null),
          dropTarget,
          ctx,
        ),
      }
    case 'blocked':
      return { outcome: { type: 'rejection', reason: globalCommand.reason } }
    case 'noop':
      break
    default:
      return assertNever(globalCommand)
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
