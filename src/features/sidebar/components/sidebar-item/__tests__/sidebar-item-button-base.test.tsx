import { render, screen } from '@testing-library/react'
import { Folder } from 'lucide-react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { assertSidebarItemName } from 'convex/sidebarItems/validation/name'
import { SidebarItemButtonBase } from '../sidebar-item-button-base'
import { sidebarItemRowPaddingStyle } from '../sidebar-item-layout'

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

  it('rotates the chevron without transition classes', () => {
    render(
      <SidebarItemButtonBase
        icon={Folder}
        name={assertSidebarItemName('Quests')}
        presentation={{
          visualState: { isSelected: false, isViewing: false, isMultiSelected: false },
          focused: false,
          renaming: false,
          expanded: true,
          showChevron: true,
        }}
        onFinishRename={vi.fn()}
        onCancelRename={vi.fn()}
        parentId={null}
      />,
    )

    const chevronWrapper = screen.getByTestId('chevron-wrapper')

    expect(chevronWrapper).toHaveClass('rotate-90')
    expect(chevronWrapper).not.toHaveClass('transition-transform')
    expect(chevronWrapper).not.toHaveClass('duration-100')
    expect(chevronWrapper).not.toHaveClass('ease-out')
  })

  it('indents content while keeping the row itself full width', () => {
    render(
      <SidebarItemButtonBase
        icon={Folder}
        name={assertSidebarItemName('Nested Quests')}
        presentation={{
          visualState: { isSelected: false, isViewing: false, isMultiSelected: false },
          focused: false,
          renaming: false,
          expanded: false,
          showChevron: true,
          indentLevel: 1,
        }}
        onFinishRename={vi.fn()}
        onCancelRename={vi.fn()}
        parentId={null}
      />,
    )

    const row = screen.getByRole('option')
    const expectedPadding = sidebarItemRowPaddingStyle(1)

    expect(row).toHaveClass('w-full')
    expect(row).toHaveStyle(expectedPadding)
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
})
