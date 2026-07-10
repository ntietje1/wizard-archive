import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vite-plus/test'
import { DEFAULT_SORT_OPTIONS } from '../../../../items-persistence-contract'
import type { AnyItem } from '../../../../items'
import { SidebarShareButton } from '../sidebar-item-share-button'
import { SidebarWorkspaceStateProvider } from '../../../workspace-state'
import type { SidebarWorkspaceState } from '../../../workspace-state'
import { useItemSurfaceRegistration } from '../../../use-item-surface-registration'
import { createFolder, createNote } from '../../../../../test/sidebar-item-factory'
import { createTestWorkspaceRuntime } from '../../../../../test/workspace-runtime-factory'
import { createSidebarShareButtonSource } from '../../../sidebar-share-button-source'
import type { SidebarShareButtonSource } from '../../../sidebar-share-button-source'
import type { SidebarItemId } from '../../../../../../../../shared/common/ids'

const selectionState: SidebarWorkspaceState['selection'] = {
  selectedItemIds: [],
  focusedItemId: null,
  activeItemSurface: null,
}

vi.mock('../../../../../sharing/sidebar-items/panel', () => ({
  SidebarItemsSharePanel: ({ items }: { items: Array<AnyItem> }) => (
    <div data-testid="share-panel">
      {items.map((shareItem) => shareItem.name).join(', ')}
      <div data-slot="select-content" data-testid="share-permission-select-content" />
    </div>
  ),
}))

function renderShareButton(item: AnyItem, activeItems: Array<AnyItem>) {
  return render(<SidebarShareButton item={item} source={createShareButtonSource(activeItems)} />)
}

function renderShareButtonInSidebarSurface(item: AnyItem, activeItems: Array<AnyItem>) {
  return render(
    <SidebarWorkspaceStateProvider value={sidebarWorkspaceSource()}>
      <SidebarSurfaceHarness items={activeItems}>
        <SidebarShareButton item={item} source={createShareButtonSource(activeItems)} />
      </SidebarSurfaceHarness>
    </SidebarWorkspaceStateProvider>,
  )
}

function SidebarSurfaceHarness({
  children,
  items,
}: {
  children: React.ReactNode
  items: Array<AnyItem>
}) {
  const { handleSurfacePointerDown, itemSurfaceHotkeyProps } = useItemSurfaceRegistration({
    surface: 'sidebar',
    parentId: null,
    visibleItemIds: items.map((item) => item.id),
  })

  return (
    <div onPointerDownCapture={handleSurfacePointerDown} {...itemSurfaceHotkeyProps}>
      {children}
    </div>
  )
}

function setActiveSurface(items: Array<AnyItem>) {
  selectionState.activeItemSurface = {
    surface: 'sidebar',
    parentId: null,
    visibleItemIds: items.map((item) => item.id),
  }
}

describe('SidebarShareButton', () => {
  afterEach(() => {
    selectionState.selectedItemIds = []
    selectionState.focusedItemId = null
    selectionState.activeItemSurface = null
  })

  it('shares the selected item group when the row belongs to the current selection', async () => {
    const user = userEvent.setup()
    const first = createNote({ name: 'First' })
    const second = createNote({ name: 'Second' })
    selectionState.selectedItemIds = [first.id, second.id]
    setActiveSurface([first, second])

    renderShareButton(first, [first, second])

    await user.click(screen.getByRole('button', { name: 'Share' }))

    expect(await screen.findByTestId('share-panel')).toHaveTextContent('First, Second')
  })

  it('shares selected top-level targets after removing selected descendants', async () => {
    const user = userEvent.setup()
    const folder = createFolder({ name: 'Folder' })
    const child = createNote({ name: 'Child', parentId: folder.id })
    const sibling = createNote({ name: 'Sibling' })
    selectionState.selectedItemIds = [folder.id, child.id, sibling.id]
    setActiveSurface([folder, child, sibling])

    renderShareButton(child, [folder, child, sibling])

    await user.click(screen.getByRole('button', { name: 'Share' }))

    expect(await screen.findByTestId('share-panel')).toHaveTextContent('Folder, Sibling')
  })

  it('keeps multi-selection after opening the visible share menu', async () => {
    const user = userEvent.setup()
    const first = createNote({ name: 'First' })
    const second = createNote({ name: 'Second' })
    selectionState.selectedItemIds = [first.id, second.id]
    setActiveSurface([first, second])

    renderShareButton(first, [first, second])

    await user.click(screen.getByRole('button', { name: 'Share' }))

    expect(await screen.findByTestId('share-panel')).toHaveTextContent('First, Second')
    expect(selectionState.selectedItemIds).toEqual([first.id, second.id])
  })

  it('keeps multi-selection when interacting with the opened share menu content', async () => {
    const user = userEvent.setup()
    const first = createNote({ name: 'First' })
    const second = createNote({ name: 'Second' })
    selectionState.selectedItemIds = [first.id, second.id]

    renderShareButtonInSidebarSurface(first, [first, second])

    await user.click(screen.getByRole('button', { name: 'Share' }))
    const sharePanel = await screen.findByTestId('share-panel')

    fireEvent.pointerDown(sharePanel)

    expect(sharePanel).toHaveTextContent('First, Second')
    expect(selectionState.selectedItemIds).toEqual([first.id, second.id])

    fireEvent.pointerDown(screen.getByTestId('share-permission-select-content'))

    expect(selectionState.selectedItemIds).toEqual([first.id, second.id])
  })

  it('shares only the clicked row when the row is outside the current selection', async () => {
    const user = userEvent.setup()
    const selected = createNote({ name: 'Selected' })
    const clicked = createNote({ name: 'Clicked' })
    selectionState.selectedItemIds = [selected.id]
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

  it('shares the clicked row when no active item surface owns the selection', async () => {
    const user = userEvent.setup()
    const first = createNote({ name: 'First' })
    const second = createNote({ name: 'Second' })
    selectionState.selectedItemIds = [first.id, second.id]
    selectionState.activeItemSurface = null

    renderShareButton(first, [first, second])

    await user.click(screen.getByRole('button', { name: 'Share' }))

    expect(await screen.findByTestId('share-panel')).toHaveTextContent('First')
  })

  it('shares a single selected item when the row belongs to that selection', async () => {
    const user = userEvent.setup()
    const selected = createNote({ name: 'Selected' })
    selectionState.selectedItemIds = [selected.id]
    setActiveSurface([selected])

    renderShareButton(selected, [selected])

    await user.click(screen.getByRole('button', { name: 'Share' }))

    expect(await screen.findByTestId('share-panel')).toHaveTextContent('Selected')
  })

  it('keeps the opened share target group when selection changes behind the menu', async () => {
    const user = userEvent.setup()
    const first = createNote({ name: 'First' })
    const second = createNote({ name: 'Second' })
    selectionState.selectedItemIds = [first.id, second.id]
    setActiveSurface([first, second])

    const { rerender } = render(
      <SidebarShareButton item={first} source={createShareButtonSource([first, second])} />,
    )

    await user.click(screen.getByRole('button', { name: 'Share' }))
    selectionState.selectedItemIds = [first.id]
    rerender(<SidebarShareButton item={first} source={createShareButtonSource([first, second])} />)

    expect(await screen.findByTestId('share-panel')).toHaveTextContent('First, Second')
  })
})

function sidebarWorkspaceSource(): SidebarWorkspaceState {
  return {
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
    sort: {
      options: DEFAULT_SORT_OPTIONS,
      setOptions: vi.fn(),
    },
    editing: {
      renamingItemId: null,
      setRenamingItemId: vi.fn(),
    },
    selection: {
      selectedItemIds: selectionState.selectedItemIds,
      focusedItemId: selectionState.focusedItemId,
      activeItemSurface: selectionState.activeItemSurface,
    },
    selectionCommands: {
      setSelectedItemIds: (ids) => {
        selectionState.selectedItemIds = [...ids]
      },
      selectSingleItem: (id) => {
        selectionState.selectedItemIds = [id]
      },
      toggleItemSelection: (id) => {
        selectionState.selectedItemIds = selectionState.selectedItemIds.includes(id)
          ? selectionState.selectedItemIds.filter((selectedId) => selectedId !== id)
          : [...selectionState.selectedItemIds, id]
      },
      selectItemRange: (targetId) => {
        selectionState.selectedItemIds = [targetId]
      },
      setFocusedItem: (id) => {
        selectionState.focusedItemId = id
      },
      moveFocus: vi.fn(),
      clearItemSelection: () => {
        selectionState.selectedItemIds = []
      },
      normalizeContextSelection: (id: SidebarItemId) => {
        if (!selectionState.selectedItemIds.includes(id)) {
          selectionState.selectedItemIds = [id]
        }
      },
      setActiveItemSurface: (surface) => {
        selectionState.activeItemSurface = surface
      },
      clearSelectionForWorkspaceChange: () => {
        selectionState.selectedItemIds = []
        selectionState.focusedItemId = null
        selectionState.activeItemSurface = null
      },
      getSelectionSnapshot: () => {
        return {
          selectedItemIds: selectionState.selectedItemIds,
          anchorItemId: selectionState.selectedItemIds[0] ?? null,
          focusedItemId: selectionState.focusedItemId,
          activeItemSurface: selectionState.activeItemSurface,
        }
      },
    },
  }
}

function createShareButtonSource(activeItems: Array<AnyItem>): SidebarShareButtonSource {
  const runtime = createTestWorkspaceRuntime({
    activeItems,
    selectedItemIds: [...selectionState.selectedItemIds],
  })

  const source = createSidebarShareButtonSource({
    operationItems: runtime.filesystem.operationItems,
    sharing: {
      status: 'available',
      renderItemsShareState: (_items, renderState) => renderState({} as never),
      setDefaultPermission: vi.fn(),
      setParticipantPermission: vi.fn(),
    },
    sidebarSelection: {
      getSelectionSnapshot: () => ({
        selectedItemIds: selectionState.selectedItemIds,
        anchorItemId: selectionState.selectedItemIds[0] ?? null,
        focusedItemId: selectionState.focusedItemId,
        activeItemSurface: selectionState.activeItemSurface,
      }),
    },
  })

  if (!source) throw new Error('Expected sidebar sharing to be available in this test')
  return source
}
