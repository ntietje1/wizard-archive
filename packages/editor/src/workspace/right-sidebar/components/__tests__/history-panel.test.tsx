import { fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test'
import type { ResourceHistory, HistoryMemberSummary } from '../../../../filesystem/history-types'
import type { EditHistoryEntry } from '../../../../filesystem/history-contract'
import { assertUsername } from '../../../../../../../shared/users/validation'
import { testId } from '../../../../test/id'
import { HistoryPanel } from '../history'

type HistoryEntriesState = Extract<ResourceHistory, { status: 'available' }>['entries']['state']

let intersectionCallback: IntersectionObserverCallback | null = null

class IntersectionObserverStub {
  constructor(callback: IntersectionObserverCallback) {
    intersectionCallback = callback
  }

  observe = vi.fn()
  disconnect = vi.fn()
}

function historyEntry(overrides: Partial<EditHistoryEntry> = {}): EditHistoryEntry {
  return {
    id: testId<'editHistory'>('history-1'),
    createdAt: Date.UTC(2026, 0, 1),
    action: 'content_edited',
    workspaceId: testId<'campaigns'>('campaign-1'),
    memberId: testId<'campaignMembers'>('member-1'),
    hasSnapshot: true,
    itemId: testId<'sidebarItems'>('note-1'),
    itemType: 'note',
    metadata: null,
    ...overrides,
  } as EditHistoryEntry
}

function member(): HistoryMemberSummary {
  return {
    id: testId<'campaignMembers'>('member-1'),
    imageUrl: null,
    name: 'Avery',
    username: assertUsername('avery'),
  }
}

function renderHistoryPanel(state: Partial<HistoryEntriesState> = {}) {
  const onLoadMore = vi.fn()
  const onPreviewEntryChange = vi.fn()
  const onRollbackEntry = vi.fn()
  const entry = historyEntry()
  const result = render(
    <HistoryPanel
      state={{
        canEdit: true,
        entries: [entry],
        membersMap: new Map([[entry.memberId, member()]]),
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
    intersectionCallback = null
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
      previewingEntryId: testId<'editHistory'>('history-1'),
    })

    fireEvent.click(screen.getByRole('button', { pressed: true }))

    expect(onPreviewEntryChange).toHaveBeenCalledWith(null)
  })

  it('loads more history when the sentinel enters the scroll viewport', () => {
    const { onLoadMore } = renderHistoryPanel({ status: 'CanLoadMore' })

    intersectionCallback?.(
      [{ isIntersecting: true } as IntersectionObserverEntry],
      {} as IntersectionObserver,
    )

    expect(onLoadMore).toHaveBeenCalledTimes(1)
  })
})
