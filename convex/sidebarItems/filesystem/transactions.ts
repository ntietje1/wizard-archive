import { ERROR_CODE, throwClientError } from '../../errors'
import {
  assertUndoablePatch,
  receiptPatchesFromChangeSet,
  redoPatchesFromChangeSet,
  undoPatchesFromChangeSet,
} from './deltas'
import { hasMismatchedPrecondition } from './patches'
import { summarizeFileSystemReceipt } from './receipts'
import { SIDEBAR_ITEM_STATUS, SIDEBAR_ITEM_TYPES } from '../types/baseTypes'
import { getSidebarItemStatus } from '../types/status'
import { collectDescendants } from '../functions/collectDescendants'
import { resyncNoteLinksForNotes } from '../../links/functions/resyncNoteLinksForNotes'
import { hardDeleteTree } from './treeWrites'
import type { Id } from '../../_generated/dataModel'
import type { CampaignMutationCtx } from '../../functions'
import type {
  FileSystemDelta,
  FileSystemPatch,
  FileSystemTransactionDirection,
  FileSystemTransactionReceipt,
} from './receipts'
import type { FileSystemCommand, FileSystemOperationDecision } from './commands'
import type { AnySidebarItemRow } from '../types/types'

const MAX_FILESYSTEM_UNDO_HISTORY = 50
const MAX_FILESYSTEM_NON_UNDOABLE_HISTORY = 50
const MAX_FILESYSTEM_TRANSACTION_EVENTS = 1_000
const MAX_FILESYSTEM_TRANSACTION_PATCHES = 4_000

type FingerprintValue =
  | null
  | boolean
  | number
  | string
  | Array<FingerprintValue>
  | { [key: string]: FingerprintValue | undefined }

function normalizeFingerprintValue(value: FingerprintValue): FingerprintValue {
  if (Array.isArray(value)) return value.map(normalizeFingerprintValue)
  if (!value || typeof value !== 'object') return value

  const normalized: { [key: string]: FingerprintValue } = {}
  for (const key of Object.keys(value).sort()) {
    const child = value[key]
    if (child !== undefined) {
      normalized[key] = normalizeFingerprintValue(child)
    }
  }
  return normalized
}

function stableSerialize(value: FingerprintValue) {
  return JSON.stringify(normalizeFingerprintValue(value))
}

export function fileSystemRequestFingerprint({
  command,
  decisions,
}: {
  command: FileSystemCommand
  decisions?: Array<FileSystemOperationDecision>
}) {
  return stableSerialize({ command, decisions: decisions ?? [] })
}

async function getExistingClientTransaction(
  ctx: CampaignMutationCtx,
  clientOperationId: string | undefined,
) {
  if (!clientOperationId) return null
  return await ctx.db
    .query('filesystemTransactions')
    .withIndex('by_campaign_actor_clientOperationId', (q) =>
      q
        .eq('campaignId', ctx.campaign._id)
        .eq('actorMemberId', ctx.membership._id)
        .eq('clientOperationId', clientOperationId),
    )
    .first()
}

function assertTransactionPayloadSize(delta: FileSystemDelta) {
  if (delta.events.length > MAX_FILESYSTEM_TRANSACTION_EVENTS) {
    throwClientError(
      ERROR_CODE.VALIDATION_FAILED,
      'Filesystem operation affects too many items to record in one transaction',
    )
  }

  const patchCounts = [
    receiptPatchesFromChangeSet(delta.changes).length,
    redoPatchesFromChangeSet(delta.changes).length,
    undoPatchesFromChangeSet(delta.changes).length,
  ]
  if (Math.max(...patchCounts) > MAX_FILESYSTEM_TRANSACTION_PATCHES) {
    throwClientError(
      ERROR_CODE.VALIDATION_FAILED,
      'Filesystem operation changes too many items to record in one transaction',
    )
  }
}

function receiptPatchesForDirection(
  changes: FileSystemDelta['changes'],
  direction: FileSystemTransactionDirection,
  undoable: boolean,
) {
  if (direction === 'undo') return undoable ? undoPatchesFromChangeSet(changes) : []
  return receiptPatchesFromChangeSet(changes)
}

export async function loadTransactionReceipt(
  ctx: CampaignMutationCtx,
  transactionId: Id<'filesystemTransactions'>,
  direction: FileSystemTransactionDirection,
): Promise<FileSystemTransactionReceipt> {
  const transaction = await ctx.db.get(transactionId)
  if (!transaction) throwClientError(ERROR_CODE.NOT_FOUND, 'Filesystem transaction not found')
  const command = transaction.command as FileSystemCommand
  const changes = transaction.changes as FileSystemDelta['changes']
  return {
    transactionId,
    direction,
    command,
    events: transaction.events,
    patches: receiptPatchesForDirection(changes, direction, transaction.undoable),
    summary: summarizeFileSystemReceipt(command, transaction.events),
    undoable: transaction.undoable,
  }
}

export async function loadIdempotentFilesystemReceipt(
  ctx: CampaignMutationCtx,
  clientOperationId: string | undefined,
  requestFingerprint: string,
): Promise<FileSystemTransactionReceipt | null> {
  const transaction = await getExistingClientTransaction(ctx, clientOperationId)
  if (!transaction) return null
  if (transaction.requestFingerprint !== requestFingerprint) {
    throwClientError(
      ERROR_CODE.VALIDATION_FAILED,
      'Client operation id was already used for a different filesystem command',
    )
  }
  return await loadTransactionReceipt(ctx, transaction._id, 'forward')
}

export async function recordFilesystemTransaction(
  ctx: CampaignMutationCtx,
  {
    delta,
    clientOperationId,
    requestFingerprint,
  }: {
    delta: FileSystemDelta
    clientOperationId?: string
    requestFingerprint: string
  },
): Promise<FileSystemTransactionReceipt> {
  assertTransactionPayloadSize(delta)
  const receiptPatches = receiptPatchesFromChangeSet(delta.changes)
  const transactionId = await ctx.db.insert('filesystemTransactions', {
    campaignId: ctx.campaign._id,
    actorMemberId: ctx.membership._id,
    clientOperationId: clientOperationId ?? null,
    requestFingerprint,
    command: delta.command,
    events: delta.events,
    changes: delta.changes,
    undoable: delta.undoable,
  })

  await pruneOldFilesystemTransactions(ctx)

  return {
    transactionId,
    events: delta.events,
    direction: 'forward',
    command: delta.command,
    patches: receiptPatches,
    summary: summarizeFileSystemReceipt(delta.command, delta.events),
    undoable: delta.undoable,
  }
}

async function applyPatch(ctx: CampaignMutationCtx, patch: FileSystemPatch) {
  assertUndoablePatch(patch)
  const item = await ctx.db.get(patch.itemId)
  if (!item || item.campaignId !== ctx.campaign._id) {
    throwClientError(ERROR_CODE.NOT_FOUND, 'Filesystem item no longer exists')
  }
  if (hasMismatchedPrecondition(item, patch.before)) {
    throwClientError(
      ERROR_CODE.VALIDATION_FAILED,
      'Filesystem transaction can no longer be applied cleanly',
    )
  }
  await ctx.db.patch('sidebarItems', patch.itemId, patch.fields)
}

async function applyPatches(ctx: CampaignMutationCtx, patches: Array<FileSystemPatch>) {
  for (const patch of patches) {
    await applyPatch(ctx, patch)
  }
  await resyncRelativeLinksForTransactionPatches(ctx, patches)
}

function patchChangesPathOrVisibility(
  patch: FileSystemPatch,
): patch is Extract<FileSystemPatch, { type: 'updateSidebarItem' }> {
  return (
    patch.type === 'updateSidebarItem' &&
    (patch.fields.parentId !== undefined ||
      patch.fields.status !== undefined ||
      patch.fields.location !== undefined)
  )
}

async function resyncRelativeLinksForTransactionPatches(
  ctx: CampaignMutationCtx,
  patches: Array<FileSystemPatch>,
) {
  const noteIds = new Set<Id<'sidebarItems'>>()

  for (const patch of patches) {
    for (const noteId of await noteIdsAffectedByPathPatch(ctx, patch)) noteIds.add(noteId)
  }

  if (noteIds.size > 0) {
    await resyncNoteLinksForNotes(ctx, { noteIds: Array.from(noteIds) })
  }
}

async function noteIdsAffectedByPathPatch(
  ctx: CampaignMutationCtx,
  patch: FileSystemPatch,
): Promise<Array<Id<'sidebarItems'>>> {
  if (!patchChangesPathOrVisibility(patch)) return []
  const item = await ctx.db.get(patch.itemId)
  if (!item || item.campaignId !== ctx.campaign._id) return []
  if (item.type === SIDEBAR_ITEM_TYPES.notes) return [item._id]
  if (item.type !== SIDEBAR_ITEM_TYPES.folders || item.status === SIDEBAR_ITEM_STATUS.undoHidden) {
    return []
  }
  const descendants = await collectDescendants(ctx, {
    campaignId: item.campaignId,
    status: getSidebarItemStatus(item),
    folderId: item._id,
  })
  return descendants
    .filter((descendant) => descendant.type === SIDEBAR_ITEM_TYPES.notes)
    .map((descendant) => descendant._id)
}

async function pruneOldFilesystemTransactions(ctx: CampaignMutationCtx) {
  const transactions = await ctx.db
    .query('filesystemTransactions')
    .withIndex('by_campaign_actor_undoable', (q) =>
      q
        .eq('campaignId', ctx.campaign._id)
        .eq('actorMemberId', ctx.membership._id)
        .eq('undoable', true),
    )
    .order('desc')
    .take(MAX_FILESYSTEM_UNDO_HISTORY + 1)

  for (const transaction of transactions.slice(MAX_FILESYSTEM_UNDO_HISTORY)) {
    await hardDeleteUndoHiddenCreatedRows(
      ctx,
      undoPatchesFromChangeSet(transaction.changes as FileSystemDelta['changes']),
    )
    await ctx.db.delete(transaction._id)
  }

  await pruneOldNonUndoableFilesystemTransactions(ctx)
}

async function pruneOldNonUndoableFilesystemTransactions(ctx: CampaignMutationCtx) {
  const transactions = await ctx.db
    .query('filesystemTransactions')
    .withIndex('by_campaign_actor_undoable', (q) =>
      q
        .eq('campaignId', ctx.campaign._id)
        .eq('actorMemberId', ctx.membership._id)
        .eq('undoable', false),
    )
    .order('desc')
    .take(MAX_FILESYSTEM_NON_UNDOABLE_HISTORY + 1)

  for (const transaction of transactions.slice(MAX_FILESYSTEM_NON_UNDOABLE_HISTORY)) {
    await ctx.db.delete(transaction._id)
  }
}

async function hardDeleteUndoHiddenCreatedRows(
  ctx: CampaignMutationCtx,
  inversePatches: Array<FileSystemPatch>,
) {
  const hiddenItemIds = new Set<Id<'sidebarItems'>>()
  for (const patch of inversePatches) {
    if (
      patch.type === 'updateSidebarItem' &&
      patch.fields.status === SIDEBAR_ITEM_STATUS.undoHidden
    ) {
      hiddenItemIds.add(patch.itemId)
    }
  }
  if (hiddenItemIds.size === 0) return

  const hiddenItems: Array<AnySidebarItemRow> = []
  for (const itemId of hiddenItemIds) {
    const item = await ctx.db.get(itemId)
    if (item?.campaignId === ctx.campaign._id && item.status === SIDEBAR_ITEM_STATUS.undoHidden) {
      hiddenItems.push(item)
    }
  }

  const roots = hiddenItems.filter((item) => !item.parentId || !hiddenItemIds.has(item.parentId))
  for (const item of roots) {
    await hardDeleteTree(ctx, item)
  }
}

export async function applyFilesystemTransactionDirection(
  ctx: CampaignMutationCtx,
  {
    transactionId,
    direction,
  }: {
    transactionId: Id<'filesystemTransactions'>
    direction: 'undo' | 'redo'
  },
): Promise<FileSystemTransactionReceipt> {
  const source = await ctx.db.get(transactionId)
  if (!source) throwClientError(ERROR_CODE.NOT_FOUND, 'Filesystem transaction not found')
  if (source.campaignId !== ctx.campaign._id || source.actorMemberId !== ctx.membership._id) {
    throwClientError(ERROR_CODE.PERMISSION_DENIED, 'Filesystem transaction is not available')
  }
  if (!source.undoable) {
    throwClientError(ERROR_CODE.VALIDATION_FAILED, 'Filesystem transaction is not undoable')
  }

  const command = source.command as FileSystemCommand
  const changes = source.changes as FileSystemDelta['changes']
  const databasePatches =
    direction === 'undo' ? undoPatchesFromChangeSet(changes) : redoPatchesFromChangeSet(changes)
  await applyPatches(ctx, databasePatches)

  return {
    transactionId,
    events: source.events,
    direction,
    command,
    patches: receiptPatchesForDirection(changes, direction, source.undoable),
    summary: summarizeFileSystemReceipt(command, source.events),
    undoable: true,
  }
}
