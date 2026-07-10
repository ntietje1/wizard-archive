import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vite-plus/test'
import { ViewAsPlayerButton } from '../view-as-button'
import type { ViewAsParticipantCapability } from '../../../sharing/contracts'
import { testId } from '../../../test/id'

type AvailableViewAsParticipantCapability = Extract<
  ViewAsParticipantCapability,
  { status: 'available' }
>

const viewAsState = vi.hoisted(() => ({
  viewAsParticipantId: undefined as string | undefined,
  setSelectedParticipantId: vi.fn(),
}))

describe('ViewAsPlayerButton', () => {
  beforeEach(() => {
    viewAsState.viewAsParticipantId = undefined
    viewAsState.setSelectedParticipantId.mockReset()
  })

  it('opens the player menu when view-as mode is inactive', async () => {
    const user = userEvent.setup()
    render(<ViewAsPlayerButton viewAsPlayer={createViewAsParticipantCapability()} />)

    await user.click(screen.getByRole('button', { name: 'View as player' }))

    expect(await screen.findByRole('menuitemcheckbox', { name: /mina/i })).toBeVisible()
    expect(screen.getByText('@mina')).toBeVisible()
  })

  it('selects the player when the player menu row is checked', async () => {
    const user = userEvent.setup()
    render(<ViewAsPlayerButton viewAsPlayer={createViewAsParticipantCapability()} />)

    await user.click(screen.getByRole('button', { name: 'View as player' }))
    await user.click(await screen.findByRole('menuitemcheckbox', { name: /mina/i }))

    expect(viewAsState.setSelectedParticipantId).toHaveBeenCalledExactlyOnceWith(
      testId<'campaignMembers'>('player-1'),
    )
  })

  it('clears view-as mode when active', async () => {
    const user = userEvent.setup()
    viewAsState.viewAsParticipantId = testId<'campaignMembers'>('player-1')
    render(<ViewAsPlayerButton viewAsPlayer={createViewAsParticipantCapability()} />)

    await user.click(screen.getByRole('button', { name: 'View as player' }))
    await user.click(await screen.findByRole('menuitem', { name: 'Stop viewing as player' }))

    expect(viewAsState.setSelectedParticipantId).toHaveBeenCalledExactlyOnceWith(undefined)
  })

  it('opens the player menu while view-as mode is active', async () => {
    const user = userEvent.setup()
    viewAsState.viewAsParticipantId = testId<'campaignMembers'>('player-1')
    render(<ViewAsPlayerButton viewAsPlayer={createViewAsParticipantCapability()} />)

    await user.click(screen.getByRole('button', { name: 'View as player' }))

    expect(await screen.findByRole('menuitemcheckbox', { name: /mina/i })).toBeVisible()
    expect(viewAsState.setSelectedParticipantId).not.toHaveBeenCalled()
  })

  it('labels pending view-as state on the trigger', () => {
    render(
      <ViewAsPlayerButton viewAsPlayer={createViewAsParticipantCapability({ isPending: true })} />,
    )

    expect(screen.getByRole('button', { name: 'Loading players' })).toHaveAttribute(
      'aria-busy',
      'true',
    )
  })
})

function createViewAsParticipantCapability(
  overrides: Partial<AvailableViewAsParticipantCapability> = {},
): AvailableViewAsParticipantCapability {
  return {
    status: 'available',
    isPending: false,
    selectedParticipantId: viewAsState.viewAsParticipantId,
    setSelectedParticipantId: viewAsState.setSelectedParticipantId,
    participants: [
      {
        id: testId<'campaignMembers'>('player-1'),
        displayName: 'Mina',
        username: 'mina',
        imageUrl: 'https://example.com/mina.png',
      },
    ],
    ...overrides,
  }
}
