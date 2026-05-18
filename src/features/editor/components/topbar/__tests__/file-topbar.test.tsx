import { fireEvent, render, screen } from '@testing-library/react'
import { PERMISSION_LEVEL } from 'convex/permissions/types'
import { describe, expect, it, vi } from 'vitest'
import { FileTopbar } from '../file-topbar'
import { createNote } from '~/test/factories/sidebar-item-factory'

const currentItemState = vi.hoisted(() => ({
  item: null as ReturnType<typeof createNote> | null,
}))

const rightSidebarState = vi.hoisted(() => ({
  toggle: vi.fn(),
}))

vi.mock('../editable-breadcrumb', () => ({
  EditableBreadcrumb: ({ item }: { item: { name: string } }) => <span>{item.name}</span>,
  EditableName: () => <input aria-label="Item name" />,
  SidebarItemBreadcrumb: ({ item }: { item: { name: string } }) => <span>{item.name}</span>,
}))

vi.mock('../topbar-item-content/item-button-wrapper', () => ({
  ItemButtonWrapper: () => <div />,
}))

vi.mock('~/features/context-menu/components/editor-context-menu', () => ({
  EditorContextMenu: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

vi.mock('~/features/sidebar/hooks/useCurrentItem', () => ({
  useCurrentItem: () => ({
    item: currentItemState.item,
    editorSearch: {},
    isLoading: false,
    hasRequestedItem: true,
  }),
}))

vi.mock('~/features/filesystem/useFileSystemReadModel', () => ({
  useFileSystemReadModel: () => ({
    activeItemsById: new Map(
      currentItemState.item ? [[currentItemState.item._id, currentItemState.item]] : [],
    ),
    trashItems: [],
  }),
}))

vi.mock('~/features/sidebar/stores/sidebar-ui-store', () => ({
  useSidebarUIStore: (selector: (state: unknown) => unknown) =>
    selector({
      pendingItemName: '',
      setPendingItemName: vi.fn(),
    }),
}))

vi.mock('~/features/campaigns/hooks/useCampaign', () => ({
  useCampaign: () => ({
    isDm: false,
    campaignId: 'campaign_1',
  }),
}))

vi.mock('~/features/sidebar/hooks/useEditorMode', () => ({
  useEditorMode: () => ({
    canEdit: true,
    viewAsPlayerId: null,
  }),
}))

vi.mock('~/features/editor/hooks/useRightSidebar', () => ({
  useRightSidebar: () => rightSidebarState,
}))

describe('FileTopbar', () => {
  it('does not open history when the current item only grants view permission', () => {
    currentItemState.item = createNote({
      myPermissionLevel: PERMISSION_LEVEL.VIEW,
      updatedTime: Date.now(),
    })

    render(<FileTopbar />)

    fireEvent.click(screen.getByRole('button', { name: /toggle history panel/i }))

    expect(rightSidebarState.toggle).not.toHaveBeenCalled()
  })
})
