import type { ResourceId, HistoryEntryId } from '../resources/domain-id'

import { isPersistedResourceItemId } from '../workspace/items'
import type { EditHistoryEntry, HistoryRollbackResult } from './history-contract'
import type {
  ResourceHistory,
  HistoryEntriesLoadStatus,
  HistoryEntriesModel,
  HistoryEntriesState,
  HistoryMemberSummary,
  HistoryPreviewSnapshot,
  HistoryPreviewState,
  RollbackState,
} from './history-types'

interface ResourceHistoryScopeInput {
  canEdit: boolean
  itemId: ResourceId | null
  previewingEntryId: HistoryEntryId | null
  rollbackEntryId: HistoryEntryId | null
}

interface ResourceHistoryScope {
  activePreviewingEntryId: HistoryEntryId | null
  activeRollbackEntryId: HistoryEntryId | null
  persistedItemId: ResourceId | null
}

interface ResourceHistoryEntriesInput {
  canEdit: boolean
  entries: Array<EditHistoryEntry>
  loadMore: () => void
  members: Iterable<HistoryMemberSummary>
  myMemberId: string | null
  previewingEntryId: HistoryEntryId | null
  status: HistoryEntriesLoadStatus
}

interface ResourceHistoryPreviewInput {
  entryTime: number | undefined
  historyEntryError: unknown
  historyEntryLoading: boolean
  snapshot: HistoryPreviewSnapshot | null | undefined
  snapshotError: unknown
  snapshotLoading: boolean
}

interface ResourceHistoryRollbackInput {
  entryId: HistoryEntryId | null
  entryTime: number | undefined
  historyEntryError: unknown
  historyEntryLoading: boolean
  isRestoring: boolean
}

interface ResourceFileSystemHistoryInput {
  activeRollbackEntryId: HistoryEntryId | null
  clearItemSession: () => void
  clearPreview: () => void
  clearRollback: () => void
  entries: ResourceHistoryEntriesInput
  itemId: ResourceId | null
  previewEntry: (entryId: HistoryEntryId | null) => void
  preview: ResourceHistoryPreviewInput
  requestRollback: (entryId: HistoryEntryId | null) => void
  restoreRollback: (
    entryId: HistoryEntryId,
  ) => HistoryRollbackResult | Promise<HistoryRollbackResult>
  rollback: Omit<ResourceHistoryRollbackInput, 'entryId'>
}

export function resolveResourceHistoryScope({
  canEdit,
  itemId,
  previewingEntryId,
  rollbackEntryId,
}: ResourceHistoryScopeInput): ResourceHistoryScope {
  const persistedItemId = itemId && isPersistedResourceItemId(itemId) ? itemId : null
  return {
    activePreviewingEntryId: persistedItemId && canEdit ? previewingEntryId : null,
    activeRollbackEntryId: persistedItemId && canEdit ? rollbackEntryId : null,
    persistedItemId,
  }
}

export function createResourceFileSystemHistory({
  activeRollbackEntryId,
  clearItemSession,
  clearPreview,
  clearRollback,
  entries,
  itemId,
  previewEntry,
  preview,
  requestRollback,
  restoreRollback,
  rollback,
}: ResourceFileSystemHistoryInput): ResourceHistory {
  if (!itemId) {
    return { status: 'unsupported', reason: 'not_implemented' }
  }

  return {
    status: 'available',
    itemId,
    entries: createResourceHistoryEntriesModel(entries),
    previewingEntryId: entries.previewingEntryId,
    preview: createResourceHistoryPreviewState(preview),
    previewEntry,
    rollbackEntryId: activeRollbackEntryId,
    rollback: createResourceRollbackState({
      ...rollback,
      entryId: activeRollbackEntryId,
    }),
    requestRollback,
    restoreRollback,
    clearPreview,
    clearRollback,
    clearItemSession,
  }
}

function createResourceHistoryEntriesModel({
  canEdit,
  entries,
  loadMore,
  members,
  myMemberId,
  previewingEntryId,
  status,
}: ResourceHistoryEntriesInput): HistoryEntriesModel {
  const membersMap = new Map<string, HistoryMemberSummary>()
  for (const member of members) {
    membersMap.set(member.id, member)
  }

  return {
    loadMore,
    state: {
      canEdit,
      entries,
      membersMap,
      myMemberId,
      previewingEntryId,
      status,
    } satisfies HistoryEntriesState,
  }
}

function createResourceHistoryPreviewState({
  entryTime,
  historyEntryError,
  historyEntryLoading,
  snapshot,
  snapshotError,
  snapshotLoading,
}: ResourceHistoryPreviewInput): HistoryPreviewState {
  if (snapshotLoading || historyEntryLoading) {
    return { status: 'loading', entryTime }
  }

  if (snapshotError || historyEntryError) {
    return { status: 'error', entryTime }
  }

  if (!snapshot) {
    return { status: 'unavailable', entryTime }
  }

  return {
    status: 'ready',
    entryTime,
    snapshot,
  }
}

function createResourceRollbackState({
  entryId,
  entryTime,
  historyEntryError,
  historyEntryLoading,
  isRestoring,
}: ResourceHistoryRollbackInput): RollbackState {
  if (entryId === null) {
    return { status: 'closed', isRestoring: false }
  }

  if (historyEntryLoading) {
    return { status: 'loading', isRestoring }
  }

  if (historyEntryError) {
    return { status: 'error', isRestoring }
  }

  if (entryTime === undefined) {
    return { status: 'error', isRestoring }
  }

  return {
    status: 'ready',
    entryTime,
    isRestoring,
  }
}
