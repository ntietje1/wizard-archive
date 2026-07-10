import { render } from '@testing-library/react'
import { describe, expect, it, vi } from 'vite-plus/test'
import type { ReactNode } from 'react'
import { SidebarWorkspaceStateProvider } from '../../workspace-state'
import { BookmarkedItemsList } from '../bookmarked-items-list'
import { SidebarList } from '../sidebar-list'
import type { SidebarTreeSource } from '../sidebar-tree-source'
import { createTestSidebarWorkspaceState } from '../../__tests__/test-helpers'

describe('sidebar list loading states', () => {
  it('does not read the tree while active items are loading', () => {
    const source = createSource({ activeStatus: 'pending' })

    renderWithSidebarState(<SidebarList source={source} />)

    expect(source.getVisibleRoots).not.toHaveBeenCalled()
    expect(source.getVisibleChildren).not.toHaveBeenCalled()
    expect(source.getVisibleItemIds).not.toHaveBeenCalled()
  })

  it('does not read bookmarks while active items are loading', () => {
    const source = createSource({ activeStatus: 'pending' })

    renderWithSidebarState(<BookmarkedItemsList source={source} />)

    expect(source.getBookmarkedItems).not.toHaveBeenCalled()
  })
})

function renderWithSidebarState(ui: ReactNode) {
  return render(
    <SidebarWorkspaceStateProvider value={createTestSidebarWorkspaceState()}>
      {ui}
    </SidebarWorkspaceStateProvider>,
  )
}

function createSource({
  activeStatus,
}: {
  activeStatus: SidebarTreeSource['activeStatus']
}): SidebarTreeSource {
  return {
    activeError: null,
    activeStatus,
    canDropOnRoot: true,
    getBookmarkedItems: vi.fn(() => []),
    getVisibleChildren: vi.fn(() => []),
    getVisibleItemIds: vi.fn(() => []),
    getVisibleRoots: vi.fn(() => []),
    item: {
      canDragItem: () => true,
      canDropOnFolder: () => true,
      canUseItemActions: () => true,
      currentItemId: null,
      editItem: vi.fn(),
      getSidebarDragData: (item) => ({
        sidebarItemId: item.id,
        sidebarItemIds: [item.id],
        dragPreviewItemIds: [item.id],
      }),
      openItem: vi.fn(),
    },
    refreshActive: vi.fn(),
  }
}
