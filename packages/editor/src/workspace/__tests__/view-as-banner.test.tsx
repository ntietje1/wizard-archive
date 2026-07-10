import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vite-plus/test'
import { ViewAsBanner } from '../view-as-banner'
import type { EditorShareParticipant, ViewAsParticipantCapability } from '../../sharing/contracts'

describe('ViewAsBanner', () => {
  it('renders the selected player display name and exits through the runtime capability', async () => {
    const user = userEvent.setup()
    const setSelectedParticipantId = vi.fn()

    render(
      <ViewAsBanner
        viewAsPlayer={createViewAsParticipantCapability({
          selectedParticipantId: 'member-a',
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
          selectedParticipantId: 'member-a',
          participant: { id: 'member-a', displayName: '@mina', username: 'mina', imageUrl: null },
        })}
      />,
    )

    expect(screen.getByText('@mina')).toBeInTheDocument()
  })
})

function createViewAsParticipantCapability({
  selectedParticipantId,
  setSelectedParticipantId,
  participant = { id: 'member-a', displayName: 'Mina', username: 'mina', imageUrl: null },
}: {
  selectedParticipantId: string | undefined
  setSelectedParticipantId?: (playerId: string | undefined) => void
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
