import { fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { CAMPAIGN_MEMBER_ROLE, CAMPAIGN_MEMBER_STATUS } from 'shared/campaigns/types'
import type { CampaignMemberSummary } from 'shared/campaigns/types'
import type { EditHistoryEntry } from 'shared/edit-history/types'
import { HistoryPanel } from '../history-panel'
import type { HistoryPanelState } from '../history-panel'
import { assertUsername } from 'shared/users/validation'
import type {
  CampaignId,
  CampaignMemberId,
  EditHistoryId,
  SidebarItemId,
  UserProfileId,
} from 'shared/common/ids'

class IntersectionObserverStub {
  observe = vi.fn()
  disconnect = vi.fn()
}

function historyEntry(overrides: Partial<EditHistoryEntry> = {}): EditHistoryEntry {
  return {
    _id: 'history-1' as EditHistoryId,
    _creationTime: Date.UTC(2026, 0, 1),
    action: 'content_edited',
    campaignId: 'campaign-1' as CampaignId,
    campaignMemberId: 'member-1' as CampaignMemberId,
    hasSnapshot: true,
    itemId: 'note-1' as SidebarItemId,
    itemType: 'note',
    metadata: null,
    ...overrides,
  } as EditHistoryEntry
}

function member(): CampaignMemberSummary {
  return {
    _id: 'member-1' as CampaignMemberId,
    _creationTime: 1,
    campaignId: 'campaign-1' as CampaignId,
    role: CAMPAIGN_MEMBER_ROLE.DM,
    status: CAMPAIGN_MEMBER_STATUS.Accepted,
    userId: 'user-1' as UserProfileId,
    userProfile: {
      imageUrl: null,
      name: 'Avery',
      username: assertUsername('avery'),
    },
  }
}

function renderHistoryPanel(state: Partial<HistoryPanelState> = {}) {
  const onLoadMore = vi.fn()
  const onPreviewEntryChange = vi.fn()
  const onRollbackEntry = vi.fn()
  const entry = historyEntry()
  const result = render(
    <HistoryPanel
      state={{
        canEdit: true,
        entries: [entry],
        membersMap: new Map([[entry.campaignMemberId, member()]]),
        myMemberId: null,
        previewingEntryId: null,
        status: 'Exhausted',
        ...state,
      }}
      onLoadMore={onLoadMore}
      onPreviewEntryChange={onPreviewEntryChange}
      onRollbackEntry={onRollbackEntry}
    />,
  )

  return { ...result, onLoadMore, onPreviewEntryChange, onRollbackEntry }
}

describe('HistoryPanel', () => {
  beforeEach(() => {
    vi.stubGlobal('IntersectionObserver', IntersectionObserverStub)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('renders history entries and routes preview and rollback actions to source callbacks', () => {
    const { onPreviewEntryChange, onRollbackEntry } = renderHistoryPanel()

    fireEvent.click(screen.getByRole('button', { pressed: false }))
    fireEvent.click(screen.getByRole('button', { name: 'Restore this version' }))

    expect(screen.getByText('Avery')).toBeInTheDocument()
    expect(screen.getByText('edited content')).toBeInTheDocument()
    expect(onPreviewEntryChange).toHaveBeenCalledWith('history-1')
    expect(onRollbackEntry).toHaveBeenCalledWith('history-1')
  })

  it('renders the selected history entry as pressed and clears preview on click', () => {
    const { onPreviewEntryChange } = renderHistoryPanel({
      previewingEntryId: 'history-1' as EditHistoryId,
    })

    fireEvent.click(screen.getByRole('button', { pressed: true }))

    expect(onPreviewEntryChange).toHaveBeenCalledWith(null)
  })
})
