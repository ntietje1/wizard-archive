import type { SidebarItemId } from '../../common/ids'
import type { FileSystemCommand } from './commands'
import type {
  OperationActorSnapshot,
  OperationSidebarItem,
  OperationTargetSnapshot,
  SidebarOperationRejectionCode,
} from './capabilities'
import { evaluateCopy, evaluateMoveToParent, evaluateRestore, evaluateTrash } from './capabilities'
import { isTrashedSidebarItem } from '../types'

type FileSystemIntentCommand = Extract<
  FileSystemCommand,
  { type: 'move' | 'copy' | 'restore' | 'trash' }
>

type FileSystemIntentResult =
  | { status: 'ready'; command: FileSystemIntentCommand }
  | { status: 'noop' }
  | { status: 'blocked'; reason: SidebarOperationRejectionCode | 'mixed_actions' }

type PasteTargetIntent =
  | { kind: 'explicit'; parentId: SidebarItemId | null }
  | { kind: 'selectedCommonParent'; surfaceParentId: SidebarItemId | null }

type FileSystemDropTargetIntent =
  | { type: 'trash' }
  | { type: 'parent'; target: OperationTargetSnapshot }
  | { type: 'open' }

export type FileSystemDropOptions = {
  copy?: boolean
}

export function commonParentId<T extends { parentId: SidebarItemId | null }>(
  items: Array<T>,
): SidebarItemId | null | undefined {
  if (items.length === 0) return undefined
  const parentId = items[0].parentId
  return items.every((item) => item.parentId === parentId) ? parentId : undefined
}

export function resolvePasteParentId<T extends { parentId: SidebarItemId | null }>({
  items,
  target,
}: {
  items: Array<T>
  target: PasteTargetIntent
}): SidebarItemId | null {
  if (target.kind === 'explicit') return target.parentId
  return commonParentId(items) ?? target.surfaceParentId
}

function blocked(reason: SidebarOperationRejectionCode): FileSystemIntentResult {
  return { status: 'blocked', reason }
}

function planTrashDropIntent({
  actor,
  items,
}: {
  actor: OperationActorSnapshot
  items: Array<OperationSidebarItem>
}): FileSystemIntentResult {
  const itemIds: Array<SidebarItemId> = []

  for (const item of items) {
    if (isTrashedSidebarItem(item)) continue
    const capability = evaluateTrash(actor, item)
    if (!capability.ok) return blocked(capability.code)
    itemIds.push(item._id)
  }

  return itemIds.length > 0
    ? { status: 'ready', command: { type: 'trash', itemIds } }
    : { status: 'noop' }
}

function planCopyDropIntent({
  actor,
  items,
  target,
}: {
  actor: OperationActorSnapshot
  items: Array<OperationSidebarItem>
  target: OperationTargetSnapshot
}): FileSystemIntentResult {
  const itemIds: Array<SidebarItemId> = []

  for (const item of items) {
    const capability = evaluateCopy(actor, item, target)
    if (!capability.ok) return blocked(capability.code)
    itemIds.push(item._id)
  }

  return itemIds.length > 0
    ? { status: 'ready', command: { type: 'copy', itemIds, targetParentId: target.parentId } }
    : { status: 'noop' }
}

function getParentDropAction(
  item: OperationSidebarItem,
  target: OperationTargetSnapshot,
): 'move' | 'restore' | null {
  if (item._id === target.parentId) return null
  if (!isTrashedSidebarItem(item) && item.parentId === target.parentId) return null
  return isTrashedSidebarItem(item) ? 'restore' : 'move'
}

function evaluateParentDrop(
  actor: OperationActorSnapshot,
  item: OperationSidebarItem,
  target: OperationTargetSnapshot,
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
): FileSystemIntentResult {
  if (!action || itemIds.length === 0) return { status: 'noop' }
  return { status: 'ready', command: { type: action, itemIds, targetParentId } }
}

function planParentDropIntent({
  actor,
  items,
  target,
}: {
  actor: OperationActorSnapshot
  items: Array<OperationSidebarItem>
  target: OperationTargetSnapshot
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
    itemIds.push(item._id)
  }

  return readyParentCommand(action, itemIds, target.parentId)
}

export function planFileSystemDropIntent({
  actor,
  items,
  target,
  options = {},
}: {
  actor: OperationActorSnapshot
  items: Array<OperationSidebarItem>
  target: FileSystemDropTargetIntent
  options?: FileSystemDropOptions
}): FileSystemIntentResult {
  if (items.length === 0 || target.type === 'open') return { status: 'noop' }
  if (target.type === 'trash') return planTrashDropIntent({ actor, items })
  if (options.copy) return planCopyDropIntent({ actor, items, target: target.target })
  return planParentDropIntent({ actor, items, target: target.target })
}
