import { renderHook } from '@testing-library/react'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import type { Id } from 'convex/_generated/dataModel'
import { PERMISSION_LEVEL } from 'shared/permissions/types'
import { createNote } from '~/test/factories/sidebar-item-factory'
import { useLiveEditorContextMenuActions } from '../use-live-editor-context-menu-actions'

const convexMutationMock = vi.hoisted(() => vi.fn())
const setAllPlayersPermissionMock = vi.hoisted(() => vi.fn())

vi.mock('@convex-dev/react-query', () => ({
  useConvex: () => ({ mutation: convexMutationMock }),
}))

vi.mock('~/features/campaigns/hooks/useCampaign', () => ({
  useCampaign: () => ({ campaignId: 'campaign_1' as Id<'campaigns'> }),
}))

vi.mock('~/features/sidebar/workspace/sidebar-workspace-source', () => ({
  useSidebarWorkspaceSource: () => ({
    commands: {
      createSidebarItem: vi.fn(),
      openItem: vi.fn(),
      openParentFolders: vi.fn(),
      setRenamingItemId: vi.fn(),
    },
  }),
}))

vi.mock('~/features/sidebar/hooks/useBookmarks', () => ({
  useToggleBookmark: () => ({ mutateAsync: vi.fn() }),
}))

vi.mock('~/features/sidebar/hooks/useGameSession', () => ({
  useSession: () => ({
    endCurrentSession: { mutate: vi.fn() },
    startSession: { mutate: vi.fn() },
  }),
}))

vi.mock('~/features/filesystem/useFileSystem', () => ({
  useFileSystem: () => ({
    setAllPlayersPermission: setAllPlayersPermissionMock,
    requestTrashItems: vi.fn(),
    restoreItems: vi.fn(),
    confirmDeleteForever: vi.fn(),
    pasteIntoTarget: vi.fn(),
    duplicateItems: vi.fn(),
    confirmEmptyTrash: vi.fn(),
  }),
}))

vi.mock('../download-actions', () => ({
  createDownloadActions: () => ({
    downloadItems: vi.fn(),
    downloadAll: vi.fn(),
  }),
}))

vi.mock('../creation-actions', () => ({
  createCreationActions: () => ({
    createNote: vi.fn(),
    createFolder: vi.fn(),
    createMap: vi.fn(),
    createFile: vi.fn(),
    createCanvas: vi.fn(),
  }),
}))

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
}))

describe('useLiveEditorContextMenuActions', () => {
  beforeEach(() => {
    convexMutationMock.mockReset()
    setAllPlayersPermissionMock.mockReset()
  })

  it('routes general access changes through filesystem sharing operations', async () => {
    const first = createNote({ _id: 'note_1' as Id<'sidebarItems'> })
    const second = createNote({ _id: 'note_2' as Id<'sidebarItems'> })
    const { result } = renderHook(() => useLiveEditorContextMenuActions())

    await result.current.actions.sharing.setGeneralAccessLevel(
      {
        surface: 'sidebar',
        item: first,
        selectedItems: [first, second],
      },
      PERMISSION_LEVEL.VIEW,
    )

    expect(setAllPlayersPermissionMock).toHaveBeenCalledExactlyOnceWith({
      itemIds: ['note_1', 'note_2'],
      permissionLevel: PERMISSION_LEVEL.VIEW,
    })
    expect(convexMutationMock).not.toHaveBeenCalled()
  })
})
