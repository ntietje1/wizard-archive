import type { SidebarItemId } from '../../../../../shared/common/ids'
import {
  evaluateCopy,
  evaluateMoveToParent,
  evaluateRestore,
  evaluateTrash,
} from './operation-capabilities'
import type { ResourceCommand } from '../transaction-contract'
import type {
  OperationActorSnapshot,
  OperationResourceItem,
  ResourceOperationCapability,
} from './operation-capabilities'
import { isTrashedSidebarItem } from '../../workspace/items/status'

export type FileSystemIntentCommand = Extract<
  ResourceCommand,
  { type: 'move' | 'copy' | 'restore' | 'trash' }
>

export type FileSystemIntentCommandPlan = {
  command: FileSystemIntentCommand
  label: string
}

type FileSystemIntentResult =
  | { status: 'ready'; plan: FileSystemIntentCommandPlan }
  | { status: 'noop' }
  | { status: 'blocked'; reason: FileSystemIntentRejectionReason }

export type FileSystemIntentRejectionReason =
  | Extract<ResourceOperationCapability, { ok: false }>['code']
  | 'mixed_actions'

type FileSystemDropParentTarget = Parameters<typeof evaluateMoveToParent>[2]

export type FileSystemDropTargetIntent =
  | { type: 'trash'; label: string }
  | { type: 'parent'; target: FileSystemDropParentTarget; label: string }

export type FileSystemDropOptions = {
  copy?: boolean
}

function blocked(reason: FileSystemIntentRejectionReason): FileSystemIntentResult {
  return { status: 'blocked', reason }
}

function itemCountLabel(count: number) {
  return count === 1 ? 'item' : `${count} items`
}

function labelForCommand(command: FileSystemIntentCommand, targetLabel: string) {
  const itemLabel = itemCountLabel(command.itemIds.length)
  if (command.type === 'trash') return `Move ${itemLabel} to "${targetLabel}"`
  if (command.type === 'copy') return `Copy ${itemLabel} to "${targetLabel}"`
  if (command.type === 'restore') return `Restore ${itemLabel} to "${targetLabel}"`
  return `Move ${itemLabel} to "${targetLabel}"`
}

function readyPlan(command: FileSystemIntentCommand, targetLabel: string): FileSystemIntentResult {
  return {
    status: 'ready',
    plan: {
      command,
      label: labelForCommand(command, targetLabel),
    },
  }
}

function planTrashDropIntent({
  actor,
  items,
  targetLabel,
}: {
  actor: OperationActorSnapshot
  items: Array<OperationResourceItem>
  targetLabel: string
}): FileSystemIntentResult {
  const itemIds: Array<SidebarItemId> = []

  for (const item of items) {
    if (isTrashedSidebarItem(item)) continue
    const capability = evaluateTrash(actor, item)
    if (!capability.ok) return blocked(capability.code)
    itemIds.push(item.id)
  }

  return itemIds.length > 0
    ? readyPlan({ type: 'trash', itemIds }, targetLabel)
    : { status: 'noop' }
}

function planCopyDropIntent({
  actor,
  items,
  target,
  targetLabel,
}: {
  actor: OperationActorSnapshot
  items: Array<OperationResourceItem>
  target: FileSystemDropParentTarget
  targetLabel: string
}): FileSystemIntentResult {
  const itemIds: Array<SidebarItemId> = []

  for (const item of items) {
    const capability = evaluateCopy(actor, item, target)
    if (!capability.ok) return blocked(capability.code)
    itemIds.push(item.id)
  }

  return itemIds.length > 0
    ? readyPlan({ type: 'copy', itemIds, targetParentId: target.parentId }, targetLabel)
    : { status: 'noop' }
}

function getParentDropAction(
  item: OperationResourceItem,
  target: FileSystemDropParentTarget,
): 'move' | 'restore' | null {
  if (item.id === target.parentId) return null
  if (!isTrashedSidebarItem(item) && item.parentId === target.parentId) return null
  return isTrashedSidebarItem(item) ? 'restore' : 'move'
}

function evaluateParentDrop(
  actor: OperationActorSnapshot,
  item: OperationResourceItem,
  target: FileSystemDropParentTarget,
  action: 'move' | 'restore',
) {
  return action === 'restore'
    ? evaluateRestore(actor, item, target)
    : evaluateMoveToParent(actor, item, target)
}

function readyParentCommand(
  action: 'move' | 'restore' | null,
  itemIds: Array<SidebarItemId>,
  targetParentId: SidebarItemId | null,
  targetLabel: string,
): FileSystemIntentResult {
  if (!action || itemIds.length === 0) return { status: 'noop' }
  return readyPlan({ type: action, itemIds, targetParentId }, targetLabel)
}

function planParentDropIntent({
  actor,
  items,
  target,
  targetLabel,
}: {
  actor: OperationActorSnapshot
  items: Array<OperationResourceItem>
  target: FileSystemDropParentTarget
  targetLabel: string
}): FileSystemIntentResult {
  let action: 'move' | 'restore' | null = null
  const itemIds: Array<SidebarItemId> = []

  for (const item of items) {
    const itemAction = getParentDropAction(item, target)
    if (!itemAction) continue
    if (action && action !== itemAction) return { status: 'blocked', reason: 'mixed_actions' }

    const capability = evaluateParentDrop(actor, item, target, itemAction)
    if (!capability.ok) return blocked(capability.code)

    action = itemAction
    itemIds.push(item.id)
  }

  return readyParentCommand(action, itemIds, target.parentId, targetLabel)
}

export function planFileSystemDropIntent({
  actor,
  items,
  target,
  options = {},
}: {
  actor: OperationActorSnapshot
  items: Array<OperationResourceItem>
  target: FileSystemDropTargetIntent
  options?: FileSystemDropOptions
}): FileSystemIntentResult {
  if (items.length === 0) return { status: 'noop' }
  if (target.type === 'trash')
    return planTrashDropIntent({ actor, items, targetLabel: target.label })
  if (options.copy)
    return planCopyDropIntent({ actor, items, target: target.target, targetLabel: target.label })
  return planParentDropIntent({ actor, items, target: target.target, targetLabel: target.label })
}
