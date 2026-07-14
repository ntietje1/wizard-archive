import { render, screen } from '@testing-library/react'
import { PERMISSION_LEVEL } from '../../../../../../shared/permissions/types'
import { VIEW_CONTEXT } from '../../view-context'
import { beforeEach, describe, expect, it, vi } from 'vite-plus/test'
import { FileTopbar } from '../topbar'
import { createRuntimeFileTopbarSource } from '../source'
import type { CurrentItemState, WorkspaceNavigationState, WorkspaceRuntime } from '../../runtime'
import type { AnyItemWithContent } from '../../items'
import type { ResourceHistory } from '../../../filesystem/history-types'
import type { ResourceId } from '../../../resources/domain-id'
import { createNote } from '../../../test/sidebar-item-factory'
import { createTestWorkspaceRuntime } from '../../../test/workspace-runtime-factory'

const currentItemState = vi.hoisted(() => ({
  item: null as ReturnType<typeof createNote> | null,
}))

const editableBreadcrumbSpy = vi.hoisted(() => vi.fn())
const workspaceContextMenuSpy = vi.hoisted(() => vi.fn())

vi.mock('../editable-breadcrumb', () => ({
  EditableBreadcrumb: (props: { canRename: boolean; item: { name: string } }) => {
    editableBreadcrumbSpy(props)
    return <span>{props.item.name}</span>
  },
  SidebarItemBreadcrumb: ({ item }: { item: { name: string } }) => <span>{item.name}</span>,
}))

vi.mock('../share-button', () => ({
  ShareButton: () => null,
}))

vi.mock('../view-as-button', () => ({
  ViewAsPlayerButton: () => null,
}))

vi.mock('../../context-menu/context-menu', () => ({
  WorkspaceContextMenu: (props: { children: React.ReactNode }) => {
    workspaceContextMenuSpy(props)
    return <>{props.children}</>
  },
}))

describe('FileTopbar', () => {
  beforeEach(() => {
    editableBreadcrumbSpy.mockClear()
    workspaceContextMenuSpy.mockClear()
  })

  it('uses the item topbar context menu for a ready item', () => {
    currentItemState.item = createNote({
      myPermissionLevel: PERMISSION_LEVEL.EDIT,
    })

    render(
      <FileTopbar
        historyControl={{ status: 'hidden' }}
        source={createRuntimeFileTopbarSource(createWorkspaceRuntime())}
      />,
    )

    expect(screen.getByRole('button', { name: 'More options' })).toBeEnabled()
    expect(editableBreadcrumbSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        canRename: true,
        item: currentItemState.item,
      }),
    )
    expect(workspaceContextMenuSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        viewContext: VIEW_CONTEXT.TOPBAR,
        item: currentItemState.item,
        disabled: false,
      }),
    )
  })

  it('keeps the item topbar context menu while a known item is loading', () => {
    currentItemState.item = createNote({
      myPermissionLevel: PERMISSION_LEVEL.EDIT,
    })

    render(
      <FileTopbar
        historyControl={{ status: 'hidden' }}
        source={createRuntimeFileTopbarSource(createWorkspaceRuntime({ isCurrentLoading: true }))}
      />,
    )

    expect(screen.getByRole('button', { name: 'More options' })).toBeEnabled()
    expect(workspaceContextMenuSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        viewContext: VIEW_CONTEXT.TOPBAR,
        item: currentItemState.item,
        disabled: false,
      }),
    )
  })

  it('uses the trash context menu for the trash root', () => {
    currentItemState.item = null
    const trashedItem = createNote({ isTrashed: true })

    render(
      <FileTopbar
        historyControl={{ status: 'hidden' }}
        source={createRuntimeFileTopbarSource(
          createWorkspaceRuntime({
            currentNavigation: { kind: 'trash' },
            trashItems: [trashedItem],
          }),
        )}
      />,
    )

    expect(screen.getByRole('button', { name: 'More options' })).toBeEnabled()
    expect(workspaceContextMenuSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        viewContext: VIEW_CONTEXT.TRASH_VIEW,
        item: undefined,
        disabled: false,
      }),
    )
  })

  it('keeps more actions disabled for a pending optimistic item', () => {
    currentItemState.item = createNote({
      id: 'optimistic-create-1' as ResourceId,
      myPermissionLevel: PERMISSION_LEVEL.EDIT,
    })

    render(
      <FileTopbar
        historyControl={{ status: 'hidden' }}
        source={createRuntimeFileTopbarSource(createWorkspaceRuntime())}
      />,
    )

    expect(screen.getByRole('button', { name: 'More options' })).toBeDisabled()
  })
})

function createWorkspaceRuntime({
  currentNavigation,
  history = 'available',
  isCurrentLoading = false,
  trashItems = [],
}: {
  currentNavigation?: WorkspaceNavigationState
  history?: 'available' | 'unsupported'
  isCurrentLoading?: boolean
  trashItems?: Array<ReturnType<typeof createNote>>
} = {}): WorkspaceRuntime {
  const item = currentItemState.item
  const contentItem = item as AnyItemWithContent | null
  const availabilityState: CurrentItemState['availabilityState'] = isCurrentLoading
    ? {
        status: 'loading',
        label: item?.name ?? 'Page',
      }
    : contentItem
      ? {
          status: 'available',
          label: contentItem.name,
          item: contentItem,
        }
      : {
          status: 'not_found',
          label: 'Page',
          message: 'Page not found.',
        }
  const historyState: ResourceHistory =
    history === 'available' && item
      ? {
          status: 'available',
          itemId: item.id,
          entries: {
            loadMore: vi.fn(),
            state: {
              canEdit: true,
              entries: [],
              membersMap: new Map(),
              myMemberId: null,
              previewingEntryId: null,
              status: 'Exhausted',
            },
          },
          previewingEntryId: null,
          preview: { status: 'unavailable', entryTime: undefined },
          previewEntry: vi.fn(),
          rollbackEntryId: null,
          rollback: { status: 'closed', isRestoring: false },
          requestRollback: vi.fn(),
          restoreRollback: vi.fn(),
          clearPreview: vi.fn(),
          clearRollback: vi.fn(),
          clearItemSession: vi.fn(),
        }
      : {
          status: 'unsupported',
          reason: 'not_implemented',
        }
  const runtime = createTestWorkspaceRuntime({
    activeItems: item ? [item] : [],
    availabilityState,
    contentItem,
    currentNavigation,
    history: historyState,
    item,
    trashItems,
  })
  return runtime
}
