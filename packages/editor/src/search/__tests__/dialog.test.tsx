import { createElement, createRef } from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test'
import type { ReactNode } from 'react'
import type { SidebarItemId } from '../../../../../shared/common/ids'
import { SearchDialog } from '../dialog'
import { useSearchDialogController } from '../dialog-controller'
import type {
  SearchDialogActions,
  SearchDialogController,
  SearchDialogRequestState,
} from '../dialog-controller'
import { createFolder, createNote } from '../../test/sidebar-item-factory'
import { createWorkspaceResource } from '../../workspace/runtime'
import type { AnyItem, AnyItemWithContent } from '../../workspace/items'
import { buildItemSearchResults } from '../model'
import { WorkspaceContextMenuModelSourceProvider } from '../../workspace/context-menu-model-source'
import type { BuiltContextMenu, ResolvedContextMenuItem } from '../../context-menu/types'
import type { ContextMenuHostRef } from '../../context-menu/components/host'
import { standaloneEmbeddedNoteContentSource } from '../../notes/standalone-note-content-sources'
import type { ResourceContentState } from '../../filesystem/resource-content-source'

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
  items: [] as Array<AnyItem>,
  bodyQuery: {
    data: undefined as undefined,
    isPending: false,
    error: null as unknown,
  },
  previewQuery: {
    data: undefined as unknown,
    isLoading: false,
    error: null as unknown,
  },
  openItem: vi.fn(),
  createSidebarItem: vi.fn(),
}))
const previewSurfaceSpy = vi.hoisted(() => vi.fn())
const toastErrorSpy = vi.hoisted(() => vi.fn())
const dialogOpenChangeSpy = vi.hoisted(() => vi.fn())
const originalScrollIntoView = Element.prototype.scrollIntoView?.bind(Element.prototype)

vi.mock('../../previews/resource-preview-surface', () => ({
  ResourcePreviewSurface: (props: unknown) => {
    previewSurfaceSpy(props)
    return createElement('div', null, 'Preview content')
  },
}))

vi.mock('sonner', () => ({
  toast: {
    error: toastErrorSpy,
  },
}))

vi.mock('@wizard-archive/ui/shadcn/components/dialog', () => ({
  Dialog: ({
    open,
    children,
    onOpenChange,
  }: {
    open: boolean
    children: ReactNode
    onOpenChange: (open: boolean) => void
  }) => {
    dialogOpenChangeSpy(onOpenChange)
    return open ? createElement('div', null, children) : null
  },
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

vi.mock('@wizard-archive/ui/shadcn/components/scroll-area', () => ({
  ScrollArea: ({ children }: { children: ReactNode }) => createElement('div', null, children),
}))

vi.mock('@wizard-archive/ui/shadcn/components/separator', () => ({
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
    searchDataState.openItem.mockReset()
    searchDataState.createSidebarItem.mockReset()
    previewSurfaceSpy.mockReset()
    toastErrorSpy.mockReset()
    dialogOpenChangeSpy.mockReset()
  })

  afterEach(() => {
    vi.restoreAllMocks()
    Element.prototype.scrollIntoView = originalScrollIntoView
  })

  it('closes through the dialog open-state callback', () => {
    renderSearchDialog()

    const handleOpenChange = dialogOpenChangeSpy.mock.lastCall?.[0]
    handleOpenChange(false)

    expect(searchState.close).toHaveBeenCalledOnce()
  })

  it('shows matching creation commands from the command catalog', () => {
    searchState.query = 'new note'

    renderSearchDialog()

    expect(screen.getByRole('option', { name: /New Note/i })).toHaveAttribute(
      'aria-selected',
      'true',
    )
    expect(screen.getByRole('listbox', { name: 'Search results' })).toBeInTheDocument()
    expect(screen.getAllByText('Create at top level')).toHaveLength(2)
  })

  it('exposes preview toggle state to assistive technology', () => {
    renderSearchDialog()

    expect(screen.getByRole('button', { name: 'Toggle preview' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
  })

  it('runs a selected creation command from the keyboard launcher', async () => {
    const user = userEvent.setup()
    searchState.query = 'note'
    searchDataState.createSidebarItem.mockResolvedValue({
      status: 'completed',
      id: 'note_1',
      slug: 'new-note',
    })

    renderSearchDialog()

    await user.keyboard('{Enter}')

    expect(searchDataState.createSidebarItem).toHaveBeenCalledWith({
      name: 'Untitled Note',
      parentId: null,
      type: expect.any(String),
    })
    expect(searchState.close).toHaveBeenCalled()
  })

  it('ignores repeated creation command activation while the command is pending', async () => {
    const user = userEvent.setup()
    searchState.query = 'note'
    searchDataState.createSidebarItem.mockReturnValue(new Promise(() => {}))

    renderSearchDialog()

    await user.keyboard('{Enter}{Enter}')
    await user.click(screen.getByRole('option', { name: /New Note/i }))

    expect(searchDataState.createSidebarItem).toHaveBeenCalledTimes(1)
  })

  it('ignores repeated item activation while open is pending', async () => {
    const user = userEvent.setup()
    const note = createNote({
      id: 'note_1' as SidebarItemId,
      name: 'Dragon notes',
      slug: 'dragon-notes',
    })
    searchDataState.items = [note]
    searchDataState.openItem.mockReturnValue(new Promise(() => {}))

    renderSearchDialog()

    await user.keyboard('{Enter}{Enter}')
    const resultRow = document.getElementById('search-result-0')
    if (!resultRow) throw new Error('Expected search result row')
    await user.click(resultRow)

    expect(searchDataState.openItem).toHaveBeenCalledTimes(1)
  })

  it('allows retrying item activation after an open failure', async () => {
    const user = userEvent.setup()
    const note = createNote({
      id: 'note_1' as SidebarItemId,
      name: 'Dragon notes',
      slug: 'dragon-notes',
    })
    searchDataState.items = [note]
    searchDataState.openItem
      .mockRejectedValueOnce(new Error('failed'))
      .mockResolvedValueOnce(undefined)
    vi.spyOn(console, 'error').mockImplementation(() => {})

    renderSearchDialog()

    await user.keyboard('{Enter}')
    await waitFor(() => expect(searchDataState.openItem).toHaveBeenCalledTimes(1))

    await user.keyboard('{Enter}')

    await waitFor(() => expect(searchDataState.openItem).toHaveBeenCalledTimes(2))
    expect(searchState.close).toHaveBeenCalled()
  })

  it('allows retrying a creation command after an unexpected command failure', async () => {
    const user = userEvent.setup()
    searchState.query = 'note'
    searchDataState.createSidebarItem
      .mockRejectedValueOnce(new Error('failed'))
      .mockResolvedValueOnce({ status: 'completed', id: 'note_1', slug: 'new-note' })

    renderSearchDialog()

    await user.keyboard('{Enter}')
    await waitFor(() => expect(searchDataState.createSidebarItem).toHaveBeenCalledTimes(1))

    await user.keyboard('{Enter}')

    await waitFor(() => expect(searchDataState.createSidebarItem).toHaveBeenCalledTimes(2))
    expect(searchState.close).toHaveBeenCalled()
  })

  it('still reports body-search failure when command rows match the query', () => {
    searchState.query = 'note'
    searchDataState.bodyQuery.error = new Error('body failed')

    renderSearchDialog()

    expect(screen.getByRole('option', { name: /New Note/i })).toBeInTheDocument()
    expect(screen.getByText('Body search failed')).toBeInTheDocument()
  })

  it('shows body-search failure instead of no results when body search fails', () => {
    searchDataState.bodyQuery.error = new Error('body failed')

    renderSearchDialog()

    expect(screen.getByText('Body search failed')).toBeInTheDocument()
  })

  it('keeps title matches visible when body search fails', () => {
    searchDataState.items = [
      createNote({
        id: 'note_1' as SidebarItemId,
        name: 'Dragon notes',
        slug: 'dragon-notes',
      }),
    ]
    searchDataState.bodyQuery.error = new Error('body failed')

    renderSearchDialog()

    expect(screen.getByText('Dragon notes')).toBeInTheDocument()
    expect(screen.getByText('Body search failed. Showing title matches only.')).toBeInTheDocument()
  })

  it('clamps the selected result when the result list shrinks without a query change', async () => {
    const user = userEvent.setup()
    const firstNote = createNote({
      id: 'note_1' as SidebarItemId,
      name: 'Dragon Alpha',
      slug: 'dragon-alpha',
    })
    searchDataState.items = [
      firstNote,
      createNote({
        id: 'note_2' as SidebarItemId,
        name: 'Dragon Beta',
        slug: 'dragon-beta',
      }),
    ]
    const { rerender } = renderSearchDialog()

    await user.keyboard('{ArrowDown}')
    expect(screen.getByRole('combobox', { name: 'Search' })).toHaveAttribute(
      'aria-activedescendant',
      'search-result-1',
    )

    searchDataState.items = [firstNote]
    rerender(<TestSearchDialog menu={emptyContextMenu} />)

    await waitFor(() =>
      expect(screen.getByRole('combobox', { name: 'Search' })).toHaveAttribute(
        'aria-activedescendant',
        'search-result-0',
      ),
    )
  })

  it('opens a sidebar-item context menu from search results', async () => {
    const note = createNote({
      id: 'note_1' as SidebarItemId,
      name: 'Dragon notes',
      slug: 'dragon-notes',
    })
    searchDataState.items = [note]

    renderSearchDialog(showInSidebarMenu)

    const resultRow = document.getElementById('search-result-0')
    if (!resultRow) throw new Error('Expected search result row')

    fireEvent.contextMenu(resultRow)

    expect(await screen.findByText('Show in Sidebar')).toBeInTheDocument()
  })

  it('opens a sidebar-item context menu from the preview header', async () => {
    const note = createNote({
      id: 'note_1' as SidebarItemId,
      name: 'Dragon notes',
      slug: 'dragon-notes',
    })
    searchDataState.items = [note]

    renderSearchDialog(showInSidebarMenu)

    fireEvent.contextMenu(screen.getByText('Dragon notes'))

    expect(await screen.findByText('Show in Sidebar')).toBeInTheDocument()
  })

  it('keeps a result openable when preview lookup fails', () => {
    const note = createNote({
      id: 'note_1' as SidebarItemId,
      name: 'Dragon notes',
      slug: 'dragon-notes',
    })
    searchDataState.items = [note]
    searchDataState.previewQuery.error = new Error('preview failed')

    renderSearchDialog()

    expect(
      screen.getByText('Failed to load preview. You can still open this result.'),
    ).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Open result' }))

    expect(searchDataState.openItem).toHaveBeenCalledWith(createWorkspaceResource(note.id))
  })

  it('reports item-open failures without dismissing the current result', async () => {
    const user = userEvent.setup()
    const note = createNote({
      id: 'note_1' as SidebarItemId,
      name: 'Dragon notes',
      slug: 'dragon-notes',
    })
    searchDataState.items = [note]
    searchDataState.openItem.mockRejectedValue(new Error('open failed'))
    vi.spyOn(console, 'error').mockImplementation(() => {})

    renderSearchDialog()

    await user.keyboard('{Enter}')

    await waitFor(() => expect(toastErrorSpy).toHaveBeenCalledWith('Failed to open item'))
    expect(screen.getByText('Dragon notes')).toBeInTheDocument()
  })

  it('shows unavailable-preview copy when a selected result has no previewable content', () => {
    const note = createNote({
      id: 'note_1' as SidebarItemId,
      name: 'Dragon notes',
      slug: 'dragon-notes',
    })
    const selectedResult = buildItemSearchResults({
      bodyResults: undefined,
      getBreadcrumb: () => '',
      items: [note],
      query: 'dragon',
    })[0]
    if (!selectedResult) throw new Error('Expected search result')
    const controller: SearchDialogController = {
      close: vi.fn(),
      displayItems: [{ kind: 'item', result: selectedResult }],
      emptyStateMessage: undefined,
      handleKeyDown: vi.fn(),
      handleOpenChange: vi.fn(),
      hasQuery: true,
      inlineStatusMessage: undefined,
      isOpen: true,
      openResult: vi.fn(),
      query: 'dragon',
      searchQuery: 'dragon',
      selectedIndex: 0,
      selectedItemRef: createRef<HTMLDivElement>(),
      selectedResult,
      selectDisplayItem: vi.fn(),
      setQuery: vi.fn(),
      setSelectedIndex: vi.fn(),
      showPreview: true,
      status: '1 result',
      togglePreview: vi.fn(),
    }
    const previewState: ResourceContentState = {
      status: 'not_found',
      label: 'Dragon notes',
      error: null,
      folderChildren: [],
      isLoading: false,
      item: undefined,
    }

    renderSearchDialogWithController(controller, previewState)

    expect(screen.getByText('No preview available')).toBeInTheDocument()
  })

  it('passes filtered folder children to folder previews without a workspace runtime provider', () => {
    const folder = createFolder({
      id: 'folder_1' as SidebarItemId,
      name: 'Dragon Folder',
      slug: 'dragon-folder',
    })
    const child = createNote({
      id: 'note_1' as SidebarItemId,
      name: 'Child Note',
      parentId: folder.id,
    })
    searchDataState.items = [folder, child]
    searchDataState.previewQuery = {
      data: { ...folder, ancestors: [] },
      isLoading: false,
      error: null,
    }

    renderSearchDialog()

    expect(screen.getByText('Preview content')).toBeInTheDocument()
    expect(previewSurfaceSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        item: { ...folder, ancestors: [] },
        folderChildren: [child],
      }),
    )
  })
})

function renderSearchDialog(menu: BuiltContextMenu = emptyContextMenu) {
  return render(<TestSearchDialog menu={menu} />)
}

function renderSearchDialogWithController(
  controller: SearchDialogController,
  previewState: ResourceContentState,
  menu: BuiltContextMenu = emptyContextMenu,
) {
  return render(
    <WorkspaceContextMenuModelSourceProvider
      source={({ children }) =>
        createElement(
          'div',
          null,
          children({
            surfaceModel: {
              hostRef: createRef<ContextMenuHostRef>(),
              menu,
            },
          }),
        )
      }
    >
      <SearchDialog
        controller={controller}
        embeddedNoteContentSource={standaloneEmbeddedNoteContentSource}
        previewState={previewState}
      />
    </WorkspaceContextMenuModelSourceProvider>,
  )
}

function TestSearchDialog({ menu }: { menu: BuiltContextMenu }) {
  const request = getTestSearchDialogRequestState()
  const dialogSearchState = getSearchState(request.debouncedQuery)
  const controller = useSearchDialogController({
    actions: createSearchActions(),
    request,
    searchState: dialogSearchState,
  })
  const previewState = getPreviewState(controller.selectedResult?.item.id)

  return (
    <WorkspaceContextMenuModelSourceProvider
      source={({ children }) =>
        createElement(
          'div',
          null,
          children({
            surfaceModel: {
              hostRef: createRef<ContextMenuHostRef>(),
              menu,
            },
          }),
        )
      }
    >
      <SearchDialog
        controller={controller}
        embeddedNoteContentSource={standaloneEmbeddedNoteContentSource}
        previewState={previewState}
      />
    </WorkspaceContextMenuModelSourceProvider>
  )
}

function getTestSearchDialogRequestState(): SearchDialogRequestState {
  return {
    close: searchState.close,
    debouncedQuery: searchState.query,
    isOpen: searchState.isOpen,
    open: searchState.open,
    query: searchState.query,
    setQuery: searchState.setQuery,
    showPreview: searchState.showPreview,
    togglePreview: searchState.togglePreview,
  }
}

function createSearchActions(): SearchDialogActions {
  return {
    createItem: searchDataState.createSidebarItem,
    openItem: searchDataState.openItem,
  }
}

function getPreviewState(itemId: SidebarItemId | undefined) {
  const fallbackItem = itemId ? searchDataState.items.find((item) => item.id === itemId) : undefined
  const selectedContentItem =
    (searchDataState.previewQuery.data as AnyItemWithContent | undefined) ??
    (fallbackItem ? ({ ...fallbackItem, ancestors: [] } as AnyItemWithContent) : undefined)
  if (searchDataState.previewQuery.isLoading) {
    return {
      status: 'loading',
      label: fallbackItem?.name ?? 'Page',
      error: null,
      folderChildren: [],
      isLoading: true,
      item: undefined,
    } satisfies ResourceContentState
  }
  if (searchDataState.previewQuery.error) {
    return {
      status: 'error',
      label: fallbackItem?.name ?? 'Page',
      error: searchDataState.previewQuery.error,
      folderChildren: [],
      isLoading: false,
      item: undefined,
    } satisfies ResourceContentState
  }
  if (!selectedContentItem) {
    return {
      status: itemId ? 'not_found' : 'idle',
      label: fallbackItem?.name ?? 'Page',
      error: null,
      folderChildren: [],
      isLoading: false,
      item: undefined,
    } satisfies ResourceContentState
  }
  return {
    status: 'ready',
    label: selectedContentItem.name,
    error: null,
    folderChildren: searchDataState.items.filter(
      (item) => item.parentId === selectedContentItem.id,
    ),
    isLoading: false,
    item: selectedContentItem,
  } satisfies ResourceContentState
}

function getSearchState(query: string) {
  return {
    bodySearchError: searchDataState.bodyQuery.error,
    bodySearchPending: searchDataState.bodyQuery.isPending,
    recentItems: [],
    results: buildItemSearchResults({
      bodyResults: searchDataState.bodyQuery.data,
      getBreadcrumb: () => '',
      items: searchDataState.items,
      query,
    }),
  }
}

const emptyContextMenu: BuiltContextMenu = {
  flatItems: [],
  groups: [],
  isEmpty: true,
}

const showInSidebarItem: ResolvedContextMenuItem = {
  id: 'show-in-sidebar',
  commandId: 'showInSidebar',
  label: 'Show in Sidebar',
  disabled: false,
  checked: false,
  group: 'primary',
  priority: 0,
  onSelect: vi.fn(),
}

const showInSidebarMenu: BuiltContextMenu = {
  flatItems: [showInSidebarItem],
  groups: [{ id: 'primary', items: [showInSidebarItem] }],
  isEmpty: false,
}
