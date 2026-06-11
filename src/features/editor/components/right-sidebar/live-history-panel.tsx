import { api } from 'convex/_generated/api'
import type { Id } from 'convex/_generated/dataModel'
import { HistoryPanel } from './history-panel'
import type { HistoryPanelLoadStatus, HistoryPanelState } from './history-panel'
import type { CampaignMemberSummary } from 'shared/campaigns/types'
import type { EditHistoryEntry } from 'shared/edit-history/types'
import { useAuthPaginatedQuery } from '~/shared/hooks/useAuthPaginatedQuery'
import { useCampaign } from '~/features/campaigns/hooks/useCampaign'
import { useCampaignMembers } from '~/features/campaigns/hooks/useCampaignMembers'
import { useEditorMode } from '~/features/sidebar/hooks/useEditorMode'
import { useHistoryPreviewStore } from '~/features/editor/stores/history-preview-store'

const HISTORY_PANEL_PAGE_SIZE = 20

export function LiveHistoryPanel({ itemId }: { itemId: Id<'sidebarItems'> }) {
  const membersQuery = useCampaignMembers()
  const { campaign, campaignId } = useCampaign()
  const {
    results = [],
    status,
    loadMore,
  } = useAuthPaginatedQuery(
    api.editHistory.queries.getItemHistory,
    campaignId ? { campaignId, itemId } : 'skip',
    { initialNumItems: HISTORY_PANEL_PAGE_SIZE },
  )
  const { canEdit } = useEditorMode()
  const myMemberId = campaign.data?.myMembership?._id ?? null
  const previewingEntryId = useHistoryPreviewStore((s) =>
    s.preview?.itemId === itemId ? s.preview.entryId : null,
  )
  const setPreviewingEntry = useHistoryPreviewStore((s) => s.setPreviewingEntry)
  const setRollbackEntry = useHistoryPreviewStore((s) => s.setRollbackEntry)

  const membersMap = new Map<string, CampaignMemberSummary>()
  if (membersQuery.data) {
    for (const member of membersQuery.data) {
      membersMap.set(member._id, member)
    }
  }

  const state: HistoryPanelState = {
    canEdit,
    entries: results as Array<EditHistoryEntry>,
    membersMap,
    myMemberId,
    previewingEntryId,
    status: status as HistoryPanelLoadStatus,
  }

  return (
    <HistoryPanel
      state={state}
      onLoadMore={() => loadMore(HISTORY_PANEL_PAGE_SIZE)}
      onPreviewEntryChange={(entryId) => setPreviewingEntry(itemId, entryId)}
      onRollbackEntry={(entryId) => setRollbackEntry(itemId, entryId)}
    />
  )
}
