import { fireEvent, render, screen } from '@testing-library/react'
import { Folder } from 'lucide-react'
import { describe, expect, it, vi } from 'vite-plus/test'
import type { SidebarItemId } from '../../../../../../../../shared/common/ids'
import { assertResourceItemName } from '../../../../items'
import { SidebarItemButtonBase } from '../sidebar-item-button-base'

const questFolderId = 'quest-folder' as SidebarItemId
const creatingQuestId = 'creating-quest' as SidebarItemId
const questNoteId = 'quest-note' as SidebarItemId

describe('SidebarItemButtonBase', () => {
  it('renders supplied name content while renaming', () => {
    render(
      <SidebarItemButtonBase
        icon={Folder}
        itemId={questFolderId}
        name={assertResourceItemName('Quests')}
        nameContent={<input aria-label="Rename item" aria-invalid="true" defaultValue="Quests" />}
        presentation={{
          visualState: { isSelected: false, isViewing: false, isMultiSelected: false },
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

  it('allows the browser context menu on the rename input', () => {
    render(
      <SidebarItemButtonBase
        icon={Folder}
        itemId={questFolderId}
        name={assertResourceItemName('Quests')}
        nameContent={<input aria-label="Rename item" defaultValue="Quests" />}
        presentation={{
          visualState: { isSelected: false, isViewing: false, isMultiSelected: false },
          renaming: true,
          expanded: false,
          showChevron: false,
        }}
      />,
    )

    const renameInput = screen.getByRole('textbox', { name: 'Rename item' })

    expect(fireEvent.contextMenu(renameInput)).toBe(true)
  })

  it('marks pending rows busy', () => {
    render(
      <SidebarItemButtonBase
        icon={Folder}
        itemId={creatingQuestId}
        name={assertResourceItemName('Creating Quest')}
        presentation={{
          visualState: { isSelected: true, isViewing: true, isMultiSelected: false },
          renaming: false,
          expanded: false,
          showChevron: false,
          pending: true,
        }}
      />,
    )

    expect(screen.getByTestId('selectable-row-creating-quest')).toHaveAttribute('aria-busy', 'true')
  })

  it('renders one icon layer for non-toggleable rows', () => {
    render(
      <SidebarItemButtonBase
        icon={Folder}
        itemId={questNoteId}
        name={assertResourceItemName('Quest Note')}
        presentation={{
          visualState: { isSelected: false, isViewing: false, isMultiSelected: false },
          renaming: false,
          expanded: false,
          showChevron: false,
        }}
      />,
    )

    expect(screen.getByTestId('selectable-row-quest-note').querySelectorAll('svg')).toHaveLength(1)
    expect(screen.queryByRole('button', { name: 'Expand folder' })).not.toBeInTheDocument()
  })

  it('marks the current non-link item on the interactive control', () => {
    render(
      <SidebarItemButtonBase
        icon={Folder}
        itemId={questFolderId}
        name={assertResourceItemName('Quests')}
        presentation={{
          visualState: { isSelected: true, isViewing: true, isMultiSelected: false },
          renaming: false,
          expanded: false,
          showChevron: false,
        }}
      />,
    )

    expect(screen.getByRole('button', { name: 'Quests' })).toHaveAttribute('aria-current', 'page')
  })

  it('runs the more-options action when a handler is supplied', () => {
    const onMoreOptions = vi.fn()
    render(
      <SidebarItemButtonBase
        icon={Folder}
        itemId={questFolderId}
        name={assertResourceItemName('Quests')}
        presentation={{
          visualState: { isSelected: false, isViewing: false, isMultiSelected: false },
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

  it('keeps row actions visible when keyboard focus enters the action group', () => {
    render(
      <SidebarItemButtonBase
        icon={Folder}
        itemId={questFolderId}
        name={assertResourceItemName('Quests')}
        presentation={{
          visualState: { isSelected: false, isViewing: false, isMultiSelected: false },
          renaming: false,
          expanded: false,
          showChevron: false,
        }}
        onMoreOptions={vi.fn()}
      />,
    )

    expect(
      screen.getByRole('button', { name: 'More options' }).parentElement?.parentElement,
    ).toHaveClass('focus-within:w-auto')
  })

  it('runs the folder chevron action when toggle behavior is supplied', () => {
    const onToggleExpanded = vi.fn()
    render(
      <SidebarItemButtonBase
        icon={Folder}
        itemId={questFolderId}
        name={assertResourceItemName('Quests')}
        presentation={{
          visualState: { isSelected: false, isViewing: false, isMultiSelected: false },
          renaming: false,
          expanded: false,
          showChevron: true,
        }}
        onToggleExpanded={onToggleExpanded}
      />,
    )

    const disclosureButton = screen.getByRole('button', { name: 'Expand folder' })
    expect(disclosureButton).toHaveAttribute('aria-expanded', 'false')

    fireEvent.click(disclosureButton)
    expect(onToggleExpanded).toHaveBeenCalledTimes(1)
  })
})
