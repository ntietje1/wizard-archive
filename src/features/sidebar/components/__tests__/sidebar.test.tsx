import { createElement } from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ReactNode } from 'react'
import type { Id } from 'convex/_generated/dataModel'
import { DEFAULT_SORT_OPTIONS } from 'shared/editor/types'
import { FileSidebar } from '~/features/sidebar/components/sidebar'
import { SidebarWorkspaceSourceProvider } from '~/features/sidebar/workspace/sidebar-workspace-source'
import { buildSidebarItemMaps } from '~/features/sidebar/utils/sidebar-item-maps'
import type { SidebarItemsValue } from '~/features/sidebar/contexts/sidebar-items-context'
import type { SidebarWorkspaceSource } from '~/features/sidebar/workspace/sidebar-workspace-source'

const activeItemsState = vi.hoisted(() => ({
  status: 'success' as 'pending' | 'error' | 'success',
  error: null as Error | null,
  refetch: vi.fn(),
}))
const campaignSidebarState = vi.hoisted(() => ({
  bookmarksOnlyMode: false,
}))

vi.mock('@tanstack/react-router', () => ({
  ClientOnly: ({ children }: { children: ReactNode }) => createElement('div', null, children),
}))

vi.mock('~/features/campaigns/hooks/useCampaign', () => ({
  useCampaign: () => ({ campaignId: 'campaign_1' as Id<'campaigns'> }),
}))

vi.mock('~/features/sidebar/components/sidebar-root/droppable-root', () => ({
  DroppableRoot: ({ children }: { children: ReactNode }) => createElement('div', null, children),
}))

vi.mock('~/features/sidebar/components/sidebar-list', () => ({
  SidebarList: () => createElement('div', { 'data-testid': 'sidebar-list' }),
}))

vi.mock('~/features/sidebar/components/bookmarked-items-list', () => ({
  BookmarkedItemsList: () => createElement('div', { 'data-testid': 'bookmarked-items' }),
}))

describe('FileSidebar', () => {
  beforeEach(() => {
    activeItemsState.status = 'success'
    activeItemsState.error = null
    activeItemsState.refetch.mockReset()
    campaignSidebarState.bookmarksOnlyMode = false
  })

  it('renders an explicit retryable error when active sidebar items fail to load', () => {
    activeItemsState.status = 'error'
    activeItemsState.error = new Error('sidebar failed')

    renderFileSidebar()

    expect(screen.getByText('Failed to load sidebar items.')).toBeInTheDocument()
    expect(screen.getByText('sidebar failed')).toBeInTheDocument()
    expect(screen.queryByTestId('sidebar-list')).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Try Again' }))

    expect(activeItemsState.refetch).toHaveBeenCalled()
  })

  it('renders the active-items error before bookmarks-only mode', () => {
    campaignSidebarState.bookmarksOnlyMode = true
    activeItemsState.status = 'error'
    activeItemsState.error = new Error('sidebar failed')

    renderFileSidebar()

    expect(screen.getByText('Failed to load sidebar items.')).toBeInTheDocument()
    expect(screen.queryByTestId('bookmarked-items')).not.toBeInTheDocument()
  })
})

function renderFileSidebar() {
  return render(
    <SidebarWorkspaceSourceProvider value={sidebarWorkspaceSource()}>
      <FileSidebar />
    </SidebarWorkspaceSourceProvider>,
  )
}

function sidebarWorkspaceSource(): SidebarWorkspaceSource {
  const active = sidebarItemsValue()

  return {
    items: {
      active,
      trash: sidebarItemsValue(),
    },
    filteredActiveItems: active,
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
    commands: {
      createSidebarItem: vi.fn(),
      openItem: vi.fn(),
      openParentFolders: vi.fn(),
      setRenamingItemId: vi.fn(),
    },
    sort: {
      options: DEFAULT_SORT_OPTIONS,
      setOptions: vi.fn(),
    },
    editing: {
      renamingItemId: null,
    },
    selection: {
      selectedSlug: null,
      selectedItemIds: [],
      focusedItemId: null,
      activeItemSurface: null,
    },
    selectionCommands: {
      setSelected: vi.fn(),
      setSelectedItemIds: vi.fn(),
      selectSingleItem: vi.fn(),
      toggleItemSelection: vi.fn(),
      selectItemRange: vi.fn(),
      setFocusedItem: vi.fn(),
      moveFocus: vi.fn(),
      clearItemSelection: vi.fn(),
      normalizeContextSelection: vi.fn(),
      setActiveItemSurface: vi.fn(),
      getSelectionSnapshot: () => ({
        selectedSlug: null,
        selectedItemIds: [],
        focusedItemId: null,
        activeItemSurface: null,
      }),
    },
  }
}

function sidebarItemsValue(): SidebarItemsValue {
  return {
    data: [],
    status: activeItemsState.status,
    error: activeItemsState.error,
    refetch: activeItemsState.refetch,
    ...buildSidebarItemMaps([]),
  }
}
