import { api } from 'convex/_generated/api'
import type { Id } from 'convex/_generated/dataModel'
import { SNAPSHOT_TYPE } from 'shared/document-snapshots/types'
import { SIDEBAR_ITEM_TYPES } from 'shared/sidebar-items/types'
import { HistoryPreviewViewer } from './history-preview-viewer'
import { readGameMapSnapshot } from './history-preview-snapshot'
import type {
  GameMapSnapshotImageUrlState,
  HistoryPreviewSnapshot,
  HistoryPreviewViewerState,
} from './history-preview-viewer'
import type { DocumentSnapshot } from 'convex/documentSnapshots/types'
import { useAuthQuery } from '~/shared/hooks/useAuthQuery'
import { useCampaignQuery } from '~/shared/hooks/useCampaignQuery'
import { useEditorMode } from '~/features/sidebar/hooks/useEditorMode'
import { useHistoryPreviewStore } from '~/features/editor/stores/history-preview-store'
import { logger } from '~/shared/utils/logger'

export function LiveHistoryPreviewViewer({
  entryId,
  itemId,
}: {
  entryId: Id<'editHistory'>
  itemId: Id<'sidebarItems'>
}) {
  const snapshotQuery = useCampaignQuery(api.documentSnapshots.queries.getSnapshotForHistoryEntry, {
    editHistoryId: entryId,
  })
  const historyEntry = useCampaignQuery(api.editHistory.queries.getHistoryEntry, {
    editHistoryId: entryId,
  })
  const { canEdit } = useEditorMode()
  const clearPreview = useHistoryPreviewStore((s) => s.clearPreview)
  const setRollbackEntry = useHistoryPreviewStore((s) => s.setRollbackEntry)

  const rawSnapshot = snapshotQuery.data
  const snapshot =
    rawSnapshot === null || rawSnapshot === undefined
      ? rawSnapshot
      : isValidDocumentSnapshot(rawSnapshot)
        ? rawSnapshot
        : null
  if (rawSnapshot && !snapshot) {
    logger.error('Invalid document snapshot shape', rawSnapshot)
  }
  const gameMapSnapshotData = readLiveGameMapSnapshot(snapshot)
  const imageStorageId = gameMapSnapshotData?.imageStorageId as Id<'_storage'> | undefined
  const imageUrl = useAuthQuery(
    api.storage.queries.getDownloadUrl,
    imageStorageId ? { storageId: imageStorageId } : 'skip',
  )

  const entryTime = historyEntry.data?._creationTime
  const state = toHistoryPreviewViewerState({
    entryTime,
    gameMapSnapshotData,
    historyEntryError: historyEntry.error,
    historyEntryLoading: historyEntry.isLoading,
    imageUrlState: toGameMapImageUrlState(
      Boolean(imageStorageId),
      imageUrl.isLoading,
      imageUrl.data,
    ),
    snapshot,
    snapshotError: snapshotQuery.error,
    snapshotLoading: snapshotQuery.isLoading,
  })

  return (
    <HistoryPreviewViewer
      canEdit={canEdit}
      state={state}
      onExit={() => clearPreview(itemId)}
      onRestore={() => setRollbackEntry(itemId, entryId)}
    />
  )
}

function readLiveGameMapSnapshot(snapshot: DocumentSnapshot | null | undefined) {
  if (snapshot?.snapshotType !== SNAPSHOT_TYPE.game_map) {
    return null
  }
  return readGameMapSnapshot(snapshot.data)
}

function isValidDocumentSnapshot(data: unknown): data is DocumentSnapshot {
  if (!isRecord(data)) return false

  return (
    typeof data._id === 'string' &&
    typeof data._creationTime === 'number' &&
    typeof data.itemId === 'string' &&
    typeof data.itemType === 'string' &&
    typeof data.editHistoryId === 'string' &&
    typeof data.campaignId === 'string' &&
    typeof data.snapshotType === 'string' &&
    data.data instanceof ArrayBuffer
  )
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function toGameMapImageUrlState(
  hasImageStorageId: boolean,
  isLoading: boolean,
  url: string | null | undefined,
): GameMapSnapshotImageUrlState {
  if (!hasImageStorageId) {
    return { status: 'idle' }
  }

  if (isLoading) {
    return { status: 'loading' }
  }

  if (url) {
    return { status: 'ready', url }
  }

  return { status: 'error' }
}

function toHistoryPreviewViewerState({
  entryTime,
  gameMapSnapshotData,
  historyEntryError,
  historyEntryLoading,
  imageUrlState,
  snapshot,
  snapshotError,
  snapshotLoading,
}: {
  entryTime: number | undefined
  gameMapSnapshotData: ReturnType<typeof readGameMapSnapshot>
  historyEntryError: unknown
  historyEntryLoading: boolean
  imageUrlState: GameMapSnapshotImageUrlState
  snapshot: DocumentSnapshot | null | undefined
  snapshotError: unknown
  snapshotLoading: boolean
}): HistoryPreviewViewerState {
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
    snapshot: toHistoryPreviewSnapshot(snapshot, gameMapSnapshotData, imageUrlState),
  }
}

function toHistoryPreviewSnapshot(
  snapshot: DocumentSnapshot,
  gameMapSnapshotData: ReturnType<typeof readGameMapSnapshot>,
  imageUrlState: GameMapSnapshotImageUrlState,
): HistoryPreviewSnapshot {
  if (
    snapshot.snapshotType === SNAPSHOT_TYPE.yjs_state &&
    snapshot.itemType === SIDEBAR_ITEM_TYPES.notes
  ) {
    return { kind: 'note-yjs', noteId: snapshot.itemId, data: snapshot.data }
  }

  if (
    snapshot.snapshotType === SNAPSHOT_TYPE.yjs_state &&
    snapshot.itemType === SIDEBAR_ITEM_TYPES.canvases
  ) {
    return { kind: 'canvas-yjs', canvasId: snapshot.itemId, data: snapshot.data }
  }

  if (snapshot.snapshotType === SNAPSHOT_TYPE.game_map) {
    return { kind: 'game-map', snapshotData: gameMapSnapshotData, imageUrlState }
  }

  return { kind: 'unsupported' }
}
