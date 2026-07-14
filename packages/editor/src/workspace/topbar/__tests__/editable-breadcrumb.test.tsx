import { testResourceId } from '../../../../../../shared/test/resource-id'
import { render, screen, waitFor } from '@testing-library/react'
import { useState } from 'react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vite-plus/test'
import { SidebarItemBreadcrumb } from '../editable-breadcrumb'
import { canonicalizeResourceItemTitle } from '../../items'
import { createFolder, createNote } from '../../../test/sidebar-item-factory'

const nameValidationState = vi.hoisted(() => ({
  hasError: false,
  validationError: null as string | null,
  validateName: vi.fn(),
}))

vi.mock('../../../filesystem/use-name-validation', () => ({
  useNameValidation: () => nameValidationState,
}))

vi.mock('sonner', () => ({
  toast: { error: vi.fn() },
}))

describe('SidebarItemBreadcrumb', () => {
  beforeEach(() => {
    nameValidationState.hasError = false
    nameValidationState.validationError = null
    nameValidationState.validateName.mockReset()
  })

  it('renders the full ancestor trail for pending items', () => {
    const grandparent = createFolder({
      id: testResourceId('folder_grandparent'),
      name: 'World',
      slug: 'world',
    })
    const parent = createFolder({
      id: testResourceId('folder_parent'),
      name: 'Places',
      slug: 'places',
      parentId: grandparent.id,
    })
    const child = createNote({
      id: testResourceId('optimistic-create-1'),
      name: 'Tavern',
      slug: 'tavern-optimistic-1',
      parentId: parent.id,
    })

    render(
      <SidebarItemBreadcrumb
        item={child}
        ancestors={[grandparent, parent]}
        canRename={false}
        onOpenAncestor={vi.fn()}
      />,
    )

    expect(screen.getByRole('button', { name: 'World' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Places' })).toBeInTheDocument()
    expect(screen.getByRole('textbox', { name: 'Item name: Tavern' })).toHaveValue('Tavern')
  })

  it('renders the root item name', () => {
    const item = createNote({
      id: testResourceId('note_root'),
      name: 'Root Note',
      slug: 'root-note',
      parentId: null,
    })

    render(<SidebarItemBreadcrumb item={item} ancestors={[]} canRename={false} />)

    expect(screen.getByRole('textbox', { name: 'Item name: Root Note' })).toHaveValue('Root Note')
  })

  it('renders the same ancestor trail for non-pending items', () => {
    const parent = createFolder({
      id: testResourceId('folder_parent'),
      name: 'Places',
      slug: 'places',
    })
    const child = createNote({
      id: testResourceId('note_child'),
      name: 'Tavern',
      slug: 'tavern',
      parentId: parent.id,
    })

    render(<SidebarItemBreadcrumb item={child} ancestors={[parent]} canRename={false} />)

    expect(screen.getByText('Places')).toBeInTheDocument()
    expect(screen.getByRole('textbox', { name: /Item name/ })).toHaveValue('Tavern')
  })

  it('uses canRename to control item name editability', () => {
    const item = createNote({ name: 'Scene' })

    const { rerender } = render(
      <SidebarItemBreadcrumb item={item} ancestors={[]} canRename={false} />,
    )

    expect(screen.getByRole('textbox', { name: /Item name/ })).toBeDisabled()

    rerender(<SidebarItemBreadcrumb item={item} ancestors={[]} canRename={true} />)

    expect(screen.getByRole('textbox', { name: /Item name/ })).toBeEnabled()
  })

  it('delegates ancestor navigation and rename to caller-owned handlers', async () => {
    const user = userEvent.setup()
    nameValidationState.validateName.mockReturnValue(undefined)
    const parent = createFolder({ name: 'Places' })
    const item = createNote({ name: 'Scene', parentId: parent.id })
    const onOpenAncestor = vi.fn()
    const onRename = vi.fn()

    render(
      <SidebarItemBreadcrumb
        item={item}
        ancestors={[parent]}
        canRename
        onOpenAncestor={onOpenAncestor}
        onRename={onRename}
      />,
    )

    await user.click(screen.getByRole('button', { name: 'Places' }))
    expect(onOpenAncestor).toHaveBeenCalledWith(parent)

    const input = screen.getByRole('textbox', { name: /Item name/ })
    await user.click(input)
    await user.clear(input)
    await user.type(input, 'New Scene')
    await user.tab()

    expect(onRename).toHaveBeenCalledWith(item, 'New Scene')
  })

  it('shows name validation errors', () => {
    nameValidationState.hasError = true
    nameValidationState.validationError = 'Title is invalid'
    const item = createNote({ name: 'Scene' })

    render(<SidebarItemBreadcrumb item={item} ancestors={[]} canRename={true} />)

    expect(screen.getByRole('textbox', { name: /Item name/ })).toHaveAttribute(
      'aria-invalid',
      'true',
    )
    expect(screen.getByText('Title is invalid')).toBeInTheDocument()
  })

  it('keeps the rename field editable after invalid blur validation', async () => {
    const user = userEvent.setup()
    nameValidationState.validateName.mockReturnValue('Title is invalid')
    const item = createNote({ name: 'Scene' })

    render(<SidebarItemBreadcrumb item={item} ancestors={[]} canRename={true} />)

    const input = screen.getByRole('textbox', { name: /Item name/ })
    await user.click(input)
    await user.clear(input)
    await user.type(input, 'Scene?')
    await user.tab()

    expect(input).toBeEnabled()

    await user.click(input)
    expect(input).toHaveFocus()
  })

  it('restores the current item name when rename is cancelled', async () => {
    const user = userEvent.setup()

    function BreadcrumbHarness() {
      const [item, setItem] = useState(createNote({ name: 'Scene' }))
      return (
        <SidebarItemBreadcrumb
          item={item}
          ancestors={[]}
          canRename={true}
          onRename={(renamedItem, name) => {
            setItem({ ...renamedItem, name: canonicalizeResourceItemTitle(name) })
          }}
        />
      )
    }

    render(<BreadcrumbHarness />)

    const input = screen.getByRole('textbox', { name: /Item name/ })
    await user.click(input)
    await user.clear(input)
    await user.type(input, 'Canceled scene')
    await user.keyboard('{Escape}')

    await waitFor(() => expect(input).toHaveValue('Scene'))
  })
})
