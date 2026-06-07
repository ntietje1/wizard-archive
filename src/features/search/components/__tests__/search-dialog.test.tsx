import { createElement } from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ReactNode } from 'react'
import type { Id } from 'convex/_generated/dataModel'
import { SearchDialog } from '~/features/search/components/search-dialog'
import { createNote } from '~/test/factories/sidebar-item-factory'
import { buildSidebarItemMaps } from '~/features/sidebar/utils/sidebar-item-maps'
import type { AnySidebarItem } from 'shared/sidebar-items/model-types'

const searchState = vi.hoisted(() => ({
  isOpen: true,
  query: 'dragon',
  showPreview: true,
  close: vi.fn(),
  setQuery: vi.fn(),
  open: vi.fn(),
  togglePreview: vi.fn(),
}))

const searchDataState = vi.hoisted(() => ({
  items: [] as Array<AnySidebarItem>,
  bodyQuery: {
    data: undefined as undefined,
    isPending: false,
    error: null as unknown,
  },
  previewQuery: {
    data: undefined,
    isLoading: false,
    error: null as unknown,
  },
  navigateToItem: vi.fn(),
  runCreationCommand: vi.fn(),
}))

vi.mock('~/features/search/stores/search-store', () => ({
  useSearchStore: () => searchState,
}))

vi.mock('~/features/sidebar/hooks/useFilteredSidebarItems', () => ({
  useFilteredSidebarItems: () => ({
    data: searchDataState.items,
    status: 'success',
    error: null,
    refetch: vi.fn(),
    ...buildSidebarItemMaps(searchDataState.items),
  }),
}))

vi.mock('~/features/sidebar/hooks/useEditorNavigation', () => ({
  useEditorNavigation: () => ({ navigateToItem: searchDataState.navigateToItem }),
}))

vi.mock('~/features/sidebar/hooks/useSidebarItemById', () => ({
  useSidebarItemById: () => searchDataState.previewQuery,
}))

vi.mock('~/features/sidebar/hooks/useRunSidebarItemCreationCommand', () => ({
  useRunSidebarItemCreationCommand: () => ({
    runCreationCommand: searchDataState.runCreationCommand,
  }),
}))

vi.mock('~/shared/hooks/useCampaignQuery', () => ({
  useCampaignQuery: () => searchDataState.bodyQuery,
}))

vi.mock('~/shared/hooks/useDebouncedValue', () => ({
  useDebouncedValue: (value: string) => value,
}))

vi.mock('~/features/search/hooks/use-recent-items', () => ({
  useRecentItems: () => [],
}))

vi.mock('~/features/previews/components/sidebar-item-preview-content', () => ({
  SidebarItemPreviewContent: () => createElement('div', null, 'Preview content'),
}))

vi.mock('~/features/shadcn/components/dialog', () => ({
  Dialog: ({ open, children }: { open: boolean; children: ReactNode }) =>
    open ? createElement('div', null, children) : null,
  DialogContent: ({
    children,
    ...props
  }: {
    children: ReactNode
    onKeyDown?: React.KeyboardEventHandler<HTMLDivElement>
  }) => createElement('div', props, children),
  DialogDescription: ({ children }: { children: ReactNode }) => createElement('p', null, children),
  DialogHeader: ({ children }: { children: ReactNode }) => createElement('div', null, children),
  DialogTitle: ({ children }: { children: ReactNode }) => createElement('h2', null, children),
}))

vi.mock('~/features/shadcn/components/scroll-area', () => ({
  ScrollArea: ({ children }: { children: ReactNode }) => createElement('div', null, children),
}))

vi.mock('~/features/shadcn/components/separator', () => ({
  Separator: () => createElement('hr'),
}))

describe('SearchDialog', () => {
  beforeEach(() => {
    Element.prototype.scrollIntoView = vi.fn()
    searchState.isOpen = true
    searchState.query = 'dragon'
    searchState.showPreview = true
    searchState.close.mockReset()
    searchState.setQuery.mockReset()
    searchState.open.mockReset()
    searchState.togglePreview.mockReset()
    searchDataState.items = []
    searchDataState.bodyQuery = { data: undefined, isPending: false, error: null }
    searchDataState.previewQuery = { data: undefined, isLoading: false, error: null }
    searchDataState.navigateToItem.mockReset()
    searchDataState.runCreationCommand.mockReset()
  })

  it('shows matching creation commands from the command catalog', () => {
    searchState.query = 'new note'

    render(<SearchDialog />)

    expect(screen.getByRole('button', { name: /New Note/i })).toBeInTheDocument()
    expect(screen.getAllByText('Create at top level')).toHaveLength(2)
  })

  it('runs a selected creation command from the keyboard launcher', async () => {
    const user = userEvent.setup()
    searchState.query = 'note'
    searchDataState.runCreationCommand.mockResolvedValue({ id: 'note_1', slug: 'new-note' })

    render(<SearchDialog />)

    await user.keyboard('{Enter}')

    expect(searchDataState.runCreationCommand).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'create.note' }),
      { parentId: null },
    )
    expect(searchState.close).toHaveBeenCalled()
  })

  it('ignores repeated creation command activation while the command is pending', async () => {
    const user = userEvent.setup()
    searchState.query = 'note'
    searchDataState.runCreationCommand.mockReturnValue(new Promise(() => {}))

    render(<SearchDialog />)

    await user.keyboard('{Enter}{Enter}')
    await user.click(screen.getByRole('button', { name: /New Note/i }))

    expect(searchDataState.runCreationCommand).toHaveBeenCalledTimes(1)
  })

  it('allows retrying a creation command after an unexpected command failure', async () => {
    const user = userEvent.setup()
    searchState.query = 'note'
    searchDataState.runCreationCommand
      .mockRejectedValueOnce(new Error('failed'))
      .mockResolvedValueOnce({ id: 'note_1', slug: 'new-note' })

    render(<SearchDialog />)

    await user.keyboard('{Enter}')
    await waitFor(() => expect(searchDataState.runCreationCommand).toHaveBeenCalledTimes(1))

    await user.keyboard('{Enter}')

    await waitFor(() => expect(searchDataState.runCreationCommand).toHaveBeenCalledTimes(2))
    expect(searchState.close).toHaveBeenCalled()
  })

  it('still reports body-search failure when command rows match the query', () => {
    searchState.query = 'note'
    searchDataState.bodyQuery.error = new Error('body failed')

    render(<SearchDialog />)

    expect(screen.getByRole('button', { name: /New Note/i })).toBeInTheDocument()
    expect(screen.getByText('Body search failed')).toBeInTheDocument()
  })

  it('shows body-search failure instead of no results when body search fails', () => {
    searchDataState.bodyQuery.error = new Error('body failed')

    render(<SearchDialog />)

    expect(screen.getByText('Body search failed')).toBeInTheDocument()
    expect(screen.queryByText('No results found')).not.toBeInTheDocument()
  })

  it('keeps title matches visible when body search fails', () => {
    searchDataState.items = [
      createNote({
        _id: 'note_1' as Id<'sidebarItems'>,
        name: 'Dragon notes',
        slug: 'dragon-notes',
      }),
    ]
    searchDataState.bodyQuery.error = new Error('body failed')

    render(<SearchDialog />)

    expect(screen.getByText('Dragon notes')).toBeInTheDocument()
    expect(screen.getByText('Body search failed. Showing title matches only.')).toBeInTheDocument()
  })

  it('keeps a result openable when preview lookup fails', () => {
    const note = createNote({
      _id: 'note_1' as Id<'sidebarItems'>,
      name: 'Dragon notes',
      slug: 'dragon-notes',
    })
    searchDataState.items = [note]
    searchDataState.previewQuery.error = new Error('preview failed')

    render(<SearchDialog />)

    expect(
      screen.getByText('Failed to load preview. You can still open this result.'),
    ).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Open result' }))

    expect(searchDataState.navigateToItem).toHaveBeenCalledWith(note.slug)
  })
})
