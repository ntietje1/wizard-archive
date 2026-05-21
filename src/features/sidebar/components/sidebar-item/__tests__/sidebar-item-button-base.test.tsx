import { render, screen } from '@testing-library/react'
import { Folder } from 'lucide-react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { assertSidebarItemName } from 'shared/sidebar-items/name'
import { SidebarItemButtonBase } from '../sidebar-item-button-base'

const nameValidationState = vi.hoisted(() => ({
  hasError: false,
  validationError: null as string | null,
  checkNameUnique: vi.fn(),
}))

vi.mock('~/shared/hooks/useNameValidation', () => ({
  useNameValidation: () => nameValidationState,
}))

describe('SidebarItemButtonBase', () => {
  beforeEach(() => {
    nameValidationState.hasError = false
    nameValidationState.validationError = null
    nameValidationState.checkNameUnique.mockReset()
  })

  it('shows validation errors while renaming', async () => {
    nameValidationState.hasError = true
    nameValidationState.validationError = 'A sibling already uses this name'

    render(
      <SidebarItemButtonBase
        icon={Folder}
        name={assertSidebarItemName('Quests')}
        presentation={{
          visualState: { isSelected: false, isViewing: false, isMultiSelected: false },
          focused: false,
          renaming: true,
          expanded: false,
          showChevron: false,
        }}
        onFinishRename={vi.fn()}
        onCancelRename={vi.fn()}
        parentId={null}
      />,
    )

    expect(screen.getByRole('textbox')).toHaveAttribute('aria-invalid', 'true')
    expect(await screen.findByText('A sibling already uses this name')).toBeInTheDocument()
  })

  it('marks pending rows busy and hides row actions', () => {
    render(
      <SidebarItemButtonBase
        icon={Folder}
        name={assertSidebarItemName('Creating Quest')}
        presentation={{
          visualState: { isSelected: true, isViewing: true, isMultiSelected: false },
          focused: false,
          renaming: false,
          expanded: false,
          showChevron: false,
          pending: true,
        }}
        onFinishRename={vi.fn()}
        onCancelRename={vi.fn()}
        parentId={null}
      />,
    )

    expect(screen.getByRole('option')).toHaveAttribute('aria-busy', 'true')
    expect(screen.queryByRole('button', { name: 'More options' })).not.toBeInTheDocument()
  })
})
