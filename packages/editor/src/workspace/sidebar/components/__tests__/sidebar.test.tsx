import { createElement, createRef } from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vite-plus/test'
import type { ReactNode } from 'react'
import { DEFAULT_SORT_OPTIONS } from '../../../items-persistence-contract'
import type { AnyItem } from '../../../items'
import { FileSidebar } from '../sidebar'
import { SidebarWorkspaceStateProvider } from '../../workspace-state'
import type { SidebarWorkspaceState } from '../../workspace-state'
import { WorkspaceRuntimeProvider } from '../../../runtime-context'
import { createTestWorkspaceRuntime } from '../../../../test/workspace-runtime-factory'
import { createRuntimeSidebarTreeSource } from '../../create-runtime-sidebar-tree-source'
import { WorkspaceRuntimeSidebarContent } from '../../workspace-runtime-sidebar-content'
import { createNote } from '../../../../test/sidebar-item-factory'
import type { ResourceShareSource, ResourceShareState } from '../../../../sharing/contracts'
import type { FileSystemSearch } from '../../../../filesystem/search'
import type { WorkspaceNavigationState } from '../../../runtime'
import { useWorkspaceRuntimeSearchRequestState } from '../../../search-request-state'
import { WorkspaceRuntimeSearchRequestProvider } from '../../../search-request-provider'

const activeItemsState = vi.hoisted(() => ({
  status: 'success' as 'pending' | 'error' | 'success',
  error: null as Error | null,
  refresh: vi.fn(),
}))
const campaignSidebarState = vi.hoisted(() => ({
  bookmarksOnlyMode: false,
}))
const navigationState = vi.hoisted(() => ({
  openDefaultItem: vi.fn(),
}))
vi.mock('../sidebar-root/droppable-root', () => ({
  DroppableRoot: ({ children }: { children: ReactNode }) => createElement('div', null, children),
}))

vi.mock('../sidebar-list', () => ({
  SidebarList: () => createElement('div', { 'data-testid': 'sidebar-list' }),
}))

vi.mock('../bookmarked-items-list', () => ({
  BookmarkedItemsList: () => createElement('div', { 'data-testid': 'bookmarked-items' }),
}))

vi.mock('../../../context-menu/context-menu', () => ({
  WorkspaceContextMenu: ({ children }: { children: ReactNode }) =>
    createElement('div', { 'data-testid': 'sidebar-context-menu' }, children),
}))

describe('FileSidebar', () => {
  beforeEach(() => {
    activeItemsState.status = 'success'
    activeItemsState.error = null
    activeItemsState.refresh.mockReset()
    campaignSidebarState.bookmarksOnlyMode = false
    navigationState.openDefaultItem.mockReset()
  })

  it('renders a generic retryable error when active sidebar items fail to load', () => {
    activeItemsState.status = 'error'
    activeItemsState.error = new Error('sidebar failed')

    renderFileSidebar()

    expect(screen.getByText('Failed to load sidebar items.')).toBeInTheDocument()
    expect(screen.getByText('sidebar failed')).toBeInTheDocument()
    expect(
      screen.getByText('Please try again, or refresh the page if the problem continues.'),
    ).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Try Again' }))

    expect(activeItemsState.refresh).toHaveBeenCalled()
  })

  it('renders the active-items error before bookmarks-only mode', () => {
    campaignSidebarState.bookmarksOnlyMode = true
    activeItemsState.status = 'error'
    activeItemsState.error = new Error('sidebar failed')

    renderFileSidebar()

    expect(screen.getByText('Failed to load sidebar items.')).toBeInTheDocument()
  })

  it('renders the shared sidebar panel with the production sidebar content stack', () => {
    renderWorkspaceRuntimeSidebarContent()

    expect(screen.getByRole('navigation', { name: 'Sidebar' })).toBeInTheDocument()
    expect(screen.getByTestId('sidebar-context-menu')).toBeInTheDocument()
    expect(screen.getByTestId('sidebar-list')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Create new note' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Notes' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Enter close-all-folders mode' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Sort options' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Show bookmarks' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'New' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Trash' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Enter close-all-folders mode' })).toHaveAttribute(
      'aria-pressed',
      'false',
    )
    expect(screen.getByRole('button', { name: 'Show bookmarks' })).toHaveAttribute(
      'aria-pressed',
      'false',
    )

    fireEvent.click(screen.getByRole('button', { name: 'Notes' }))

    expect(navigationState.openDefaultItem).toHaveBeenCalledTimes(1)
  })

  it('opens search from the sidebar when runtime search is available', async () => {
    renderWorkspaceRuntimeSidebarContent({ search: createAvailableSearch() })

    fireEvent.click(screen.getByRole('button', { name: 'Search' }))

    await waitFor(() => {
      expect(screen.getByTestId('runtime-search-open')).toHaveTextContent('true')
    })
  })

  it('does not mark Notes current while viewing Trash', () => {
    renderWorkspaceRuntimeSidebarContent({ currentNavigation: { kind: 'trash' } })

    expect(screen.getByRole('button', { name: 'Notes' })).not.toHaveAttribute('aria-current')
  })

  it('resolves selected sidebar items for item sharing', () => {
    const first = createNote({ name: 'First note' })
    const second = createNote({ name: 'Second note' })
    const shareState = createResourceShareState([first, second])
    const runtime = createSidebarTestRuntime({
      activeItems: [first, second],
      selectedItemIds: [first.id, second.id],
      sharing: {
        status: 'available',
        renderItemsShareState: (_items, renderState) => renderState(shareState),
        setDefaultPermission: vi.fn(),
        setParticipantPermission: vi.fn(),
      },
    })

    const shareButtonSource = createRuntimeSidebarTreeSource({
      ...runtime,
      sidebarSelection: createSidebarSelectionSource({
        selectedItemIds: [first.id, second.id],
        visibleItemIds: [first.id, second.id],
      }),
    }).item.shareButtonSource

    if (!shareButtonSource) throw new Error('Expected row sharing to be available')
    expect(shareButtonSource.getShareItems(second)).toEqual([first, second])
  })

  it('exposes row sharing only when runtime item sharing is available', () => {
    const runtime = createSidebarTestRuntime({
      sharing: { status: 'unsupported', reason: 'not_available' },
    })

    const itemSource = createRuntimeSidebarTreeSource({
      ...runtime,
      sidebarSelection: createSidebarSelectionSource({
        selectedItemIds: [],
        visibleItemIds: [],
      }),
    }).item

    expect(itemSource.shareButtonSource).toBeUndefined()
  })
})

function renderFileSidebar() {
  const runtime = createSidebarTestRuntime()

  return renderWithSidebarSource(
    <FileSidebar
      source={createRuntimeSidebarTreeSource({
        ...runtime,
        sidebarSelection: createSidebarSelectionSource({
          selectedItemIds: [],
          visibleItemIds: [],
        }),
      })}
    />,
    {
      runtime,
    },
  )
}

function renderWorkspaceRuntimeSidebarContent(
  options: {
    canCreateItems?: boolean
    currentNavigation?: WorkspaceNavigationState
    search?: FileSystemSearch
  } = {},
) {
  const runtime = createSidebarTestRuntime({
    canCreateItems: options.canCreateItems,
    currentNavigation: options.currentNavigation,
    search: options.search,
  })

  return renderWithSidebarSource(
    <WorkspaceRuntimeSidebarContent layout="fixed" runtime={runtime} showPanelDivider />,
    { runtime },
  )
}

function renderWithSidebarSource(
  ui: ReactNode,
  options: {
    canCreateItems?: boolean
    runtime?: ReturnType<typeof createTestWorkspaceRuntime>
  } = {},
) {
  const runtime =
    options.runtime ?? createSidebarTestRuntime({ canCreateItems: options.canCreateItems })
  const scopeRef = createRef<HTMLDivElement>()

  return render(
    <WorkspaceRuntimeProvider value={runtime}>
      <WorkspaceRuntimeSearchRequestProvider scopeRef={scopeRef}>
        <div ref={scopeRef}>
          <SidebarWorkspaceStateProvider value={sidebarWorkspaceSource()}>
            {ui}
            <SearchRequestProbe />
          </SidebarWorkspaceStateProvider>
        </div>
      </WorkspaceRuntimeSearchRequestProvider>
    </WorkspaceRuntimeProvider>,
  )
}

function SearchRequestProbe() {
  const request = useWorkspaceRuntimeSearchRequestState()
  return <output data-testid="runtime-search-open">{String(request.isOpen)}</output>
}

function createSidebarTestRuntime(
  options: {
    activeItems?: Array<AnyItem>
    canCreateItems?: boolean
    currentNavigation?: WorkspaceNavigationState
    search?: FileSystemSearch
    selectedItemIds?: Array<AnyItem['id']>
    sharing?: ResourceShareSource
  } = {},
) {
  return createTestWorkspaceRuntime({
    activeItems: options.activeItems,
    activeError: activeItemsState.error,
    activeStatus: activeItemsState.status,
    canCreateItems: options.canCreateItems ?? true,
    currentNavigation: options.currentNavigation,
    navigation: { openDefaultItem: navigationState.openDefaultItem },
    refreshActive: activeItemsState.refresh,
    search: options.search,
    selectedItemIds: options.selectedItemIds,
    sharing: options.sharing,
  })
}

function createAvailableSearch(): FileSystemSearch {
  return {
    status: 'available',
    ensureSearchState: vi.fn(),
    getSearchState: () => ({
      bodySearchError: null,
      bodySearchPending: false,
      recentItems: [],
      results: [],
    }),
    itemLinks: { status: 'unsupported', reason: 'not_available' },
  }
}

function createResourceShareState(shareableItems: ResourceShareState['shareableItems']) {
  const completedShareAction = () => Promise.resolve({ status: 'completed' as const })
  return {
    isMutating: false,
    status: 'ready',
    aggregateShareStatus: 'not_shared',
    defaultPermissionLevel: null,
    inheritedAllPermissionLevel: null,
    inheritedFromFolderName: null,
    isFolderItem: false,
    inheritShares: false,
    shareableItems,
    participants: [],
    shareItems: [],
    toggleShareStatus: completedShareAction,
    toggleShareWithParticipant: completedShareAction,
    setParticipantPermission: completedShareAction,
    clearParticipantPermission: completedShareAction,
    setDefaultPermission: completedShareAction,
    setInheritShares: completedShareAction,
  } satisfies ResourceShareState
}

function sidebarWorkspaceSource(): SidebarWorkspaceState {
  return {
    ui: {
      folderStates: {},
      closeAllFoldersMode: false,
      bookmarksOnlyMode: campaignSidebarState.bookmarksOnlyMode,
    },
    uiCommands: {
      setFolderState: vi.fn(),
      toggleFolderState: vi.fn(),
      clearAllFolderStates: vi.fn(),
      toggleCloseAllFoldersMode: vi.fn(),
      exitCloseAllMode: vi.fn(),
      toggleBookmarksOnlyMode: vi.fn(),
    },
    sort: {
      options: DEFAULT_SORT_OPTIONS,
      setOptions: vi.fn(),
    },
    editing: {
      renamingItemId: null,
      setRenamingItemId: vi.fn(),
    },
    selection: {
      selectedItemIds: [],
      focusedItemId: null,
      activeItemSurface: null,
    },
    selectionCommands: {
      setSelectedItemIds: vi.fn(),
      selectSingleItem: vi.fn(),
      toggleItemSelection: vi.fn(),
      selectItemRange: vi.fn(),
      setFocusedItem: vi.fn(),
      moveFocus: vi.fn(),
      clearItemSelection: vi.fn(),
      normalizeContextSelection: vi.fn(),
      setActiveItemSurface: vi.fn(),
      clearSelectionForWorkspaceChange: vi.fn(),
      getSelectionSnapshot: () => ({
        selectedItemIds: [],
        anchorItemId: null,
        focusedItemId: null,
        activeItemSurface: null,
      }),
    },
  }
}

function createSidebarSelectionSource({
  selectedItemIds,
  visibleItemIds,
}: {
  selectedItemIds: Array<AnyItem['id']>
  visibleItemIds: Array<AnyItem['id']>
}): Pick<SidebarWorkspaceState['selectionCommands'], 'getSelectionSnapshot'> {
  return {
    getSelectionSnapshot: () => ({
      selectedItemIds,
      anchorItemId: selectedItemIds[0] ?? null,
      focusedItemId: selectedItemIds[0] ?? null,
      activeItemSurface: {
        surface: 'sidebar',
        parentId: null,
        visibleItemIds,
      },
    }),
  }
}
