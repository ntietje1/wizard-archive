import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vite-plus/test'
import { testDomainId } from '../../../../../shared/test/domain-id'
import type { EditorRuntime } from '../editor-runtime-contract'
import { ResourceViewAsBanner } from '../workspace/resource-view-as-banner'
import { ResourceViewAsMenu } from '../resource-view-as-menu'

const participantId = testDomainId('campaignMember', 'view-as-ui')
const participant = {
  id: participantId,
  displayName: 'Avery Player',
  username: 'avery',
  imageUrl: null,
}

describe('resource view-as controls', () => {
  it('selects a player from the restored topbar menu', async () => {
    const user = userEvent.setup()
    const select = vi.fn()
    const viewAs: EditorRuntime['viewAs'] = {
      status: 'available',
      value: {
        pending: false,
        participants: [participant],
        selectedParticipantId: null,
        select,
      },
    }

    render(
      <ResourceViewAsMenu
        mode="editor"
        participants={viewAs.value.participants}
        projection="dm"
        selectedParticipantId={viewAs.value.selectedParticipantId}
        onModeChange={vi.fn()}
        onParticipantChange={select}
      />,
    )
    const trigger = screen.getByRole('button', { name: 'View as...' })
    trigger.focus()
    await user.keyboard('{ArrowDown}')
    await user.click(await screen.findByRole('menuitemcheckbox', { name: /Avery Player/ }))

    expect(select).toHaveBeenCalledWith(participantId)
  })

  it('clears an active player projection from the menu', async () => {
    const user = userEvent.setup()
    const select = vi.fn()
    render(
      <ResourceViewAsMenu
        mode="editor"
        participants={[participant]}
        projection="view_as_player"
        selectedParticipantId={participantId}
        onModeChange={vi.fn()}
        onParticipantChange={select}
      />,
    )

    await user.click(screen.getByRole('button', { name: 'Exit view as' }))

    expect(select).toHaveBeenCalledExactlyOnceWith(null)
  })

  it('disables and labels the trigger while the participant list is pending', () => {
    render(<ResourceViewAsMenu mode="editor" pending projection="dm" onModeChange={vi.fn()} />)

    expect(screen.getByRole('button', { name: 'Loading players' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Loading players' })).toHaveAttribute(
      'aria-busy',
      'true',
    )
  })

  it('offers a read-only self projection and exits it directly', async () => {
    const user = userEvent.setup()
    const onModeChange = vi.fn()
    const view = render(
      <ResourceViewAsMenu mode="editor" projection="dm" onModeChange={onModeChange} />,
    )

    await user.click(screen.getByRole('button', { name: 'View as...' }))
    await user.click(await screen.findByRole('menuitem', { name: 'View as yourself' }))
    expect(onModeChange).toHaveBeenCalledWith('viewer')

    view.rerender(<ResourceViewAsMenu mode="viewer" projection="dm" onModeChange={onModeChange} />)
    await user.click(screen.getByRole('button', { name: 'Exit view as' }))
    view.rerender(<ResourceViewAsMenu mode="editor" projection="dm" onModeChange={onModeChange} />)

    expect(onModeChange).toHaveBeenLastCalledWith('editor')
    expect(screen.queryByRole('menu', { name: 'View as...' })).not.toBeInTheDocument()
  })

  it('identifies the active player and exits from the bottom banner', async () => {
    const user = userEvent.setup()
    const select = vi.fn()
    const viewAs: EditorRuntime['viewAs'] = {
      status: 'available',
      value: {
        pending: false,
        participants: [participant],
        selectedParticipantId: participantId,
        select,
      },
    }

    render(<ResourceViewAsBanner viewAs={viewAs} />)

    expect(screen.getByRole('status')).toHaveTextContent('Viewing as Avery Player')
    await user.click(screen.getByRole('button', { name: 'Exit' }))
    expect(select).toHaveBeenCalledWith(null)
  })

  it('uses the username fallback from the canonical participant projection', () => {
    render(
      <ResourceViewAsBanner
        viewAs={availableViewAs({
          participants: [{ ...participant, displayName: '@avery' }],
          selectedParticipantId: participantId,
        })}
      />,
    )

    expect(screen.getByRole('status')).toHaveTextContent('Viewing as @avery')
  })
})

function availableViewAs(
  overrides: Partial<Extract<EditorRuntime['viewAs'], { status: 'available' }>['value']> = {},
): Extract<EditorRuntime['viewAs'], { status: 'available' }> {
  return {
    status: 'available',
    value: {
      pending: false,
      participants: [participant],
      selectedParticipantId: null,
      select: vi.fn(),
      ...overrides,
    },
  }
}
