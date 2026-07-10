import { act, render, renderHook, screen, waitFor } from '@testing-library/react'
import { createElement, Fragment } from 'react'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vite-plus/test'
import { AGGREGATE_SHARE_STATUS } from '../../../sharing/share-state'
import type {
  BlocksShareSource,
  BlocksShareState,
  ResourceShareState,
  ShareActionResult,
} from '../../../sharing/contracts'
import type { NoteBlock } from '../../../notes/document/model'
import { BlockNoteContextMenuContext } from '../../../notes/context-menu/blocknote-context-menu'
import type { BlockNoteContextMenuContextType } from '../../../notes/context-menu/blocknote-context-menu'
import { createNote } from '../../../test/sidebar-item-factory'
import { createTestWorkspaceRuntime } from '../../../test/workspace-runtime-factory'
import type { ViewContext } from '../../menu-context'
import { VIEW_CONTEXT } from '../../view-context'
import { useWorkspaceRuntimeContextMenuModel } from '../runtime-model'

type ReadyBlocksShareState = Extract<BlocksShareState, { status: 'ready' }>
const toastErrorMock = vi.hoisted(() => vi.fn())

vi.mock('../runtime-edit-dialogs', () => ({
  RuntimeFileEditDialog: () => null,
  RuntimeMapEditDialog: () => null,
}))

vi.mock('../../sidebar/forms/sidebar-item-edit-dialog', () => ({
  SidebarItemEditDialog: () => null,
}))

vi.mock('../../../sharing/sidebar-items/panel', () => ({
  SidebarItemsSharePanel: ({
    items,
    state,
  }: {
    items: Array<{ name: string }>
    state: ResourceShareState
  }) =>
    createElement(
      'div',
      { 'data-testid': 'runtime-share-panel' },
      [items.map((item) => item.name).join(', '), state.aggregateShareStatus].join(' / '),
    ),
}))

vi.mock('../../sidebar/workspace-state', () => ({
  useSidebarWorkspaceState: () => ({
    editing: {
      setRenamingItemId: vi.fn(),
    },
  }),
}))

vi.mock('../../sidebar/use-reveal-item-parents', () => ({
  useRevealSidebarItemParents: () => vi.fn(),
}))

vi.mock('sonner', () => ({
  toast: {
    error: toastErrorMock,
  },
}))

describe('useWorkspaceRuntimeContextMenuModel', () => {
  beforeEach(() => {
    toastErrorMock.mockReset()
  })

  it('renders sidebar item share panels from runtime sharing state', () => {
    const note = createNote({ name: 'Visible note' })
    const shareState = createResourceShareState({
      aggregateShareStatus: AGGREGATE_SHARE_STATUS.INDIVIDUALLY_SHARED,
      shareableItems: [note],
    })
    const renderItemsShareState = vi.fn(
      (_items: Array<unknown>, renderState: (state: ResourceShareState) => ReactNode) =>
        renderState(shareState),
    )
    const runtime = createTestWorkspaceRuntime({
      activeItems: [note],
      item: note,
      sharing: {
        status: 'available',
        renderItemsShareState,
        setDefaultPermission: vi.fn(),
        setParticipantPermission: vi.fn(),
      },
    })
    const { result } = renderHook(() =>
      useWorkspaceRuntimeContextMenuModel(
        {
          item: note,
          viewContext: VIEW_CONTEXT.TOPBAR,
        },
        runtime,
      ),
    )

    render(createElement(Fragment, null, getShareItemsItem(result.current).submenuContent))

    expect(renderItemsShareState).toHaveBeenCalledWith([note], expect.any(Function))
    expect(screen.getByTestId('runtime-share-panel')).toHaveTextContent(
      'Visible note / individually_shared',
    )
  })

  it('re-enables block share toggles after a successful all-player update', async () => {
    const note = createNote()
    const block = { id: 'block-1' } as NoteBlock
    const shareHarness = createBlockShareHarness()
    const runtime = createTestWorkspaceRuntime({
      activeItems: [note],
      blockSharing: shareHarness.source,
      item: note,
    })
    const wrapper = createBlockNoteContextWrapper({
      block,
      note: note as BlockNoteContextMenuContextType['note'],
    })
    const { result } = renderHook(
      () =>
        useWorkspaceRuntimeContextMenuModel(
          {
            item: note,
            viewContext: VIEW_CONTEXT.NOTE_VIEW,
          },
          runtime,
        ),
      { wrapper },
    )

    expect(getShareBlocksItem(result.current).disabled).toBe(false)

    await act(async () => {
      await getShareBlocksItem(result.current).onSelect()
    })
    expect(getShareBlocksItem(result.current)).toMatchObject({
      disabled: true,
      label: 'Unshare 1 Block',
    })

    act(() => {
      shareHarness.resolveUpdate({ status: 'completed' })
    })

    await waitFor(() => {
      expect(getShareBlocksItem(result.current)).toMatchObject({
        disabled: false,
        label: 'Unshare 1 Block',
      })
    })
  })

  it('rolls back block share toggles when an all-player update does not apply', async () => {
    const note = createNote()
    const block = { id: 'block-1' } as NoteBlock
    const shareHarness = createBlockShareHarness()
    const runtime = createTestWorkspaceRuntime({
      activeItems: [note],
      blockSharing: shareHarness.source,
      item: note,
    })
    const wrapper = createBlockNoteContextWrapper({
      block,
      note: note as BlockNoteContextMenuContextType['note'],
    })
    const { result } = renderHook(
      () =>
        useWorkspaceRuntimeContextMenuModel(
          {
            item: note,
            viewContext: VIEW_CONTEXT.NOTE_VIEW,
          },
          runtime,
        ),
      { wrapper },
    )

    await act(async () => {
      await getShareBlocksItem(result.current).onSelect()
    })
    expect(getShareBlocksItem(result.current)).toMatchObject({
      disabled: true,
      label: 'Unshare 1 Block',
    })

    act(() => {
      shareHarness.resolveUpdate({ status: 'failed' })
    })

    await waitFor(() => {
      expect(getShareBlocksItem(result.current)).toMatchObject({
        disabled: false,
        label: 'Share 1 Block',
      })
    })
    expect(toastErrorMock).toHaveBeenCalledExactlyOnceWith('Failed to update block sharing')
  })

  it('rolls back block share toggles when an all-player update rejects', async () => {
    const note = createNote()
    const block = { id: 'block-1' } as NoteBlock
    const shareHarness = createBlockShareHarness()
    const runtime = createTestWorkspaceRuntime({
      activeItems: [note],
      blockSharing: shareHarness.source,
      item: note,
    })
    const wrapper = createBlockNoteContextWrapper({
      block,
      note: note as BlockNoteContextMenuContextType['note'],
    })
    const { result } = renderHook(
      () =>
        useWorkspaceRuntimeContextMenuModel(
          {
            item: note,
            viewContext: VIEW_CONTEXT.NOTE_VIEW,
          },
          runtime,
        ),
      { wrapper },
    )

    await act(async () => {
      await getShareBlocksItem(result.current).onSelect()
    })
    expect(getShareBlocksItem(result.current)).toMatchObject({
      disabled: true,
      label: 'Unshare 1 Block',
    })

    act(() => {
      shareHarness.rejectUpdate(new Error('share failed'))
    })

    await waitFor(() => {
      expect(getShareBlocksItem(result.current)).toMatchObject({
        disabled: false,
        label: 'Share 1 Block',
      })
    })
    expect(toastErrorMock).toHaveBeenCalledExactlyOnceWith('Failed to update block sharing')
  })

  it('closes open edit dialogs when the context-menu view changes', async () => {
    const note = createNote()
    const runtime = createTestWorkspaceRuntime({
      activeItems: [note],
      item: note,
    })
    const onDialogOpen = vi.fn()
    const onDialogClose = vi.fn()
    const initialProps: { viewContext: ViewContext } = { viewContext: VIEW_CONTEXT.SIDEBAR }
    const { result, rerender } = renderHook(
      ({ viewContext }: { viewContext: ViewContext }) =>
        useWorkspaceRuntimeContextMenuModel(
          {
            item: note,
            onDialogClose,
            onDialogOpen,
            viewContext,
          },
          runtime,
        ),
      { initialProps },
    )

    await act(async () => {
      await getEditItem(result.current).onSelect()
    })

    expect(onDialogOpen).toHaveBeenCalledOnce()
    expect(onDialogClose).not.toHaveBeenCalled()

    rerender({ viewContext: VIEW_CONTEXT.TOPBAR })

    expect(onDialogClose).toHaveBeenCalledOnce()
  })
})

function createBlockNoteContextWrapper({
  block,
  note,
}: {
  block: NoteBlock
  note: BlockNoteContextMenuContextType['note']
}) {
  const context: BlockNoteContextMenuContextType = {
    noteBlockId: block.id as BlockNoteContextMenuContextType['noteBlockId'],
    editor: {
      getBlock: (blockId: string) => (blockId === block.id ? block : undefined),
      getSelection: () => null,
    } as unknown as BlockNoteContextMenuContextType['editor'],
    isEditorTextContext: false,
    note,
    openMenu: () => undefined,
    openValueInline: () => undefined,
    position: { x: 0, y: 0 },
    registerValueInlineEdit: () => () => undefined,
    setEditor: () => undefined,
    valueInlineEditable: false,
    valueInlineId: undefined,
    valueInlineInstanceId: undefined,
  }

  return function BlockNoteContextWrapper({ children }: { children: ReactNode }) {
    return createElement(BlockNoteContextMenuContext.Provider, { value: context }, children)
  }
}

function createBlockShareHarness() {
  let defaultPermissionLevel: ReadyBlocksShareState['defaultPermissionLevel'] = 'hidden'
  let resolveUpdate: ((result: ShareActionResult) => void) | undefined
  let rejectUpdate: ((error: Error) => void) | undefined
  const setDefaultPermission = vi.fn(
    (permissionLevel: Parameters<ReadyBlocksShareState['setDefaultPermission']>[0]) =>
      new Promise<ShareActionResult>((resolve, reject) => {
        resolveUpdate = (result) => {
          if (result.status === 'completed') {
            defaultPermissionLevel = permissionLevel
          }
          resolve(result)
        }
        rejectUpdate = reject
      }),
  )
  const source: BlocksShareSource = {
    status: 'available',
    useBlocksShare: () =>
      ({
        status: 'ready',
        aggregateShareStatus: AGGREGATE_SHARE_STATUS.NOT_SHARED,
        defaultPermissionLevel,
        isMutating: false,
        setDefaultPermission,
        setParticipantPermission: () => Promise.resolve({ status: 'completed' as const }),
        shareItems: [],
        toggleShareStatus: () => Promise.resolve({ status: 'completed' as const }),
      }) satisfies ReadyBlocksShareState,
  }

  return {
    source,
    resolveUpdate: (result: ShareActionResult) => {
      if (!resolveUpdate) {
        throw new Error('Expected block share update to start')
      }
      resolveUpdate(result)
    },
    rejectUpdate: (error: Error) => {
      if (!rejectUpdate) {
        throw new Error('Expected block share update to start')
      }
      rejectUpdate(error)
    },
  }
}

function getShareBlocksItem(model: ReturnType<typeof useWorkspaceRuntimeContextMenuModel>) {
  const item = model.model.surfaceModel.menu.flatItems.find(
    (menuItem) => menuItem.id === 'share-blocks',
  )
  if (!item) {
    throw new Error('Expected Share Block menu item')
  }
  return item
}

function getShareItemsItem(model: ReturnType<typeof useWorkspaceRuntimeContextMenuModel>) {
  const item = model.model.surfaceModel.menu.flatItems.find(
    (menuItem) => menuItem.id === 'share-items',
  )
  if (!item) {
    throw new Error('Expected Share menu item')
  }
  return item
}

function getEditItem(model: ReturnType<typeof useWorkspaceRuntimeContextMenuModel>) {
  const item = model.model.surfaceModel.menu.flatItems.find(
    (menuItem) => menuItem.id === 'edit-item',
  )
  if (!item) {
    throw new Error('Expected Edit item menu item')
  }
  return item
}

function createResourceShareState(overrides: Partial<ResourceShareState> = {}): ResourceShareState {
  const completedShareAction = () => Promise.resolve({ status: 'completed' as const })
  return {
    aggregateShareStatus: AGGREGATE_SHARE_STATUS.NOT_SHARED,
    defaultPermissionLevel: null,
    clearParticipantPermission: completedShareAction,
    inheritShares: false,
    inheritedAllPermissionLevel: null,
    inheritedFromFolderName: null,
    isFolderItem: false,
    isMutating: false,
    participants: [],
    setDefaultPermission: completedShareAction,
    setInheritShares: completedShareAction,
    setParticipantPermission: completedShareAction,
    shareableItems: [],
    shareItems: [],
    status: 'ready',
    toggleShareStatus: completedShareAction,
    toggleShareWithParticipant: completedShareAction,
    ...overrides,
  }
}
