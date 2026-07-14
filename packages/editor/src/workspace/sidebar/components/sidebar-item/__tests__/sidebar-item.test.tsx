import { useState } from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { FileText } from 'lucide-react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test'
import { createFolder, createNote } from '../../../../../test/sidebar-item-factory'
import { testId } from '../../../../../test/id'
import { createWorkspaceResource } from '../../../../runtime'
import { SidebarItem } from '../sidebar-item'
import { SidebarItemButton } from '../sidebar-item-button'
import type { SidebarItemSource } from '../../sidebar-tree-source'
import type { ComponentProps, ReactNode } from 'react'

const scrollIntoViewMock = vi.fn()
const openItemMock = vi.hoisted(() => vi.fn())
const handleErrorMock = vi.hoisted(() => vi.fn())
const handleItemClickMock = vi.hoisted(() =>
  vi.fn((_event: unknown, onOpen?: () => void) => {
    onOpen?.()
  }),
)
const folderStateMock = vi.hoisted(() => ({
  isExpanded: false,
  toggleExpanded: vi.fn(),
}))
const originalScrollIntoViewDescriptor = Object.getOwnPropertyDescriptor(
  Element.prototype,
  'scrollIntoView',
)

vi.mock('../../../../../errors/handle-error', () => ({
  handleError: handleErrorMock,
}))

vi.mock('../../../../../filesystem/use-name-validation', () => ({
  useNameValidation: () => ({
    value: '',
    setValue: vi.fn(),
    hasError: false,
    validationError: null,
    validateName: vi.fn(),
  }),
}))

vi.mock('../../../../../context-menu/hooks/use-context-menu', () => ({
  useContextMenu: () => ({ contextMenuRef: vi.fn(), handleMoreOptions: vi.fn() }),
}))

vi.mock('../../../use-sidebar-item-visual-state', () => ({
  useSidebarItemVisualState: () => ({
    isSelected: true,
    isViewing: true,
    isMultiSelected: false,
  }),
}))

vi.mock('../../../hooks/use-folder-state', () => ({
  useFolderState: () => folderStateMock,
}))

vi.mock('../../../workspace-state', () => ({
  useSidebarWorkspaceState: () => ({
    editing: { renamingItemId: null, setRenamingItemId: vi.fn() },
  }),
}))

vi.mock('../../../use-item-selection-interactions', () => ({
  useItemSelectionInteractions: () => ({
    handleItemClick: handleItemClickMock,
    handleItemContextMenu: vi.fn(),
  }),
}))

vi.mock('../../../item-icons', () => ({
  getSidebarItemIcon: () => FileText,
}))

vi.mock('../../../../context-menu/context-menu', () => ({
  WorkspaceContextMenu: ({ children }: { children: ReactNode }) => <>{children}</>,
}))

vi.mock('../draggable-sidebar-item', () => ({
  DraggableSidebarItem: ({ children }: { children: ReactNode }) => <>{children}</>,
}))

vi.mock('../droppable-sidebar-item', () => ({
  DroppableSidebarItem: ({ canDrop, children }: { canDrop: boolean; children: ReactNode }) => (
    <div data-testid="folder-drop-wrapper" data-can-drop={String(canDrop)}>
      {children}
    </div>
  ),
}))

vi.mock('../sidebar-item-share-button', () => ({
  SidebarShareButton: () => null,
}))

describe('SidebarItem', () => {
  beforeEach(() => {
    scrollIntoViewMock.mockClear()
    openItemMock.mockReset()
    handleErrorMock.mockReset()
    handleItemClickMock.mockClear()
    folderStateMock.isExpanded = false
    folderStateMock.toggleExpanded.mockReset()
    Element.prototype.scrollIntoView = scrollIntoViewMock
  })

  afterEach(() => {
    if (originalScrollIntoViewDescriptor) {
      Object.defineProperty(Element.prototype, 'scrollIntoView', originalScrollIntoViewDescriptor)
      return
    }

    Reflect.deleteProperty(Element.prototype, 'scrollIntoView')
  })

  it('scrolls optimistic created items into view when they render', async () => {
    const item = createNote({
      id: testId<'sidebarItems'>('optimistic-create-1'),
      name: 'New Scene',
      slug: 'new-scene',
    })

    renderSidebarItem({ item, visibleItemIds: [item.id] })

    await waitFor(() =>
      expect(scrollIntoViewMock).toHaveBeenCalledWith({
        block: 'nearest',
        inline: 'nearest',
      }),
    )
  })

  it('scrolls every rendered optimistic item included in the visible item list', async () => {
    const first = createNote({
      id: testId<'sidebarItems'>('optimistic-create-1'),
      name: 'First Scene',
      slug: 'first-scene',
    })
    const second = createNote({
      id: testId<'sidebarItems'>('optimistic-create-2'),
      name: 'Second Scene',
      slug: 'second-scene',
    })

    render(
      <>
        <SidebarItem
          getChildren={getEmptyChildren}
          item={first}
          source={createSidebarItemSource()}
          visibleItemIds={[first.id]}
        />
        <SidebarItem
          getChildren={getEmptyChildren}
          item={second}
          source={createSidebarItemSource()}
          visibleItemIds={[second.id]}
        />
      </>,
    )

    await waitFor(() => expect(scrollIntoViewMock).toHaveBeenCalledTimes(2))
  })

  it('opens the sidebar item through the item source when clicked', () => {
    const item = createNote({
      id: testId<'sidebarItems'>('note_1'),
      name: 'Existing Scene',
      slug: 'existing-scene',
    })

    renderSidebarItem({ item, visibleItemIds: [item.id] })

    const button = screen.getByRole('button', { name: 'Existing Scene' })

    fireEvent.click(button)

    expect(openItemMock).toHaveBeenCalledWith(createWorkspaceResource(item.id))
  })

  it('restores the original row when a filesystem rename fails', async () => {
    const item = createNote({
      id: testId<'sidebarItems'>('note_1'),
      name: 'Session Notes',
      slug: 'session-notes',
    })
    const editItem = vi.fn().mockRejectedValue(new Error('rename failed'))

    render(
      <RenameSidebarItemButtonHarness item={item} source={createSidebarItemSource({ editItem })} />,
    )

    const input = screen.getByRole('textbox', { name: 'Item name' })
    fireEvent.change(input, { target: { value: 'Session Notes Revised' } })
    input.focus()
    fireEvent.keyDown(input, { key: 'Enter' })

    await waitFor(() => {
      expect(editItem).toHaveBeenCalledWith({ item, name: 'Session Notes Revised' })
      expect(handleErrorMock).toHaveBeenCalledWith(expect.any(Error), 'Failed to rename')
      expect(screen.getByRole('button', { name: 'Session Notes' })).toBeInTheDocument()
    })
  })

  it('renders expanded folder children inside the folder drop wrapper', () => {
    folderStateMock.isExpanded = true
    const folder = createFolder({
      id: testId<'sidebarItems'>('folder_1'),
      name: 'Quests',
      slug: 'quests',
    })
    const child = createNote({
      id: testId<'sidebarItems'>('note_1'),
      name: 'Forest Ambush',
      parentId: folder.id,
      slug: 'forest-ambush',
    })

    renderSidebarItem({
      item: folder,
      visibleItemIds: [folder.id, child.id],
      getChildren: (parentId) => (parentId === folder.id ? [child] : []),
    })

    expect(screen.getByTestId('folder-drop-wrapper')).toHaveAttribute('data-can-drop', 'true')
    expect(screen.getByRole('button', { name: 'Forest Ambush' })).toBeInTheDocument()
  })

  it('renders collapsed folders without materializing child rows', () => {
    const folder = createFolder({
      id: testId<'sidebarItems'>('folder_1'),
      name: 'Quests',
      slug: 'quests',
    })

    renderSidebarItem({
      item: folder,
      visibleItemIds: [folder.id],
      getChildren: () => {
        throw new Error('Collapsed folders should not read children')
      },
    })

    expect(screen.getByRole('button', { name: 'Quests' })).toBeInTheDocument()
  })
})

function renderSidebarItem({
  getChildren = getEmptyChildren,
  ...props
}: Omit<ComponentProps<typeof SidebarItem>, 'getChildren' | 'source'> &
  Partial<Pick<ComponentProps<typeof SidebarItem>, 'getChildren' | 'source'>>) {
  return render(
    <SidebarItem
      {...props}
      getChildren={getChildren}
      source={props.source ?? createSidebarItemSource()}
    />,
  )
}

function RenameSidebarItemButtonHarness({
  item,
  source,
}: Pick<ComponentProps<typeof SidebarItemButton>, 'item' | 'source'>) {
  const [renamingId, setRenamingId] = useState<
    ComponentProps<typeof SidebarItemButton>['renamingId']
  >(item.id)

  return (
    <SidebarItemButton
      expanded={false}
      item={item}
      renamingId={renamingId}
      setRenamingId={setRenamingId}
      showChevron={false}
      source={source}
      surface="sidebar"
      visibleItemIds={[item.id]}
    />
  )
}

function getEmptyChildren() {
  return []
}

function createSidebarItemSource(overrides: Partial<SidebarItemSource> = {}): SidebarItemSource {
  return {
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
    openItem: openItemMock,
    ...overrides,
  }
}
