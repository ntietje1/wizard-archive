import { SIDEBAR_ITEM_TYPES } from 'convex/sidebarItems/types/baseTypes'
import type { AnySidebarItem } from 'convex/sidebarItems/types/types'
import type { Id } from 'convex/_generated/dataModel'
import type { DropOutcome } from './drop-outcome'
import { resolveDropOutcome } from './drop-outcome-planner'
import type { DropPlanningContext } from './drop-planning-context'
import type { DropRejectionReason } from './drop-rejections'
import {
  EMPTY_EDITOR_DROP_TYPE,
  SIDEBAR_ROOT_DROP_TYPE,
  TRASH_DROP_ZONE_TYPE,
} from './drop-target-data'
import type { SidebarDropData } from './drop-target-data'
import { assertNever } from '~/shared/utils/utils'

/**
 * `none` means the target is not a move/restore destination; `noop` means the
 * target was valid but every evaluated item would stay where it already is.
 */
type DroppableMoveItemsResult =
  | {
      status: 'ready'
      action: 'move' | 'restore'
      items: Array<AnySidebarItem>
      parentId: Id<'sidebarItems'> | null
    }
  | { status: 'blocked'; reason: DropRejectionReason }
  | { status: 'noop' }
  | { status: 'none' }

type MoveDropAction = 'move' | 'restore'

type ResolvedMoveDropItem = {
  item: AnySidebarItem
  outcome: DropOutcome | null
}

type MoveDropOperation = {
  item: AnySidebarItem
  action: MoveDropAction
}

export type GlobalDropCommand =
  | { status: 'noop' }
  | { status: 'blocked'; reason: DropRejectionReason }
  | {
      status: 'ready'
      action: 'move' | 'restore' | 'trash'
      items: Array<AnySidebarItem>
      parentId: Id<'sidebarItems'> | null
    }
  | {
      status: 'ready'
      action: 'open'
      item: AnySidebarItem
    }

function isMoveDropAction(action: string): action is MoveDropAction {
  return action === 'move' || action === 'restore'
}

export function getDroppableMoveItems(
  items: Array<AnySidebarItem>,
  target: SidebarDropData,
  ctx: DropPlanningContext,
): DroppableMoveItemsResult {
  if (target.type !== SIDEBAR_ROOT_DROP_TYPE && target.type !== SIDEBAR_ITEM_TYPES.folders) {
    return { status: 'none' }
  }

  const parentId = target.type === SIDEBAR_ITEM_TYPES.folders ? target._id : null
  const resolvedItems: Array<ResolvedMoveDropItem> = items.map((item) => ({
    item,
    outcome: resolveDropOutcome(item, target, ctx),
  }))

  if (resolvedItems.length === 0) return { status: 'none' }
  const rejected = resolvedItems.find(({ outcome }) => outcome?.type === 'rejection')
  if (rejected?.outcome?.type === 'rejection') {
    return { status: 'blocked', reason: rejected.outcome.reason }
  }

  const operations: Array<MoveDropOperation> = []
  for (const { item, outcome } of resolvedItems) {
    if (!outcome) continue
    if (outcome.type !== 'operation') return { status: 'none' }
    if (!isMoveDropAction(outcome.action)) return { status: 'none' }
    operations.push({ item, action: outcome.action })
  }

  if (operations.length === 0) return { status: 'noop' }

  const action = operations[0].action
  if (operations.some((op) => op.action !== action)) {
    return { status: 'blocked', reason: 'mixed_actions' }
  }

  return {
    status: 'ready',
    action,
    items: operations.map(({ item }) => item),
    parentId,
  }
}

function getOpenCommand(
  items: Array<AnySidebarItem>,
  target: SidebarDropData,
  ctx: DropPlanningContext,
): GlobalDropCommand {
  const outcomes = items.map((item) => resolveDropOutcome(item, target, ctx))
  const rejected = outcomes.find((outcome) => outcome?.type === 'rejection')
  if (rejected?.type === 'rejection') {
    return { status: 'blocked', reason: rejected.reason }
  }

  const index = outcomes.findIndex(
    (outcome) => outcome?.type === 'operation' && outcome.action === 'open',
  )
  return index >= 0 && items[index]
    ? { status: 'ready', action: 'open', item: items[index] }
    : { status: 'noop' }
}

function getTrashCommand(
  items: Array<AnySidebarItem>,
  target: SidebarDropData,
  ctx: DropPlanningContext,
): GlobalDropCommand {
  if (target.type !== TRASH_DROP_ZONE_TYPE) return { status: 'noop' }

  const trashItems: Array<AnySidebarItem> = []
  for (const item of items) {
    const outcome = resolveDropOutcome(item, target, ctx)
    if (!outcome) continue
    if (outcome.type === 'rejection') return { status: 'blocked', reason: outcome.reason }
    if (outcome.action !== 'trash') return { status: 'blocked', reason: 'unexpected_action' }
    trashItems.push(item)
  }

  if (trashItems.length === 0) return { status: 'noop' }
  return { status: 'ready', action: 'trash', items: trashItems, parentId: null }
}

export function resolveGlobalDropCommand(
  items: Array<AnySidebarItem>,
  target: SidebarDropData,
  ctx: DropPlanningContext,
): GlobalDropCommand {
  if (items.length === 0) return { status: 'noop' }

  if (target.type === TRASH_DROP_ZONE_TYPE) {
    return getTrashCommand(items, target, ctx)
  }

  const moveItems = getDroppableMoveItems(items, target, ctx)
  if (moveItems.status === 'ready') {
    return {
      status: 'ready',
      action: moveItems.action,
      items: moveItems.items,
      parentId: moveItems.parentId,
    }
  }
  if (moveItems.status === 'blocked') return { status: 'blocked', reason: moveItems.reason }
  if (moveItems.status === 'noop') return { status: 'noop' }
  if (moveItems.status !== 'none') return assertNever(moveItems)

  if (target.type !== EMPTY_EDITOR_DROP_TYPE) return { status: 'noop' }
  return getOpenCommand(items, target, ctx)
}

export function dropCommandFailureMessage(
  command: Extract<GlobalDropCommand, { status: 'ready' }>,
) {
  switch (command.action) {
    case 'move':
      return 'Failed to move items'
    case 'restore':
      return 'Failed to restore items'
    case 'trash':
      return 'Failed to move items to trash'
    case 'open':
      return 'Failed to open item'
    default:
      return assertNever(command)
  }
}
