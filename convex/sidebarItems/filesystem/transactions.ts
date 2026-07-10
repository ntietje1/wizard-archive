import { ERROR_CODE } from '../../../shared/errors/client'
import { throwClientError } from '../../errors'
import { CAMPAIGN_MEMBER_ROLE } from '../../../shared/campaigns/types'
import { PERMISSION_OPERATION } from '../../../shared/permissions/requirements'
import {
  assertUndoablePatch,
  receiptPatchesFromChangeSet,
  redoPatchesFromChangeSet,
  storedSidebarItemPatchFields,
  undoPatchesFromChangeSet,
} from './deltas'
import type { StoredResourceDelta } from './deltas'
import { summarizeResourceReceipt } from '@wizard-archive/editor/resources/transaction-contract'
import { hasMismatchedPrecondition } from '@wizard-archive/editor/resources/patch-contract'
import type {
  ResourceTransactionReceipt,
  ResourceCommand,
  ResourceOperationDecision,
} from '@wizard-archive/editor/resources/transaction-contract'
import type { ResourcePatch } from '@wizard-archive/editor/resources/patch-contract'
import {
  RESOURCE_STATUS,
  RESOURCE_TYPES,
} from '@wizard-archive/editor/resources/items-persistence-contract'
import { normalizeResourceNameForComparison } from '@wizard-archive/editor/resources/resource-contract'
import { collectDescendants } from '../functions/collectDescendants'
import { getActiveSidebarItemRowsByParent } from '../functions/getSidebarItemsByParent'
import { resyncNoteLinksForNotes } from '../../links/functions/resyncNoteLinksForNotes'
import { hardDeleteTree } from './treeWrites'
import { getSidebarItemShareRow } from './shareRows'
import { requireSidebarItemRowOperationAccess } from './access'
import type { Doc, Id } from '../../_generated/dataModel'
import type { CampaignMutationCtx } from '../../functions'
import { toSidebarItemDocument, toSidebarItemReplacement } from '../types/status'
const MAX_FILESYSTEM_UNDO_HISTORY = 50
const MAX_FILESYSTEM_NON_UNDOABLE_HISTORY = 50
const MAX_FILESYSTEM_TRANSACTION_EVENTS = 1_000
const MAX_FILESYSTEM_TRANSACTION_PATCHES = 4_000

type FileSystemTransactionDirection = ResourceTransactionReceipt['direction']

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
  command: ResourceCommand
  decisions?: Array<ResourceOperationDecision>
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

function assertTransactionPayloadSize(delta: StoredResourceDelta) {
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
  changes: StoredResourceDelta['changes'],
  direction: FileSystemTransactionDirection,
  undoable: boolean,
) {
  if (direction === 'undo') return undoable ? undoPatchesFromChangeSet(changes) : []
  if (direction === 'redo') return undoable ? redoPatchesFromChangeSet(changes) : []
  return receiptPatchesFromChangeSet(changes)
}

export async function loadTransactionReceipt(
  ctx: CampaignMutationCtx,
  transactionId: Id<'filesystemTransactions'>,
  direction: FileSystemTransactionDirection,
): Promise<ResourceTransactionReceipt> {
  const transaction = await ctx.db.get('filesystemTransactions', transactionId)
  if (!transaction) throwClientError(ERROR_CODE.NOT_FOUND, 'Filesystem transaction not found')
  const command = transaction.command as ResourceCommand
  const changes = transaction.changes as StoredResourceDelta['changes']
  return {
    transactionId,
    direction,
    command,
    events: transaction.events,
    patches: receiptPatchesForDirection(changes, direction, transaction.undoable),
    summary: summarizeResourceReceipt(command, transaction.events),
    undoable: transaction.undoable,
  }
}

export async function loadIdempotentFilesystemReceipt(
  ctx: CampaignMutationCtx,
  clientOperationId: string | undefined,
  requestFingerprint: string,
): Promise<ResourceTransactionReceipt | null> {
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
    delta: StoredResourceDelta
    clientOperationId?: string
    requestFingerprint: string
  },
): Promise<ResourceTransactionReceipt> {
  assertTransactionPayloadSize(delta)
  const receiptPatches = receiptPatchesFromChangeSet(delta.changes)
  const transactionId = await ctx.db.insert('filesystemTransactions', {
    campaignId: ctx.campaign._id,
    actorMemberId: ctx.membership._id,
    clientOperationId: clientOperationId ?? null,
    requestFingerprint,
    command: delta.command,
    events: delta.events,
    changes: delta.changes as Doc<'filesystemTransactions'>['changes'],
    undoable: delta.undoable,
  })

  await pruneOldFilesystemTransactions(ctx)

  return {
    transactionId,
    events: delta.events,
    direction: 'forward',
    command: delta.command,
    patches: receiptPatches,
    summary: summarizeResourceReceipt(delta.command, delta.events),
    undoable: delta.undoable,
  }
}

async function applyPatch(ctx: CampaignMutationCtx, patch: ResourcePatch) {
  assertUndoablePatch(patch)
  switch (patch.type) {
    case 'updateResource':
      await applySidebarItemPatch(ctx, patch)
      return
    case 'updateResourceShare':
      await applySidebarItemSharePatch(ctx, patch)
      return
    case 'removeResourceShare':
      await applySidebarItemShareRemoval(ctx, patch)
      return
    case 'upsertResourceShare':
      await applySidebarItemShareUpsert(ctx, patch)
      return
    case 'updateFolderShare':
      await applyFolderSharePatch(ctx, patch)
      return
    case 'setResourceBookmarkState':
      await applyBookmarkStatePatch(ctx, patch)
      return
    default:
      return unhandledFileSystemPatch(patch)
  }
}

function unhandledFileSystemPatch(patch: never): never {
  throw new Error(`Unhandled filesystem patch type: ${String((patch as ResourcePatch).type)}`)
}

async function applySidebarItemPatch(
  ctx: CampaignMutationCtx,
  patch: Extract<ResourcePatch, { type: 'updateResource' }>,
) {
  const item = await ctx.db.get('sidebarItems', patch.itemId)
  if (!item || item.campaignId !== ctx.campaign._id) {
    throwClientError(ERROR_CODE.NOT_FOUND, 'Filesystem item no longer exists')
  }
  await requireSidebarItemPatchAuthority(ctx, item, patch)
  if (hasMismatchedPrecondition(item, storedSidebarItemPatchFields(patch.before))) {
    throwClientError(
      ERROR_CODE.VALIDATION_FAILED,
      'Filesystem transaction can no longer be applied cleanly',
    )
  }
  const after = toSidebarItemDocument({
    ...item,
    ...storedSidebarItemPatchFields(patch.fields),
  })
  await ctx.db.replace('sidebarItems', patch.itemId, toSidebarItemReplacement(after))
}

function requireDmShareReplay(ctx: CampaignMutationCtx) {
  if (ctx.membership.role !== CAMPAIGN_MEMBER_ROLE.DM) {
    throwClientError(ERROR_CODE.PERMISSION_DENIED, 'Only the DM can perform this action')
  }
}

function sidebarItemPatchOperation(patch: Extract<ResourcePatch, { type: 'updateResource' }>) {
  if (patch.fields.status === RESOURCE_STATUS.trashed) {
    return PERMISSION_OPERATION.TRASH_SIDEBAR_ITEM
  }
  if (patch.fields.status === RESOURCE_STATUS.active) {
    return PERMISSION_OPERATION.RESTORE_SIDEBAR_ITEM
  }
  if (patch.fields.status === RESOURCE_STATUS.undoHidden) {
    return PERMISSION_OPERATION.DELETE_SIDEBAR_ITEM_FOREVER
  }
  if (patch.fields.parentId !== undefined) {
    return PERMISSION_OPERATION.MOVE_SIDEBAR_ITEM
  }
  if (
    patch.fields.name !== undefined ||
    patch.fields.slug !== undefined ||
    patch.fields.iconName !== undefined ||
    patch.fields.color !== undefined
  ) {
    return PERMISSION_OPERATION.RENAME_SIDEBAR_ITEM
  }
  return PERMISSION_OPERATION.MANAGE_SIDEBAR_ITEM
}

async function requireSidebarParentPatchAuthority(
  ctx: CampaignMutationCtx,
  parentId: Id<'sidebarItems'> | null | undefined,
) {
  if (parentId === undefined) return
  if (parentId === null) {
    if (ctx.membership.role !== CAMPAIGN_MEMBER_ROLE.DM) {
      throwClientError(
        ERROR_CODE.PERMISSION_DENIED,
        'Only the DM can create items at the root level',
      )
    }
    return
  }

  const parent = await requireTransactionTargetItem(ctx, parentId)
  await requireSidebarItemRowOperationAccess(ctx, {
    rawItem: parent,
    operation: PERMISSION_OPERATION.MANAGE_SIDEBAR_ITEM,
  })
}

async function requireSidebarItemPatchAuthority(
  ctx: CampaignMutationCtx,
  item: Doc<'sidebarItems'>,
  patch: Extract<ResourcePatch, { type: 'updateResource' }>,
) {
  if (patch.fields.allPermissionLevel !== undefined) {
    requireDmShareReplay(ctx)
    return
  }

  await requireSidebarParentPatchAuthority(ctx, patch.fields.parentId)
  await requireSidebarItemRowOperationAccess(ctx, {
    rawItem: item,
    operation: sidebarItemPatchOperation(patch),
  })
}

async function applySidebarItemSharePatch(
  ctx: CampaignMutationCtx,
  patch: Extract<ResourcePatch, { type: 'updateResourceShare' }>,
) {
  requireDmShareReplay(ctx)
  await requireTransactionItemOperation(ctx, {
    itemId: patch.resourceId,
    operation: PERMISSION_OPERATION.MANAGE_SIDEBAR_ITEM,
  })
  const share = await getSidebarItemShareRow(ctx, {
    sidebarItemId: patch.resourceId,
    campaignMemberId: patch.memberId as Id<'campaignMembers'>,
  })
  if (!share) throwClientError(ERROR_CODE.NOT_FOUND, 'Sidebar item share no longer exists')
  if (hasMismatchedPrecondition(share, patch.before)) {
    throwClientError(
      ERROR_CODE.VALIDATION_FAILED,
      'Filesystem transaction can no longer be applied cleanly',
    )
  }
  await ctx.db.patch('sidebarItemShares', share._id, patch.fields)
}

async function requireTransactionTargetItem(ctx: CampaignMutationCtx, itemId: Id<'sidebarItems'>) {
  const item = await ctx.db.get('sidebarItems', itemId)
  if (!item || item.campaignId !== ctx.campaign._id) {
    throwClientError(ERROR_CODE.NOT_FOUND, 'Filesystem item no longer exists')
  }
  return item
}

async function requireTransactionItemOperation(
  ctx: CampaignMutationCtx,
  {
    itemId,
    operation,
  }: {
    itemId: Id<'sidebarItems'>
    operation: (typeof PERMISSION_OPERATION)[keyof typeof PERMISSION_OPERATION]
  },
) {
  const item = await requireTransactionTargetItem(ctx, itemId)
  await requireSidebarItemRowOperationAccess(ctx, { rawItem: item, operation })
}

async function assertTransactionTargetMember(
  ctx: CampaignMutationCtx,
  memberId: Id<'campaignMembers'>,
) {
  const member = await ctx.db.get('campaignMembers', memberId)
  if (!member || member.campaignId !== ctx.campaign._id) {
    throwClientError(
      ERROR_CODE.VALIDATION_FAILED,
      'Filesystem transaction can no longer be applied cleanly',
    )
  }
}

async function applySidebarItemShareRemoval(
  ctx: CampaignMutationCtx,
  patch: Extract<ResourcePatch, { type: 'removeResourceShare' }>,
) {
  requireDmShareReplay(ctx)
  await requireTransactionItemOperation(ctx, {
    itemId: patch.share.resourceId,
    operation: PERMISSION_OPERATION.MANAGE_SIDEBAR_ITEM,
  })
  const share = await getSidebarItemShareRow(ctx, {
    sidebarItemId: patch.share.resourceId,
    campaignMemberId: patch.share.memberId as Id<'campaignMembers'>,
  })
  if (!share) return
  if (hasMismatchedPrecondition(share, { permissionLevel: patch.share.permissionLevel })) {
    throwClientError(
      ERROR_CODE.VALIDATION_FAILED,
      'Filesystem transaction can no longer be applied cleanly',
    )
  }
  await ctx.db.delete('sidebarItemShares', share._id)
}

async function applySidebarItemShareUpsert(
  ctx: CampaignMutationCtx,
  patch: Extract<ResourcePatch, { type: 'upsertResourceShare' }>,
) {
  requireDmShareReplay(ctx)
  await requireTransactionItemOperation(ctx, {
    itemId: patch.share.resourceId,
    operation: PERMISSION_OPERATION.MANAGE_SIDEBAR_ITEM,
  })
  await assertTransactionTargetMember(ctx, patch.share.memberId as Id<'campaignMembers'>)
  const existing = await getSidebarItemShareRow(ctx, {
    sidebarItemId: patch.share.resourceId,
    campaignMemberId: patch.share.memberId as Id<'campaignMembers'>,
  })
  if (existing) {
    if (existing.permissionLevel !== patch.share.permissionLevel) {
      throwClientError(
        ERROR_CODE.VALIDATION_FAILED,
        'Filesystem transaction can no longer be applied cleanly',
      )
    }
    return
  }
  await ctx.db.insert('sidebarItemShares', {
    campaignId: ctx.campaign._id,
    sidebarItemId: patch.share.resourceId,
    sidebarItemType: patch.share.sidebarItemType,
    campaignMemberId: patch.share.memberId as Id<'campaignMembers'>,
    sessionId: patch.share.sessionId,
    permissionLevel: patch.share.permissionLevel,
  })
}

async function applyFolderSharePatch(
  ctx: CampaignMutationCtx,
  patch: Extract<ResourcePatch, { type: 'updateFolderShare' }>,
) {
  requireDmShareReplay(ctx)
  await requireTransactionItemOperation(ctx, {
    itemId: patch.folderId,
    operation: PERMISSION_OPERATION.MANAGE_SIDEBAR_ITEM,
  })
  const folder = await ctx.db
    .query('folders')
    .withIndex('by_sidebarItemId', (q) => q.eq('sidebarItemId', patch.folderId))
    .unique()
  if (!folder) throwClientError(ERROR_CODE.NOT_FOUND, 'Folder no longer exists')
  if (hasMismatchedPrecondition(folder, patch.before)) {
    throwClientError(
      ERROR_CODE.VALIDATION_FAILED,
      'Filesystem transaction can no longer be applied cleanly',
    )
  }
  await ctx.db.patch('folders', folder._id, patch.fields)
}

async function getBookmarkRow(
  ctx: CampaignMutationCtx,
  {
    campaignMemberId,
    sidebarItemId,
  }: {
    campaignMemberId: Id<'campaignMembers'>
    sidebarItemId: Id<'sidebarItems'>
  },
) {
  return await ctx.db
    .query('bookmarks')
    .withIndex('by_campaign_member_item', (q) =>
      q
        .eq('campaignId', ctx.campaign._id)
        .eq('campaignMemberId', campaignMemberId)
        .eq('sidebarItemId', sidebarItemId),
    )
    .unique()
}

async function applyBookmarkStatePatch(
  ctx: CampaignMutationCtx,
  patch: Extract<ResourcePatch, { type: 'setResourceBookmarkState' }>,
) {
  await requireTransactionItemOperation(ctx, {
    itemId: patch.itemId,
    operation: PERMISSION_OPERATION.READ_SIDEBAR_ITEM,
  })
  const campaignMemberId = ctx.membership._id
  await assertTransactionTargetMember(ctx, campaignMemberId)
  const existing = await getBookmarkRow(ctx, {
    campaignMemberId,
    sidebarItemId: patch.itemId,
  })
  if (!patch.isBookmarked) {
    if (existing) await ctx.db.delete('bookmarks', existing._id)
    return
  }
  if (existing) return
  await ctx.db.insert('bookmarks', {
    campaignId: ctx.campaign._id,
    sidebarItemId: patch.itemId,
    campaignMemberId,
  })
}

function patchRestoresActiveItem(
  patch: ResourcePatch,
): patch is Extract<ResourcePatch, { type: 'updateResource' }> {
  return (
    patch.type === 'updateResource' &&
    patch.before.status === RESOURCE_STATUS.undoHidden &&
    patch.fields.status === RESOURCE_STATUS.active
  )
}

function patchClearsActiveName(
  patch: ResourcePatch,
): patch is Extract<ResourcePatch, { type: 'updateResource' }> {
  return (
    patch.type === 'updateResource' &&
    patch.before.status === RESOURCE_STATUS.active &&
    (patch.fields.status !== undefined || patch.fields.parentId !== undefined)
  )
}

async function collectRedoNameCheckInputs(ctx: CampaignMutationCtx, patches: Array<ResourcePatch>) {
  const restoredItems: Array<Doc<'sidebarItems'>> = []
  const clearedActiveItemIds = new Set<Id<'sidebarItems'>>()
  for (const patch of patches) {
    if (patchClearsActiveName(patch)) {
      clearedActiveItemIds.add(patch.itemId)
    }
    if (!patchRestoresActiveItem(patch)) continue
    const item = await ctx.db.get('sidebarItems', patch.itemId)
    if (!item || item.campaignId !== ctx.campaign._id) {
      throwClientError(ERROR_CODE.NOT_FOUND, 'Filesystem item no longer exists')
    }
    restoredItems.push(
      toSidebarItemDocument({ ...item, ...storedSidebarItemPatchFields(patch.fields) }),
    )
  }
  return { restoredItems, clearedActiveItemIds }
}

function assertNoDuplicateRestoredNames(restoredItems: Array<Doc<'sidebarItems'>>) {
  const plannedNamesByParent = new Map<string, Set<string>>()
  for (const item of restoredItems) {
    const parentKey = item.parentId ?? '__root__'
    const plannedNames = plannedNamesByParent.get(parentKey) ?? new Set<string>()
    const name = normalizeResourceNameForComparison(item.name)
    if (plannedNames.has(name)) {
      throwClientError(
        ERROR_CODE.VALIDATION_FAILED,
        'Filesystem transaction can no longer be applied cleanly',
      )
    }
    plannedNames.add(name)
    plannedNamesByParent.set(parentKey, plannedNames)
  }
}

async function assertNoActiveSiblingNameConflicts(
  ctx: CampaignMutationCtx,
  restoredItems: Array<Doc<'sidebarItems'>>,
  clearedActiveItemIds: Set<Id<'sidebarItems'>>,
) {
  const restoredItemIds = new Set(restoredItems.map((item) => item._id))
  for (const item of restoredItems) {
    const restoredName = normalizeResourceNameForComparison(item.name)
    const siblings = await getActiveSidebarItemRowsByParent(ctx, { parentId: item.parentId })
    if (
      siblings.some(
        (sibling) =>
          !restoredItemIds.has(sibling._id) &&
          !clearedActiveItemIds.has(sibling._id) &&
          normalizeResourceNameForComparison(sibling.name) === restoredName,
      )
    ) {
      throwClientError(
        ERROR_CODE.VALIDATION_FAILED,
        'Filesystem transaction can no longer be applied cleanly',
      )
    }
  }
}

async function assertActiveRedoNamesAreAvailable(
  ctx: CampaignMutationCtx,
  patches: Array<ResourcePatch>,
) {
  const { restoredItems, clearedActiveItemIds } = await collectRedoNameCheckInputs(ctx, patches)
  assertNoDuplicateRestoredNames(restoredItems)
  await assertNoActiveSiblingNameConflicts(ctx, restoredItems, clearedActiveItemIds)
}

async function applyPatches(
  ctx: CampaignMutationCtx,
  patches: Array<ResourcePatch>,
  direction?: 'undo' | 'redo',
) {
  if (direction === 'redo') {
    await assertActiveRedoNamesAreAvailable(ctx, patches)
  }
  for (const patch of patches) {
    await applyPatch(ctx, patch)
  }
  await resyncRelativeLinksForTransactionPatches(ctx, patches)
}

function patchChangesPathOrVisibility(
  patch: ResourcePatch,
): patch is Extract<ResourcePatch, { type: 'updateResource' }> {
  return (
    patch.type === 'updateResource' &&
    (patch.fields.parentId !== undefined || patch.fields.status !== undefined)
  )
}

async function resyncRelativeLinksForTransactionPatches(
  ctx: CampaignMutationCtx,
  patches: Array<ResourcePatch>,
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
  patch: ResourcePatch,
): Promise<Array<Id<'sidebarItems'>>> {
  if (!patchChangesPathOrVisibility(patch)) return []
  const item = await ctx.db.get('sidebarItems', patch.itemId)
  if (!item || item.campaignId !== ctx.campaign._id) return []
  if (item.type === RESOURCE_TYPES.notes) return [item._id]
  if (item.type !== RESOURCE_TYPES.folders || item.status === RESOURCE_STATUS.undoHidden) {
    return []
  }
  const descendants = await collectDescendants(ctx, {
    campaignId: item.campaignId,
    status: item.status,
    folderId: item._id,
  })
  return descendants
    .filter((descendant) => descendant.type === RESOURCE_TYPES.notes)
    .map((descendant) => descendant._id)
}

async function pruneOldFilesystemTransactions(ctx: CampaignMutationCtx) {
  const transactions = await getFilesystemTransactionsPastLimit(ctx, {
    limit: MAX_FILESYSTEM_UNDO_HISTORY,
    undoable: true,
  })

  for (const transaction of transactions.slice(MAX_FILESYSTEM_UNDO_HISTORY)) {
    await hardDeleteUndoHiddenCreatedRows(
      ctx,
      undoPatchesFromChangeSet(transaction.changes as StoredResourceDelta['changes']),
    )
    await ctx.db.delete('filesystemTransactions', transaction._id)
  }

  await pruneOldNonUndoableFilesystemTransactions(ctx)
}

async function pruneOldNonUndoableFilesystemTransactions(ctx: CampaignMutationCtx) {
  const transactions = await getFilesystemTransactionsPastLimit(ctx, {
    limit: MAX_FILESYSTEM_NON_UNDOABLE_HISTORY,
    undoable: false,
  })

  for (const transaction of transactions.slice(MAX_FILESYSTEM_NON_UNDOABLE_HISTORY)) {
    await ctx.db.delete('filesystemTransactions', transaction._id)
  }
}

async function getFilesystemTransactionsPastLimit(
  ctx: CampaignMutationCtx,
  {
    limit,
    undoable,
  }: {
    limit: number
    undoable: boolean
  },
) {
  return await ctx.db
    .query('filesystemTransactions')
    .withIndex('by_campaign_actor_undoable', (q) =>
      q
        .eq('campaignId', ctx.campaign._id)
        .eq('actorMemberId', ctx.membership._id)
        .eq('undoable', undoable),
    )
    .order('desc')
    .take(limit + 1)
}

async function hardDeleteUndoHiddenCreatedRows(
  ctx: CampaignMutationCtx,
  inversePatches: Array<ResourcePatch>,
) {
  const hiddenItemIds = new Set<Id<'sidebarItems'>>()
  for (const patch of inversePatches) {
    if (patch.type === 'updateResource' && patch.fields.status === RESOURCE_STATUS.undoHidden) {
      hiddenItemIds.add(patch.itemId)
    }
  }
  if (hiddenItemIds.size === 0) return

  const hiddenItems: Array<Doc<'sidebarItems'>> = []
  for (const itemId of hiddenItemIds) {
    const item = await ctx.db.get('sidebarItems', itemId)
    if (item?.campaignId === ctx.campaign._id && item.status === RESOURCE_STATUS.undoHidden) {
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
): Promise<ResourceTransactionReceipt> {
  const source = await ctx.db.get('filesystemTransactions', transactionId)
  if (!source) throwClientError(ERROR_CODE.NOT_FOUND, 'Filesystem transaction not found')
  if (source.campaignId !== ctx.campaign._id || source.actorMemberId !== ctx.membership._id) {
    throwClientError(ERROR_CODE.PERMISSION_DENIED, 'Filesystem transaction is not available')
  }
  if (!source.undoable) {
    throwClientError(ERROR_CODE.VALIDATION_FAILED, 'Filesystem transaction is not undoable')
  }

  const command = source.command as ResourceCommand
  const changes = source.changes as StoredResourceDelta['changes']
  const databasePatches =
    direction === 'undo' ? undoPatchesFromChangeSet(changes) : redoPatchesFromChangeSet(changes)
  await applyPatches(ctx, databasePatches, direction)

  return {
    transactionId,
    events: source.events,
    direction,
    command,
    patches: receiptPatchesForDirection(changes, direction, source.undoable),
    summary: summarizeResourceReceipt(command, source.events),
    undoable: true,
  }
}
