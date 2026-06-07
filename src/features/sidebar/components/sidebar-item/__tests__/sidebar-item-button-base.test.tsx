import { render, screen } from '@testing-library/react'
import { Folder } from 'lucide-react'
import { describe, expect, it } from 'vitest'
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
})
