import { toast } from 'sonner'
import { useRef, useState } from 'react'
import { useConvex } from '@convex-dev/react-query'
import { api } from 'convex/_generated/api'
import type { Id } from 'convex/_generated/dataModel'
import type { SidebarItemId } from 'shared/common/ids'
import type { HistoryEntryId } from '@wizard-archive/editor/resources/domain-id'
import {
  createWizardEditorHistorySource,
  resolveWizardEditorHistoryScope,
} from '@wizard-archive/editor/adapter'
import type {
  WizardEditorHistoryInput,
  WizardEditorHistoryMemberSummary,
} from '@wizard-archive/editor/adapter'
import { useCampaign } from '~/features/campaigns/hooks/useCampaign'
import { useCampaignMembers } from '~/features/campaigns/hooks/useCampaignMembers'
import { useAuthPaginatedQuery } from '~/shared/hooks/useAuthPaginatedQuery'
import { useCampaignQuery } from '~/shared/hooks/useCampaignQuery'
import { handleError } from '~/shared/utils/logger'

const HISTORY_ENTRIES_PAGE_SIZE = 20
type EditorHistoryEntry = WizardEditorHistoryInput['entries']['entries'][number]
type EditorHistoryRollbackResult = Awaited<ReturnType<WizardEditorHistoryInput['restoreRollback']>>
type EditorHistorySnapshot = NonNullable<WizardEditorHistoryInput['preview']['snapshot']>
type HistoryEntriesLoadStatus = WizardEditorHistoryInput['entries']['status']
type LiveResourceHistoryControls = Pick<
  WizardEditorHistoryInput,
  'clearItemSession' | 'clearPreview' | 'clearRollback' | 'previewEntry' | 'requestRollback'
> & {
  previewingEntryId: HistoryEntryId | null
  rollbackEntryId: HistoryEntryId | null
}
type LiveHistoryEntry = Omit<EditorHistoryEntry, 'memberId' | 'metadata' | 'workspaceId'> & {
  campaignMemberId: Id<'campaignMembers'>
  metadata: EditorHistoryEntry['metadata']
} & Record<'campaignId', Id<'campaigns'>>

export function useLiveWorkspaceHistory({
  canEdit,
  controls,
  itemId,
}: {
  canEdit: boolean
  controls: LiveResourceHistoryControls
  itemId: SidebarItemId | null
}) {
  const { activePreviewingEntryId, activeRollbackEntryId, persistedItemId } =
    resolveWizardEditorHistoryScope({
      canEdit,
      itemId,
      previewingEntryId: controls.previewingEntryId,
      rollbackEntryId: controls.rollbackEntryId,
    })
  const convex = useConvex()
  const { campaignId } = useCampaign()
  const rollbackPendingRef = useRef(false)
  const [isRollbackPending, setIsRollbackPending] = useState(false)
  const entries = useLiveHistoryEntriesModel({
    canEdit,
    itemId: persistedItemId,
    previewingEntryId: activePreviewingEntryId,
  })
  const preview = useLiveHistoryPreviewState({ entryId: activePreviewingEntryId })
  const rollbackState = useLiveRollbackState(activeRollbackEntryId, isRollbackPending)
  const restoreRollback = async (entryId: HistoryEntryId) => {
    if (rollbackPendingRef.current) return { status: 'already_running' as const }
    if (!campaignId) {
      return {
        status: 'rejected' as const,
        reason: 'workspace_unavailable' as const,
      }
    }

    rollbackPendingRef.current = true
    setIsRollbackPending(true)
    try {
      const result = (await convex.action(api.documentSnapshots.actions.rollbackToSnapshot, {
        campaignId,
        editHistoryId: entryId,
      })) as EditorHistoryRollbackResult
      reportRollbackResult(result)
      return result
    } catch (error) {
      handleError(error, 'Failed to restore version')
      return { status: 'failed' as const }
    } finally {
      rollbackPendingRef.current = false
      setIsRollbackPending(false)
    }
  }

  return createWizardEditorHistorySource({
    activeRollbackEntryId,
    clearItemSession: controls.clearItemSession,
    clearPreview: controls.clearPreview,
    clearRollback: controls.clearRollback,
    entries,
    itemId: persistedItemId,
    previewEntry: controls.previewEntry,
    preview,
    requestRollback: controls.requestRollback,
    restoreRollback,
    rollback: rollbackState,
  })
}

function reportRollbackResult(result: EditorHistoryRollbackResult) {
  if (result.status === 'restored') {
    toast.success('Version restored')
    return
  }
  if (result.status !== 'rejected') return

  const message =
    result.reason === 'content_changed'
      ? 'The document changed while restoring. Please try again.'
      : result.reason === 'snapshot_incompatible'
        ? 'This version is not compatible with the current document.'
        : result.reason === 'unsupported_item_type'
          ? 'This item does not support version restore.'
          : 'This version is no longer available.'
  toast.error(message)
}

function useLiveHistoryEntriesModel({
  canEdit,
  itemId,
  previewingEntryId,
}: {
  canEdit: boolean
  itemId: SidebarItemId | null
  previewingEntryId: HistoryEntryId | null
}): WizardEditorHistoryInput['entries'] {
  const membersQuery = useCampaignMembers()
  const { campaign, campaignId: workspaceRecordId } = useCampaign()
  const { results, status, loadMore } = useAuthPaginatedQuery(
    api.editHistory.queries.getItemHistory,
    workspaceRecordId && itemId && canEdit
      ? { campaignId: workspaceRecordId, itemId: itemId as Id<'sidebarItems'> }
      : 'skip',
    { initialNumItems: HISTORY_ENTRIES_PAGE_SIZE },
  )

  return {
    canEdit,
    entries: results.map(toEditorHistoryEntry),
    loadMore: () => {
      if (itemId && canEdit) loadMore(HISTORY_ENTRIES_PAGE_SIZE)
    },
    members: (membersQuery.data ?? []).map(toHistoryMemberSummary),
    myMemberId: campaign.data?.myMembership?.id ?? null,
    previewingEntryId,
    status: status as HistoryEntriesLoadStatus,
  }
}

function useLiveHistoryPreviewState({
  entryId,
}: {
  entryId: HistoryEntryId | null
}): WizardEditorHistoryInput['preview'] {
  const snapshotQuery = useCampaignQuery(
    api.documentSnapshots.queries.getHistoryPreview,
    entryId ? { editHistoryId: entryId } : 'skip',
  )
  const historyEntry = useCampaignQuery(
    api.editHistory.queries.getHistoryEntry,
    entryId ? { editHistoryId: entryId } : 'skip',
  )
  const hasEntry = entryId !== null
  const snapshot = (hasEntry ? snapshotQuery?.data : undefined) as
    | EditorHistorySnapshot
    | null
    | undefined

  return {
    entryTime: readLiveCreatedAt(historyEntry?.data),
    historyEntryError: historyEntry?.error,
    historyEntryLoading: historyEntry?.isLoading ?? false,
    snapshot,
    snapshotError: snapshotQuery?.error,
    snapshotLoading: snapshotQuery?.isLoading ?? false,
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function toEditorHistoryMetadata(metadata: EditorHistoryEntry['metadata']) {
  if (!isRecord(metadata) || !('campaignMemberId' in metadata)) return metadata

  const { campaignMemberId, ...fields } = metadata
  return {
    ...fields,
    ...(typeof campaignMemberId === 'string' ? { memberId: campaignMemberId } : {}),
  } as EditorHistoryEntry['metadata']
}

function toHistoryMemberSummary(member: {
  id: string
  userProfile: { imageUrl: string | null; name: string | null; username: string | null }
}): WizardEditorHistoryMemberSummary {
  return {
    id: member.id,
    imageUrl: member.userProfile.imageUrl,
    name: member.userProfile.name,
    username: member.userProfile.username,
  }
}

function toEditorHistoryEntry(entry: LiveHistoryEntry): EditorHistoryEntry {
  const { campaignId: workspaceRecordId, campaignMemberId, metadata, ...fields } = entry
  return {
    ...fields,
    workspaceId: workspaceRecordId,
    memberId: campaignMemberId,
    metadata: toEditorHistoryMetadata(metadata),
  } as EditorHistoryEntry
}

function readLiveCreatedAt(entry: unknown): number | undefined {
  if (!isRecord(entry)) return undefined
  return typeof entry.createdAt === 'number' ? entry.createdAt : undefined
}

function useLiveRollbackState(
  rollbackEntryId: HistoryEntryId | null,
  isRestoring: boolean,
): WizardEditorHistoryInput['rollback'] {
  const historyEntry = useCampaignQuery(
    api.editHistory.queries.getHistoryEntry,
    rollbackEntryId ? { editHistoryId: rollbackEntryId } : 'skip',
  )
  const hasRollback = rollbackEntryId !== null

  return {
    entryTime: hasRollback ? readLiveCreatedAt(historyEntry?.data) : undefined,
    historyEntryError: hasRollback ? historyEntry?.error : null,
    historyEntryLoading: hasRollback ? (historyEntry?.isLoading ?? false) : false,
    isRestoring,
  }
}
