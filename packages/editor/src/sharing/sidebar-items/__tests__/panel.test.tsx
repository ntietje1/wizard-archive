import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { PERMISSION_LEVEL } from '../../../../../../shared/permissions/types'
import { RESOURCE_TYPES } from '../../../workspace/items-persistence-contract'
import type { AnyItem } from '../../../workspace/items'
import { SidebarItemsSharePanel } from '../panel'
import type { ResourceShareState } from '../../contracts'
import { AGGREGATE_SHARE_STATUS } from '../../share-state'

type ReadyResourceShareState = Extract<ResourceShareState, { status: 'ready' }>

function stubShareState() {
  const completedShareAction = () => Promise.resolve({ status: 'completed' as const })
  return {
    createState: vi.fn(
      (_items: Array<AnyItem>): ReadyResourceShareState => ({
        isMutating: false,
        status: 'ready',
        aggregateShareStatus: AGGREGATE_SHARE_STATUS.NOT_SHARED,
        shareItems: [],
        defaultPermissionLevel: null,
        inheritedAllPermissionLevel: null,
        inheritedFromFolderName: null,
        isFolderItem: false,
        inheritShares: false,
        shareableItems: [],
        participants: [],
        toggleShareStatus: vi.fn(completedShareAction),
        toggleShareWithParticipant: vi.fn(completedShareAction),
        setParticipantPermission: vi.fn(completedShareAction),
        clearParticipantPermission: vi.fn(completedShareAction),
        setDefaultPermission: vi.fn(completedShareAction),
        setInheritShares: vi.fn(completedShareAction),
      }),
    ),
  }
}

describe('SidebarItemsSharePanel', () => {
  it('renders the share menu from plain share state', () => {
    const first = createSharePanelItem('note_1', 'First')
    const state = stubShareState().createState([first])

    render(<SidebarItemsSharePanel items={[first]} state={state} />)

    expect(
      screen.getByText((_content, element) => element?.textContent === 'Share "First"'),
    ).toBeInTheDocument()
  })

  it('renders the multi-item title from the selected item count', () => {
    const first = createSharePanelItem('note_1', 'First')
    const second = createSharePanelItem('note_2', 'Second')
    const items = [first, second]
    const state = stubShareState().createState(items)

    render(<SidebarItemsSharePanel items={items} state={state} />)

    expect(screen.getByText('Share 2 items')).toBeInTheDocument()
  })

  it('disables permission controls while sharing is unavailable', () => {
    const first = createSharePanelItem('note_1', 'First')
    const state = createPendingShareState('unavailable')

    render(<SidebarItemsSharePanel items={[first]} state={state} />)

    expect(screen.getByRole('combobox')).toBeDisabled()
  })

  it('does not render incomplete share data as loading', () => {
    const first = createSharePanelItem('note_1', 'First')
    const state = createPendingShareState('incomplete')

    render(<SidebarItemsSharePanel items={[first]} state={state} />)

    expect(screen.queryByText('Loading…')).not.toBeInTheDocument()
    expect(
      screen.getByText('Sharing settings are unavailable for this selection.'),
    ).toBeInTheDocument()
  })

  it('renders failed share data as a load failure', () => {
    const first = createSharePanelItem('note_1', 'First')
    const state = createPendingShareState('failed')

    render(<SidebarItemsSharePanel items={[first]} state={state} />)

    expect(screen.getByText('Sharing settings could not be loaded.')).toBeInTheDocument()
  })

  it('updates explicit player permissions from the permission select', async () => {
    const user = userEvent.setup()
    const first = createSharePanelItem('note_1', 'First')
    const member = createShareMember('player_1', 'Player One')
    const setParticipantPermission = vi.fn(() => Promise.resolve({ status: 'completed' as const }))
    const state: ResourceShareState = {
      ...stubShareState().createState([first]),
      shareItems: [
        {
          key: `share-${member.id}`,
          participant: member,
          permissionLevel: PERMISSION_LEVEL.VIEW,
          inheritedPermissionLevel: PERMISSION_LEVEL.NONE,
          shareState: 'some',
          hasExplicitShare: true,
        },
      ],
      setParticipantPermission,
    }

    render(<SidebarItemsSharePanel items={[first]} state={state} />)

    await user.click(screen.getAllByRole('combobox')[0])
    await user.click(await screen.findByRole('option', { name: 'Edit' }))

    expect(setParticipantPermission).toHaveBeenCalledWith(member.id, PERMISSION_LEVEL.EDIT)
  })
})

function createPendingShareState(
  status: Exclude<ResourceShareState['status'], 'ready'>,
): ResourceShareState {
  return {
    isMutating: false,
    status,
    aggregateShareStatus: null,
    shareItems: [],
    defaultPermissionLevel: null,
    inheritedAllPermissionLevel: null,
    inheritedFromFolderName: null,
    isFolderItem: false,
    inheritShares: false,
    shareableItems: [],
    participants: [],
  }
}

function createSharePanelItem(id: string, name: string) {
  return {
    id: id,
    name,
    type: RESOURCE_TYPES.notes,
  } as AnyItem
}

function createShareMember(
  id: string,
  name: string,
): ResourceShareState['shareItems'][number]['participant'] {
  return {
    id,
    displayName: name,
    username: id,
    imageUrl: null,
  } as ResourceShareState['shareItems'][number]['participant']
}
