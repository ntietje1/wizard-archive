import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { DEFAULT_SORT_OPTIONS } from 'shared/editor/types'
import { SidebarShareButton } from '../sidebar-item-share-button'
import type { AnySidebarItem } from 'shared/sidebar-items/model-types'
import { SidebarItemsContext } from '~/features/sidebar/contexts/sidebar-items-context'
import type { SidebarItemsValue } from '~/features/sidebar/contexts/sidebar-items-context'
import { useSidebarUIStore } from '~/features/sidebar/stores/sidebar-ui-store'
import { SidebarWorkspaceSourceProvider } from '~/features/sidebar/workspace/sidebar-workspace-source'
import type { SidebarWorkspaceSource } from '~/features/sidebar/workspace/sidebar-workspace-source'
import { buildSidebarItemMaps } from '~/features/sidebar/utils/sidebar-item-maps'
import { createNote } from '~/test/factories/sidebar-item-factory'

vi.mock('~/features/campaigns/hooks/useCampaign', () => ({
  useCampaign: () => ({ isDm: true }),
}))

vi.mock('~/features/sharing/components/sidebar-items-share-panel', () => ({
  SidebarItemsSharePanel: ({ items }: { items: Array<AnySidebarItem> }) => (
    <div data-testid="share-panel">{items.map((item) => item.name).join(', ')}</div>
  ),
}))

function sidebarItemsValue(items: Array<AnySidebarItem>): SidebarItemsValue {
  return {
    data: items,
    status: 'success',
    error: null,
    refetch: vi.fn(),
    ...buildSidebarItemMaps(items),
  }
}

function renderShareButton(item: AnySidebarItem, activeItems: Array<AnySidebarItem>) {
  const active = sidebarItemsValue(activeItems)
  const trash = sidebarItemsValue([])

  return render(
    <SidebarWorkspaceSourceProvider value={sidebarWorkspaceSource(active, trash)}>
      <SidebarItemsContext.Provider value={{ active, trash }}>
        <SidebarShareButton item={item} />
      </SidebarItemsContext.Provider>
    </SidebarWorkspaceSourceProvider>,
  )
}

function setActiveSurface(items: Array<AnySidebarItem>) {
  useSidebarUIStore.setState({
    activeItemSurface: {
      surface: 'sidebar',
      parentId: null,
      visibleItemIds: items.map((item) => item._id),
    },
  })
}

describe('SidebarShareButton', () => {
  afterEach(() => {
    useSidebarUIStore.setState({
      selectedItemIds: [],
      anchorItemId: null,
      focusedItemId: null,
      selectionSurface: null,
      focusSurface: null,
      activeItemSurface: null,
    })
  })

  it('shares the selected item group when the row belongs to the current selection', async () => {
    const user = userEvent.setup()
    const first = createNote({ name: 'First' })
    const second = createNote({ name: 'Second' })
    useSidebarUIStore.setState({
      selectedItemIds: [first._id, second._id],
      anchorItemId: first._id,
    })
    setActiveSurface([first, second])

    renderShareButton(first, [first, second])

    await user.click(screen.getByRole('button', { name: 'Share' }))

    expect(await screen.findByTestId('share-panel')).toHaveTextContent('First, Second')
  })

  it('shares only the clicked row when the row is outside the current selection', async () => {
    const user = userEvent.setup()
    const selected = createNote({ name: 'Selected' })
    const clicked = createNote({ name: 'Clicked' })
    useSidebarUIStore.setState({
      selectedItemIds: [selected._id],
      anchorItemId: selected._id,
    })
    setActiveSurface([selected, clicked])

    renderShareButton(clicked, [selected, clicked])

    await user.click(screen.getByRole('button', { name: 'Share' }))

    expect(await screen.findByTestId('share-panel')).toHaveTextContent('Clicked')
  })

  it('shares the clicked row when there is no item selection', async () => {
    const user = userEvent.setup()
    const clicked = createNote({ name: 'Clicked' })

    renderShareButton(clicked, [clicked])

    await user.click(screen.getByRole('button', { name: 'Share' }))

    expect(await screen.findByTestId('share-panel')).toHaveTextContent('Clicked')
  })

  it('shares the selected item group without depending on active surface registration', async () => {
    const user = userEvent.setup()
    const first = createNote({ name: 'First' })
    const second = createNote({ name: 'Second' })
    useSidebarUIStore.setState({
      selectedItemIds: [first._id, second._id],
      anchorItemId: first._id,
      activeItemSurface: null,
    })

    renderShareButton(first, [first, second])

    await user.click(screen.getByRole('button', { name: 'Share' }))

    expect(await screen.findByTestId('share-panel')).toHaveTextContent('First, Second')
  })

  it('shares a single selected item when the row belongs to that selection', async () => {
    const user = userEvent.setup()
    const selected = createNote({ name: 'Selected' })
    useSidebarUIStore.setState({
      selectedItemIds: [selected._id],
      anchorItemId: selected._id,
    })
    setActiveSurface([selected])

    renderShareButton(selected, [selected])

    await user.click(screen.getByRole('button', { name: 'Share' }))

    expect(await screen.findByTestId('share-panel')).toHaveTextContent('Selected')
  })

  it('does not invent a share target when selected sidebar data is stale', async () => {
    const user = userEvent.setup()
    const clicked = createNote({ name: 'Clicked' })
    useSidebarUIStore.setState({
      selectedItemIds: [clicked._id],
      anchorItemId: clicked._id,
    })

    renderShareButton(clicked, [])

    await user.click(screen.getByRole('button', { name: 'Share' }))

    expect(await screen.findByTestId('share-panel')).toHaveTextContent('Clicked')
  })
})

function sidebarWorkspaceSource(
  active: SidebarItemsValue,
  trash: SidebarItemsValue,
): SidebarWorkspaceSource {
  const state = useSidebarUIStore.getState()

  return {
    items: { active, trash },
    filteredActiveItems: active,
    ui: {
      folderStates: {},
      closeAllFoldersMode: false,
      bookmarksOnlyMode: false,
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
      selectedSlug: state.selectedSlug,
      selectedItemIds: state.selectedItemIds,
      focusedItemId: state.focusedItemId,
      activeItemSurface: state.activeItemSurface,
    },
    selectionCommands: {
      setSelected: state.setSelected,
      setSelectedItemIds: state.setSelectedItemIds,
      selectSingleItem: state.selectSingleItem,
      toggleItemSelection: state.toggleItemSelection,
      selectItemRange: state.selectItemRange,
      setFocusedItem: state.setFocusedItem,
      moveFocus: state.moveFocus,
      clearItemSelection: state.clearItemSelection,
      normalizeContextSelection: state.normalizeContextSelection,
      setActiveItemSurface: state.setActiveItemSurface,
      getSelectionSnapshot: () => {
        const currentState = useSidebarUIStore.getState()
        return {
          selectedSlug: currentState.selectedSlug,
          selectedItemIds: currentState.selectedItemIds,
          focusedItemId: currentState.focusedItemId,
          activeItemSurface: currentState.activeItemSurface,
        }
      },
    },
  }
}
