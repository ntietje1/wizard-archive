import { fireEvent, render, screen } from '@testing-library/react'
import { Folder } from 'lucide-react'
import { describe, expect, it, vi } from 'vitest'
import { assertSidebarItemName } from 'shared/sidebar-items/name'
import { SidebarItemButtonBase } from '../sidebar-item-button-base'

describe('SidebarItemButtonBase', () => {
  it('renders supplied name content while renaming', () => {
    render(
      <SidebarItemButtonBase
        icon={Folder}
        name={assertSidebarItemName('Quests')}
        nameContent={<input aria-label="Rename item" aria-invalid="true" defaultValue="Quests" />}
        presentation={{
          visualState: { isSelected: false, isViewing: false, isMultiSelected: false },
          focused: false,
          renaming: true,
          expanded: false,
          showChevron: false,
        }}
      />,
    )

    expect(screen.getByRole('textbox', { name: 'Rename item' })).toHaveAttribute(
      'aria-invalid',
      'true',
    )
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
      />,
    )

    expect(screen.getByTestId('selectable-row-Creating Quest')).toHaveAttribute('aria-busy', 'true')
    expect(screen.queryByRole('button', { name: 'More options' })).not.toBeInTheDocument()
  })

  it('marks the current non-link item on the interactive control', () => {
    render(
      <SidebarItemButtonBase
        icon={Folder}
        name={assertSidebarItemName('Quests')}
        presentation={{
          visualState: { isSelected: true, isViewing: true, isMultiSelected: false },
          focused: false,
          renaming: false,
          expanded: false,
          showChevron: false,
        }}
      />,
    )

    expect(screen.getByRole('button', { name: 'Quests' })).toHaveAttribute('aria-current', 'page')
  })

  it('only renders the more-options action when a handler is supplied', () => {
    const onMoreOptions = vi.fn()
    const { rerender } = render(
      <SidebarItemButtonBase
        icon={Folder}
        name={assertSidebarItemName('Quests')}
        presentation={{
          visualState: { isSelected: false, isViewing: false, isMultiSelected: false },
          focused: false,
          renaming: false,
          expanded: false,
          showChevron: false,
        }}
      />,
    )

    expect(screen.queryByRole('button', { name: 'More options' })).not.toBeInTheDocument()

    rerender(
      <SidebarItemButtonBase
        icon={Folder}
        name={assertSidebarItemName('Quests')}
        presentation={{
          visualState: { isSelected: false, isViewing: false, isMultiSelected: false },
          focused: false,
          renaming: false,
          expanded: false,
          showChevron: false,
        }}
        onMoreOptions={onMoreOptions}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'More options' }))
    expect(onMoreOptions).toHaveBeenCalledTimes(1)
  })

  it('only renders the folder chevron when toggle behavior is supplied', () => {
    const onToggleExpanded = vi.fn()
    const { rerender } = render(
      <SidebarItemButtonBase
        icon={Folder}
        name={assertSidebarItemName('Quests')}
        presentation={{
          visualState: { isSelected: false, isViewing: false, isMultiSelected: false },
          focused: false,
          renaming: false,
          expanded: false,
          showChevron: true,
        }}
      />,
    )

    expect(screen.queryByRole('button', { name: 'Expand folder' })).not.toBeInTheDocument()

    rerender(
      <SidebarItemButtonBase
        icon={Folder}
        name={assertSidebarItemName('Quests')}
        presentation={{
          visualState: { isSelected: false, isViewing: false, isMultiSelected: false },
          focused: false,
          renaming: false,
          expanded: false,
          showChevron: true,
        }}
        onToggleExpanded={onToggleExpanded}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Expand folder' }))
    expect(onToggleExpanded).toHaveBeenCalledTimes(1)
  })
})
