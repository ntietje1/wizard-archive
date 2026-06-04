import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Id } from 'convex/_generated/dataModel'
import { CAMPAIGN_MEMBER_ROLE } from 'shared/campaigns/types'
import { testId } from '~/test/helpers/test-id'
import { ViewAsPlayerButton } from '../view-as-button'

const campaignState = vi.hoisted(() => ({
  isDm: true,
}))

const campaignMembersState = vi.hoisted(() => ({
  data: [
    {
      _id: 'player-1' as Id<'campaignMembers'>,
      role: 'Player',
      userProfile: { name: 'Mina', username: 'mina', imageUrl: 'https://example.com/mina.png' },
    },
  ],
  isPending: false,
}))

const editorModeState = vi.hoisted(() => ({
  viewAsPlayerId: undefined as Id<'campaignMembers'> | undefined,
  setViewAsPlayerId: vi.fn(),
}))

vi.mock('~/features/campaigns/hooks/useCampaign', () => ({
  useCampaign: () => campaignState,
}))

vi.mock('~/features/campaigns/hooks/useCampaignMembers', () => ({
  useCampaignMembers: () => campaignMembersState,
}))

vi.mock('~/features/sidebar/hooks/useEditorMode', () => ({
  useEditorMode: () => editorModeState,
}))

describe('ViewAsPlayerButton', () => {
  beforeEach(() => {
    campaignState.isDm = true
    campaignMembersState.data = [
      {
        _id: testId<'campaignMembers'>('player-1'),
        role: CAMPAIGN_MEMBER_ROLE.Player,
        userProfile: { name: 'Mina', username: 'mina', imageUrl: 'https://example.com/mina.png' },
      },
    ]
    campaignMembersState.isPending = false
    editorModeState.viewAsPlayerId = undefined
    editorModeState.setViewAsPlayerId.mockReset()
  })

  it('opens the player menu when view-as mode is inactive', async () => {
    const user = userEvent.setup()
    render(<ViewAsPlayerButton />)

    await user.click(screen.getByRole('button', { name: 'View as player' }))

    expect(await screen.findByRole('menuitemcheckbox', { name: /mina/i })).toBeVisible()
    expect(screen.getByText('@mina')).toBeVisible()
    expect(document.body.querySelector('[data-slot="avatar"]')).toBeInTheDocument()
  })

  it('clears view-as mode without opening the player menu when active', async () => {
    const user = userEvent.setup()
    editorModeState.viewAsPlayerId = testId<'campaignMembers'>('player-1')
    render(<ViewAsPlayerButton />)

    await user.click(screen.getByRole('button', { name: 'View as player' }))

    expect(editorModeState.setViewAsPlayerId).toHaveBeenCalledExactlyOnceWith(undefined)
    await waitFor(() => {
      expect(screen.queryByRole('menuitemcheckbox', { name: /mina/i })).not.toBeInTheDocument()
    })
  })
})
