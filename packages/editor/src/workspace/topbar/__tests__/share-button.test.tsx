import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ReactNode } from 'react'
import { describe, expect, it, vi } from 'vite-plus/test'
import { ShareButton } from '../share-button'
import { createNote } from '../../../test/sidebar-item-factory'
import type { AnyItem } from '../../items'
import type { ResourceShareState } from '../../../sharing/contracts'

type ReadyResourceShareState = Extract<ResourceShareState, { status: 'ready' }>
type PendingResourceShareState = Exclude<ResourceShareState, ReadyResourceShareState>

vi.mock('../../../sharing/sidebar-items/panel', () => ({
  SidebarItemsSharePanel: ({
    items,
    state,
  }: {
    items: Array<AnyItem>
    state: ResourceShareState
  }) => (
    <div data-testid="topbar-share-panel">
      {items.map((item) => item.name).join(', ')}
      <span>{state.aggregateShareStatus}</span>
    </div>
  ),
}))

describe('ShareButton', () => {
  it('derives current item share state from the share source capability', async () => {
    const user = userEvent.setup()
    const item = createNote({ name: 'Session Notes' })
    const state = createShareState({ aggregateShareStatus: 'individually_shared' })
    const renderItemsShareState = vi.fn(
      (_items: Array<AnyItem>, renderState: (value: ResourceShareState) => ReactNode) =>
        renderState(state),
    )

    render(
      <ShareButton
        share={{
          status: 'available',
          renderItemsShareState,
          setDefaultPermission: vi.fn(),
          setParticipantPermission: vi.fn(),
        }}
        item={item}
        isLoading={false}
      />,
    )

    await user.click(screen.getByRole('button', { name: /Shared/ }))

    expect(renderItemsShareState).toHaveBeenCalledWith([item], expect.any(Function))
    expect(await screen.findByTestId('topbar-share-panel')).toHaveTextContent(
      'Session Notesindividually_shared',
    )
  })

  it('keeps the topbar share control disabled while the current item is loading', () => {
    const item = createNote({ name: 'Session Notes' })

    render(
      <ShareButton
        share={{
          status: 'available',
          renderItemsShareState: (_items, renderState) => renderState(createShareState()),
          setDefaultPermission: vi.fn(),
          setParticipantPermission: vi.fn(),
        }}
        item={item}
        isLoading={true}
      />,
    )

    expect(screen.getByRole('button', { name: /Private/ })).toBeDisabled()
  })

  it('does not present incomplete share state as shared', () => {
    const item = createNote({ name: 'Session Notes' })

    render(
      <ShareButton
        share={{
          status: 'available',
          renderItemsShareState: (_items, renderState) =>
            renderState(
              createPendingShareState({ status: 'incomplete', aggregateShareStatus: null }),
            ),
          setDefaultPermission: vi.fn(),
          setParticipantPermission: vi.fn(),
        }}
        item={item}
        isLoading={false}
      />,
    )

    expect(screen.getByRole('button', { name: /Unavailable/ })).toBeDisabled()
  })

  it('does not present failed share state as private', () => {
    const item = createNote({ name: 'Session Notes' })

    render(
      <ShareButton
        share={{
          status: 'available',
          renderItemsShareState: (_items, renderState) =>
            renderState(createPendingShareState({ status: 'failed', aggregateShareStatus: null })),
          setDefaultPermission: vi.fn(),
          setParticipantPermission: vi.fn(),
        }}
        item={item}
        isLoading={false}
      />,
    )

    expect(screen.getByRole('button', { name: /Unavailable/ })).toBeDisabled()
  })
})

function createShareState(
  overrides: Partial<ReadyResourceShareState> = {},
): ReadyResourceShareState {
  return {
    aggregateShareStatus: 'not_shared',
    defaultPermissionLevel: null,
    clearParticipantPermission: vi.fn(),
    inheritShares: false,
    inheritedAllPermissionLevel: null,
    inheritedFromFolderName: null,
    isFolderItem: false,
    isMutating: false,
    participants: [],
    setDefaultPermission: vi.fn(),
    setInheritShares: vi.fn(),
    setParticipantPermission: vi.fn(),
    shareItems: [],
    shareableItems: [],
    status: 'ready',
    toggleShareStatus: vi.fn(),
    toggleShareWithParticipant: vi.fn(),
    ...overrides,
  }
}

function createPendingShareState(
  overrides: Pick<PendingResourceShareState, 'status'> & Partial<PendingResourceShareState>,
): PendingResourceShareState {
  return {
    aggregateShareStatus: null,
    defaultPermissionLevel: null,
    inheritShares: false,
    inheritedAllPermissionLevel: null,
    inheritedFromFolderName: null,
    isFolderItem: false,
    isMutating: false,
    participants: [],
    shareItems: [],
    shareableItems: [],
    ...overrides,
  }
}
