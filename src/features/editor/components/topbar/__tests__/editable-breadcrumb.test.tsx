import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Id } from 'convex/_generated/dataModel'
import type { ReactNode } from 'react'
import { SidebarItemBreadcrumb } from '../editable-breadcrumb'
import type { EditorLinkProps } from '~/features/sidebar/hooks/useEditorLinkProps'
import { createFolder, createNote } from '~/test/factories/sidebar-item-factory'

const nameValidationState = vi.hoisted(() => ({
  hasError: false,
  validationError: null as string | null,
  checkNameUnique: vi.fn(),
}))

interface TestLinkProps {
  to?: unknown
  params?: unknown
  search?: unknown
  children?: ReactNode
  title?: string
  className?: string
  onClick?: () => void
}

vi.mock('@tanstack/react-router', () => ({
  Link: ({ children, title, className, to, params, search, onClick }: TestLinkProps) => (
    <a
      href={`${String(to)}${params ? JSON.stringify(params) : ''}${
        search ? `?${JSON.stringify(search)}` : ''
      }`}
      title={title}
      className={className}
      onClick={onClick}
    >
      {children}
    </a>
  ),
}))

vi.mock('~/shared/hooks/useNameValidation', () => ({
  useNameValidation: () => nameValidationState,
}))

vi.mock('sonner', () => ({
  toast: { error: vi.fn() },
}))

describe('SidebarItemBreadcrumb', () => {
  beforeEach(() => {
    nameValidationState.hasError = false
    nameValidationState.validationError = null
    nameValidationState.checkNameUnique.mockReset()
  })

  it('renders the full ancestor trail for pending items', () => {
    const grandparent = createFolder({
      _id: 'folder_grandparent' as Id<'sidebarItems'>,
      name: 'World',
      slug: 'world',
    })
    const parent = createFolder({
      _id: 'folder_parent' as Id<'sidebarItems'>,
      name: 'Places',
      slug: 'places',
      parentId: grandparent._id,
    })
    const child = createNote({
      _id: 'optimistic-create-1' as Id<'sidebarItems'>,
      name: 'Tavern',
      slug: 'tavern-optimistic-1',
      parentId: parent._id,
    })

    render(
      <SidebarItemBreadcrumb
        item={child}
        ancestors={[grandparent, parent]}
        canRename={false}
        getAncestorLinkProps={(item) =>
          ({
            to: '/campaigns/$dmUsername/$campaignSlug/editor',
            params: { dmUsername: 'dm', campaignSlug: 'campaign' },
            search: { item: item.slug },
          }) as EditorLinkProps
        }
      />,
    )

    expect(screen.getByRole('link', { name: 'World' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Places' })).toBeInTheDocument()
    expect(screen.getByRole('textbox', { name: 'Item name' })).toHaveValue('Tavern')
  })

  it('renders no ancestor links for a root item', () => {
    const item = createNote({
      _id: 'note_root' as Id<'sidebarItems'>,
      name: 'Root Note',
      slug: 'root-note',
      parentId: null,
    })

    render(<SidebarItemBreadcrumb item={item} ancestors={[]} canRename={false} />)

    expect(screen.queryByRole('button', { name: 'Root Note' })).not.toBeInTheDocument()
    expect(screen.getByRole('textbox', { name: 'Item name' })).toHaveValue('Root Note')
  })

  it('renders the same ancestor trail for non-pending items', () => {
    const parent = createFolder({
      _id: 'folder_parent' as Id<'sidebarItems'>,
      name: 'Places',
      slug: 'places',
    })
    const child = createNote({
      _id: 'note_child' as Id<'sidebarItems'>,
      name: 'Tavern',
      slug: 'tavern',
      parentId: parent._id,
    })

    render(<SidebarItemBreadcrumb item={child} ancestors={[parent]} canRename={false} />)

    expect(screen.getByText('Places')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Places' })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Places' })).not.toBeInTheDocument()
    expect(screen.getByRole('textbox', { name: 'Item name' })).toHaveValue('Tavern')
  })

  it('uses canRename to control item name editability', () => {
    const item = createNote({ name: 'Scene' })

    const { rerender } = render(
      <SidebarItemBreadcrumb item={item} ancestors={[]} canRename={false} />,
    )

    expect(screen.getByRole('textbox', { name: 'Item name' })).toBeDisabled()

    rerender(<SidebarItemBreadcrumb item={item} ancestors={[]} canRename={true} />)

    expect(screen.getByRole('textbox', { name: 'Item name' })).not.toBeDisabled()
  })

  it('delegates ancestor navigation and rename to caller-owned handlers', async () => {
    const user = userEvent.setup()
    nameValidationState.checkNameUnique.mockReturnValue(undefined)
    const parent = createFolder({ name: 'Places' })
    const item = createNote({ name: 'Scene', parentId: parent._id })
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

    const input = screen.getByRole('textbox', { name: 'Item name' })
    await user.click(input)
    await user.clear(input)
    await user.type(input, 'New Scene')
    await user.tab()

    expect(onRename).toHaveBeenCalledWith(item, 'New Scene')
  })

  it('shows name validation errors', () => {
    nameValidationState.hasError = true
    nameValidationState.validationError = 'A sibling already uses this name'
    const item = createNote({ name: 'Scene' })

    render(<SidebarItemBreadcrumb item={item} ancestors={[]} canRename={true} />)

    expect(screen.getByRole('textbox', { name: 'Item name' })).toHaveAttribute(
      'aria-invalid',
      'true',
    )
    expect(screen.getByText('A sibling already uses this name')).toBeInTheDocument()
  })

  it('keeps the rename field editable after invalid blur validation', async () => {
    const user = userEvent.setup()
    nameValidationState.checkNameUnique.mockReturnValue('A sibling already uses this name')
    const item = createNote({ name: 'Scene' })

    render(<SidebarItemBreadcrumb item={item} ancestors={[]} canRename={true} />)

    const input = screen.getByRole('textbox', { name: 'Item name' })
    await user.click(input)
    await user.clear(input)
    await user.type(input, 'Scene?')
    await user.tab()

    expect(input).toBeEnabled()
    expect(input).not.toHaveClass('opacity-50')

    await user.click(input)
    expect(input).toHaveFocus()
  })
})
