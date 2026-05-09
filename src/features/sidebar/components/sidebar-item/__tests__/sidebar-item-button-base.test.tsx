import { render, screen } from '@testing-library/react'
import { Folder } from 'lucide-react'
import { describe, expect, it, vi } from 'vitest'
import { assertSidebarItemName } from 'convex/sidebarItems/validation/name'
import { SidebarItemButtonBase } from '../sidebar-item-button-base'

vi.mock('~/shared/hooks/useNameValidation', () => ({
  useNameValidation: () => ({
    hasError: false,
    validationError: null,
    checkNameUnique: vi.fn(),
  }),
}))

describe('SidebarItemButtonBase', () => {
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

    const chevronWrapper = screen.getByLabelText('Collapse folder').querySelector('div')

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

    expect(row).toHaveClass('w-full')
    expect(row).toHaveStyle({ paddingLeft: '20px' })
    expect(row).toHaveStyle({ paddingRight: '4px' })
  })
})
