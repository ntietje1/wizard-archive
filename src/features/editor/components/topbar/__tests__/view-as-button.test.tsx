import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Id } from 'convex/_generated/dataModel'
import { CAMPAIGN_MEMBER_ROLE, CAMPAIGN_MEMBER_STATUS } from 'shared/campaigns/types'
import { assertUsername } from 'shared/users/validation'
import { testId } from '~/test/helpers/test-id'
import { ViewAsPlayerButton } from '../view-as-button'
import type { EditorWorkspaceViewAsPlayerChrome } from '../../../workspace/editor-workspace-chrome'

const editorModeState = vi.hoisted(() => ({
  viewAsPlayerId: undefined as Id<'campaignMembers'> | undefined,
  setViewAsPlayerId: vi.fn(),
}))

describe('ViewAsPlayerButton', () => {
  beforeEach(() => {
    editorModeState.viewAsPlayerId = undefined
    editorModeState.setViewAsPlayerId.mockReset()
  })

  it('opens the player menu when view-as mode is inactive', async () => {
    const user = userEvent.setup()
    render(<ViewAsPlayerButton viewAsPlayer={createViewAsPlayerChrome()} />)

    await user.click(screen.getByRole('button', { name: 'View as player' }))

    expect(await screen.findByRole('menuitemcheckbox', { name: /mina/i })).toBeVisible()
    expect(screen.getByText('@mina')).toBeVisible()
    expect(document.body.querySelector('[data-slot="avatar"]')).toBeInTheDocument()
  })

  it('clears view-as mode without opening the player menu when active', async () => {
    const user = userEvent.setup()
    editorModeState.viewAsPlayerId = testId<'campaignMembers'>('player-1')
    render(<ViewAsPlayerButton viewAsPlayer={createViewAsPlayerChrome()} />)

    await user.click(screen.getByRole('button', { name: 'View as player' }))

    expect(editorModeState.setViewAsPlayerId).toHaveBeenCalledExactlyOnceWith(undefined)
    await waitFor(() => {
      expect(screen.queryByRole('menuitemcheckbox', { name: /mina/i })).not.toBeInTheDocument()
    })
  })
})

function createViewAsPlayerChrome(): EditorWorkspaceViewAsPlayerChrome {
  return {
    visible: true,
    isPending: false,
    selectedPlayerId: editorModeState.viewAsPlayerId,
    setSelectedPlayerId: editorModeState.setViewAsPlayerId,
    playerMembers: [
      {
        _id: testId<'campaignMembers'>('player-1'),
        _creationTime: 1,
        userId: testId<'userProfiles'>('user-1'),
        campaignId: testId<'campaigns'>('campaign-1'),
        role: CAMPAIGN_MEMBER_ROLE.Player,
        status: CAMPAIGN_MEMBER_STATUS.Accepted,
        userProfile: {
          name: 'Mina',
          username: assertUsername('mina'),
          imageUrl: 'https://example.com/mina.png',
        },
      },
    ],
  }
}
