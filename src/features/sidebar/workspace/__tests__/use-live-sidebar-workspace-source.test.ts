import { renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { AnySidebarItem } from 'shared/sidebar-items/model-types'
import type {
  SidebarItemsContextValue,
  SidebarItemsValue,
} from '../../contexts/sidebar-items-context'
import { buildSidebarItemMaps } from '../../utils/sidebar-item-maps'
import { createFolder, createNote } from '~/test/factories/sidebar-item-factory'
import { useLiveSidebarWorkspaceSource } from '../use-live-sidebar-workspace-source'

const liveSourceState = vi.hoisted(() => ({
  activeItems: [] as Array<AnySidebarItem>,
  trashItems: [] as Array<AnySidebarItem>,
  setFolderState: vi.fn(),
}))

vi.mock('~/features/campaigns/hooks/useCampaign', () => ({
  useCampaign: () => ({ campaignId: 'campaign_1' }),
}))

vi.mock('~/features/sidebar/hooks/useEditorMode', () => ({
  useEditorMode: () => ({ campaignActor: { kind: 'dm' } }),
}))

vi.mock('~/features/sidebar/hooks/useSidebarItems', () => ({
  useSidebarItemsQueries: (): SidebarItemsContextValue => ({
    active: sidebarItemsValue(liveSourceState.activeItems),
    trash: sidebarItemsValue(liveSourceState.trashItems),
  }),
}))

vi.mock('~/features/sidebar/stores/sidebar-ui-store', () => ({
  useCampaignSidebarState: () => ({
    folderStates: {},
    closeAllFoldersMode: false,
    bookmarksOnlyMode: false,
  }),
  useCampaignSidebarActions: () => ({
    setFolderState: liveSourceState.setFolderState,
    toggleFolderState: vi.fn(),
    clearAllFolderStates: vi.fn(),
    toggleCloseAllFoldersMode: vi.fn(),
    exitCloseAllMode: vi.fn(),
    toggleBookmarksOnlyMode: vi.fn(),
  }),
}))

describe('useLiveSidebarWorkspaceSource', () => {
  beforeEach(() => {
    liveSourceState.activeItems = []
    liveSourceState.trashItems = []
    liveSourceState.setFolderState.mockReset()
  })

  it('opens every active ancestor folder for an item through source UI commands', () => {
    const rootFolder = createFolder()
    const childFolder = createFolder({ parentId: rootFolder._id })
    const nestedNote = createNote({ parentId: childFolder._id })
    liveSourceState.activeItems = [rootFolder, childFolder, nestedNote]

    const { result } = renderHook(() => useLiveSidebarWorkspaceSource())

    result.current.commands.openParentFolders(nestedNote._id)

    expect(liveSourceState.setFolderState).toHaveBeenCalledTimes(2)
    expect(liveSourceState.setFolderState).toHaveBeenNthCalledWith(1, childFolder._id, true)
    expect(liveSourceState.setFolderState).toHaveBeenNthCalledWith(2, rootFolder._id, true)
  })
})

function sidebarItemsValue(data: Array<AnySidebarItem>): SidebarItemsValue {
  return {
    data,
    status: 'success',
    error: null,
    refetch: vi.fn(),
    ...buildSidebarItemMaps(data),
  }
}
