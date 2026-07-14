import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vite-plus/test'
import { ViewAsBanner } from '../view-as-banner'
import type {
  EditorShareParticipant,
  EditorShareParticipantId,
  ViewAsParticipantCapability,
} from '../../sharing/contracts'
import { DOMAIN_ID_KIND } from '../../resources/domain-id'
import { testDomainId } from '../../test/domain-id'

const MEMBER_ID = testDomainId(DOMAIN_ID_KIND.campaignMember, 'view_as_banner_member')

describe('ViewAsBanner', () => {
  it('renders the selected player display name and exits through the runtime capability', async () => {
    const user = userEvent.setup()
    const setSelectedParticipantId = vi.fn()

    render(
      <ViewAsBanner
        viewAsPlayer={createViewAsParticipantCapability({
          selectedParticipantId: MEMBER_ID,
          setSelectedParticipantId,
        })}
      />,
    )

    expect(screen.getByText('Viewing as')).toBeInTheDocument()
    expect(screen.getByText('Mina')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /exit/i }))

    expect(setSelectedParticipantId).toHaveBeenCalledExactlyOnceWith(undefined)
  })

  it('uses the shared username fallback when the selected player has no display name', () => {
    render(
      <ViewAsBanner
        viewAsPlayer={createViewAsParticipantCapability({
          selectedParticipantId: MEMBER_ID,
          participant: { id: MEMBER_ID, displayName: '', username: 'mina', imageUrl: null },
        })}
      />,
    )

    expect(screen.getByText('@mina')).toBeInTheDocument()
  })
})

function createViewAsParticipantCapability({
  selectedParticipantId,
  setSelectedParticipantId,
  participant = { id: MEMBER_ID, displayName: 'Mina', username: 'mina', imageUrl: null },
}: {
  selectedParticipantId: EditorShareParticipantId | undefined
  setSelectedParticipantId?: (playerId: EditorShareParticipantId | undefined) => void
  participant?: EditorShareParticipant
}): ViewAsParticipantCapability {
  return {
    status: 'available',
    isPending: false,
    selectedParticipantId,
    setSelectedParticipantId: setSelectedParticipantId ?? vi.fn(),
    participants: [participant],
  }
}
