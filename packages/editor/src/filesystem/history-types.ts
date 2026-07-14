import type { MaybePromise } from '../../../../shared/common/async'
import type { SidebarItemId } from '../../../../shared/common/ids'
import type { HistoryEntryId } from '../resources/domain-id'
import type { GameMapSnapshotData } from '../game-maps/document-contract'
import type { EditHistoryEntry, HistoryRollbackResult } from './history-contract'

export interface HistoryMemberSummary {
  id: string
  name: string | null
  username: string | null
  imageUrl: string | null
}

export type HistoryPreviewImageUrlState =
  | { status: 'idle' }
  | { status: 'error' }
  | { status: 'ready'; url: string }

export type HistoryPreviewSnapshot =
  | { kind: 'note-yjs'; noteId: SidebarItemId; data: ArrayBuffer }
  | { kind: 'canvas-yjs'; canvasId: SidebarItemId; data: ArrayBuffer }
  | {
      kind: 'game-map'
      snapshotData: GameMapSnapshotData
      imageUrlState: HistoryPreviewImageUrlState
    }
  | { kind: 'unsupported' }

export type HistoryPreviewState =
  | { status: 'loading'; entryTime: number | undefined }
  | { status: 'error'; entryTime: number | undefined }
  | { status: 'unavailable'; entryTime: number | undefined }
  | { status: 'ready'; entryTime: number | undefined; snapshot: HistoryPreviewSnapshot }

export type RollbackState =
  | { status: 'closed'; isRestoring: false }
  | { status: 'loading'; isRestoring: boolean }
  | { status: 'error'; isRestoring: boolean }
  | { status: 'ready'; entryTime: number; isRestoring: boolean }

export type HistoryEntriesLoadStatus =
  | 'LoadingFirstPage'
  | 'CanLoadMore'
  | 'LoadingMore'
  | 'Exhausted'

export interface HistoryEntriesState {
  canEdit: boolean
  entries: Array<EditHistoryEntry>
  membersMap: ReadonlyMap<string, HistoryMemberSummary>
  myMemberId: string | null
  previewingEntryId: HistoryEntryId | null
  status: HistoryEntriesLoadStatus
}

export interface HistoryEntriesModel {
  loadMore: () => void
  state: HistoryEntriesState
}

export interface ResourceHistoryAvailable {
  status: 'available'
  itemId: SidebarItemId
  entries: HistoryEntriesModel
  previewingEntryId: HistoryEntryId | null
  preview: HistoryPreviewState
  previewEntry: (entryId: HistoryEntryId | null) => void
  rollbackEntryId: HistoryEntryId | null
  rollback: RollbackState
  requestRollback: (entryId: HistoryEntryId | null) => void
  restoreRollback: (entryId: HistoryEntryId) => MaybePromise<HistoryRollbackResult>
  clearPreview: () => void
  clearRollback: () => void
  clearItemSession: () => void
}

export type ResourceHistory =
  | ResourceHistoryAvailable
  | {
      status: 'unsupported'
      reason: 'not_implemented'
    }
