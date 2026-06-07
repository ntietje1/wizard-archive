import { render, screen, waitFor } from '@testing-library/react'
import { FileText } from 'lucide-react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Id } from 'convex/_generated/dataModel'
import type { AnySidebarItem } from 'shared/sidebar-items/model-types'
import { SORT_DIRECTIONS, SORT_ORDERS } from 'shared/editor/types'
import { createFolder, createNote } from '~/test/factories/sidebar-item-factory'
import { SidebarItem } from '../sidebar-item'

const scrollIntoViewMock = vi.fn()
const originalScrollIntoViewDescriptor = Object.getOwnPropertyDescriptor(
  Element.prototype,
  'scrollIntoView',
)

vi.mock('~/features/filesystem/useEditFileSystemItem', () => ({
  useEditFileSystemItem: () => ({ editItem: vi.fn() }),
}))

vi.mock('~/shared/hooks/useNameValidation', () => ({
  useNameValidation: () => ({
    value: '',
    setValue: vi.fn(),
    hasError: false,
    validationError: null,
    checkNameUnique: vi.fn(),
  }),
}))

vi.mock('~/features/context-menu/hooks/useContextMenu', () => ({
  useContextMenu: () => ({ contextMenuRef: vi.fn(), handleMoreOptions: vi.fn() }),
}))

vi.mock('~/features/sidebar/hooks/useEditorLinkProps', () => ({
  useEditorLinkProps: () => undefined,
}))

vi.mock('~/features/sidebar/hooks/useLastEditorItem', () => ({
  useLastEditorItem: () => ({ setLastSelectedItem: vi.fn() }),
}))

vi.mock('~/features/sidebar/hooks/useSelectedItem', () => ({
  useIsFocusedItem: () => false,
  useSidebarItemVisualState: () => ({
    isSelected: true,
    isViewing: true,
    isMultiSelected: false,
  }),
}))

vi.mock('~/features/sidebar/hooks/useFolderState', () => ({
  useFolderState: () => ({ isExpanded: false, toggleExpanded: vi.fn() }),
}))

vi.mock('~/features/sidebar/hooks/useItemSelectionInteractions', () => ({
  useItemSelectionInteractions: () => ({
    handleItemClick: vi.fn(),
    handleItemContextMenu: vi.fn(),
  }),
}))

vi.mock('~/shared/utils/category-icons', () => ({
  getSidebarItemIcon: () => FileText,
}))

vi.mock('~/features/context-menu/components/editor-context-menu', () => ({
  EditorContextMenu: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

vi.mock('../draggable-sidebar-item', () => ({
  DraggableSidebarItem: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

vi.mock('../droppable-sidebar-item', () => ({
  DroppableSidebarItem: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

vi.mock('../sidebar-item-share-button', () => ({
  SidebarShareButton: () => null,
}))

describe('SidebarItem', () => {
  beforeEach(() => {
    scrollIntoViewMock.mockClear()
    Element.prototype.scrollIntoView = scrollIntoViewMock
  })

  afterEach(() => {
    if (originalScrollIntoViewDescriptor) {
      Object.defineProperty(Element.prototype, 'scrollIntoView', originalScrollIntoViewDescriptor)
    }
  })

  it('scrolls optimistic created items into view when they render', async () => {
    const item = createNote({
      _id: 'optimistic-create-1' as Id<'sidebarItems'>,
      name: 'New Scene',
      slug: 'new-scene',
    })

    renderSidebarItem({ item, parentItemsMap: new Map(), visibleItemIds: [item._id] })

    await waitFor(() =>
      expect(scrollIntoViewMock).toHaveBeenCalledWith({
        block: 'nearest',
        inline: 'nearest',
      }),
    )
  })

  it('does not scroll non-optimistic items', async () => {
    const item = createNote({
      _id: 'note_1' as Id<'sidebarItems'>,
      name: 'Existing Scene',
      slug: 'existing-scene',
    })

    renderSidebarItem({ item, parentItemsMap: new Map(), visibleItemIds: [item._id] })

    await waitFor(() => expect(scrollIntoViewMock).not.toHaveBeenCalled())
  })

  it('does not scroll optimistic items outside the visible item list', async () => {
    const item = createNote({
      _id: 'optimistic-create-1' as Id<'sidebarItems'>,
      name: 'Hidden Scene',
      slug: 'hidden-scene',
    })

    renderSidebarItem({ item, parentItemsMap: new Map(), visibleItemIds: [] })

    await waitFor(() => expect(scrollIntoViewMock).not.toHaveBeenCalled())
  })

  it('scrolls every rendered optimistic item included in the visible item list', async () => {
    const first = createNote({
      _id: 'optimistic-create-1' as Id<'sidebarItems'>,
      name: 'First Scene',
      slug: 'first-scene',
    })
    const second = createNote({
      _id: 'optimistic-create-2' as Id<'sidebarItems'>,
      name: 'Second Scene',
      slug: 'second-scene',
    })

    render(
      <>
        <SidebarItem
          item={first}
          parentItemsMap={new Map()}
          sortOptions={alphaSortOptions}
          visibleItemIds={[first._id]}
        />
        <SidebarItem
          item={second}
          parentItemsMap={new Map()}
          sortOptions={alphaSortOptions}
          visibleItemIds={[second._id]}
        />
      </>,
    )

    await waitFor(() => expect(scrollIntoViewMock).toHaveBeenCalledTimes(2))
  })

  it('does not render descendants of collapsed folders', () => {
    const folder = createFolder({
      _id: 'folder_1' as Id<'sidebarItems'>,
      name: 'Encounters',
      slug: 'encounters',
    })
    const child = createNote({
      _id: 'note_1' as Id<'sidebarItems'>,
      name: 'Hidden Scene',
      slug: 'hidden-scene',
      parentId: folder._id,
    })
    const parentItemsMap = new Map<Id<'sidebarItems'> | null, Array<AnySidebarItem>>([
      [folder._id, [child]],
    ])

    renderSidebarItem({ item: folder, parentItemsMap, visibleItemIds: [folder._id] })

    expect(screen.getByTestId('selectable-row-Encounters')).toBeInTheDocument()
    expect(screen.queryByTestId('selectable-row-Hidden Scene')).not.toBeInTheDocument()
  })
})

function renderSidebarItem(props: Omit<React.ComponentProps<typeof SidebarItem>, 'sortOptions'>) {
  return render(<SidebarItem {...props} sortOptions={alphaSortOptions} />)
}

const alphaSortOptions = {
  order: SORT_ORDERS.Alphabetical,
  direction: SORT_DIRECTIONS.Ascending,
}
