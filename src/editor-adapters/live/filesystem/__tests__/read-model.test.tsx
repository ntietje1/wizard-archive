import type { ResourceId } from '@wizard-archive/editor/resources/domain-id'
import { renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vite-plus/test'
import { createWorkspaceResourceReadModel } from '@wizard-archive/editor/resources/items'
import type { WizardEditorItem } from '@wizard-archive/editor/adapter'
import type { CampaignActor } from 'shared/campaigns/actor'

import { testCampaignId } from 'shared/test/campaign-id'
import { PERMISSION_LEVEL } from 'shared/permissions/types'
import { createFolder, createNote } from '~/test/factories/sidebar-item-factory'
import { useFileSystemReadModel } from '../read-model'

const TEST_RESOURCE_STATUS = {
  trashed: 'trashed',
} as const satisfies Record<string, WizardEditorItem['status']>
const useLiveSidebarItemsQueriesMock = vi.hoisted(() => vi.fn())
const useCampaignActorMock = vi.hoisted(() => vi.fn())

vi.mock('../../sidebar/use-live-sidebar-items-queries', () => ({
  useLiveSidebarItemsQueries: useLiveSidebarItemsQueriesMock,
}))

vi.mock('~/features/campaigns/hooks/useCampaignActor', () => ({
  useCampaignActor: useCampaignActorMock,
}))

describe('useFileSystemReadModel', () => {
  const campaignId = testCampaignId('campaign_read_model')
  const playerActor: CampaignActor = { kind: 'player', campaignId }

  beforeEach(() => {
    useLiveSidebarItemsQueriesMock.mockReset()
    useCampaignActorMock.mockReset()
    useCampaignActorMock.mockReturnValue(playerActor)
  })

  it('builds runtime lookups from player-visible active items', () => {
    const visible = createNote({
      id: 'visible_note' as ResourceId,
      campaignId,
      myPermissionLevel: PERMISSION_LEVEL.VIEW,
    })
    const hidden = createNote({
      id: 'hidden_note' as ResourceId,
      campaignId,
      myPermissionLevel: PERMISSION_LEVEL.NONE,
    })
    const visibleTrashed = createNote({
      id: 'visible_trashed_note' as ResourceId,
      campaignId,
      status: TEST_RESOURCE_STATUS.trashed,
      myPermissionLevel: PERMISSION_LEVEL.VIEW,
    })
    const hiddenTrashed = createNote({
      id: 'hidden_trashed_note' as ResourceId,
      campaignId,
      status: TEST_RESOURCE_STATUS.trashed,
      myPermissionLevel: PERMISSION_LEVEL.NONE,
    })
    useLiveSidebarItemsQueriesMock.mockReturnValue({
      active: createReadState([visible, hidden]),
      trash: createReadState([visibleTrashed, hiddenTrashed]),
    })

    const { result } = renderHook(() => useFileSystemReadModel())

    expect(result.current.activeItems.map((item) => item.id)).toEqual([visible.id, hidden.id])
    expect(result.current.visibleActiveItems.map((item) => item.id)).toEqual([visible.id])
    expect(result.current.visibleTrashItems.map((item) => item.id)).toEqual([visibleTrashed.id])
    expect(result.current.readModel.getItem(visible.id)).toBe(visible)
    expect(result.current.readModel.getItem(hidden.id)).toBeUndefined()
    expect(result.current.readModel.getItem(visibleTrashed.id)).toBe(visibleTrashed)
    expect(result.current.readModel.getItem(hiddenTrashed.id)).toBeUndefined()
  })

  it('filters active descendants through hierarchical player permissions', () => {
    const visibleFolder = createFolder({
      id: 'visible_folder' as ResourceId,
      campaignId,
      myPermissionLevel: PERMISSION_LEVEL.VIEW,
    })
    const visibleChild = createNote({
      id: 'visible_child' as ResourceId,
      campaignId,
      parentId: visibleFolder.id,
      myPermissionLevel: PERMISSION_LEVEL.VIEW,
    })
    const hiddenFolder = createFolder({
      id: 'hidden_folder' as ResourceId,
      campaignId,
      myPermissionLevel: PERMISSION_LEVEL.NONE,
    })
    const hiddenChild = createNote({
      id: 'hidden_child' as ResourceId,
      campaignId,
      parentId: hiddenFolder.id,
      myPermissionLevel: PERMISSION_LEVEL.VIEW,
    })
    useLiveSidebarItemsQueriesMock.mockReturnValue({
      active: createReadState([visibleFolder, visibleChild, hiddenFolder, hiddenChild]),
      trash: createReadState([]),
    })

    const { result } = renderHook(() => useFileSystemReadModel())

    expect(result.current.visibleActiveItems.map((item) => item.id)).toEqual([
      visibleFolder.id,
      visibleChild.id,
    ])
    expect(result.current.readModel.getItem(visibleChild.id)).toBe(visibleChild)
    expect(result.current.readModel.getItem(hiddenFolder.id)).toBeUndefined()
    expect(result.current.readModel.getItem(hiddenChild.id)).toBeUndefined()
  })

  it('exposes trash query error and refresh state separately from active items', () => {
    const trashError = new Error('trash query failed')
    const refreshTrash = vi.fn().mockResolvedValue(undefined)
    useLiveSidebarItemsQueriesMock.mockReturnValue({
      active: createReadState([]),
      trash: createReadState([], {
        error: trashError,
        refresh: refreshTrash,
        status: 'error',
      }),
    })

    const { result } = renderHook(() => useFileSystemReadModel())

    expect(result.current.trashStatus).toBe('error')
    expect(result.current.trashError).toBe(trashError)
    expect(result.current.refreshTrash).toBe(refreshTrash)
    expect(result.current.activeError).toBeNull()
  })

  it('normalizes non-error query failures before they reach the runtime', () => {
    useLiveSidebarItemsQueriesMock.mockReturnValue({
      active: createReadState([], {
        error: 'active query failed',
        status: 'error',
      }),
      trash: createReadState([], {
        error: 'trash query failed',
        status: 'error',
      }),
    })

    const { result } = renderHook(() => useFileSystemReadModel())

    expect(result.current.activeError).toBeNull()
    expect(result.current.trashError).toBeNull()
  })
})

function createReadState(
  items: Array<WizardEditorItem>,
  overrides: Partial<{
    error: unknown
    refresh: () => Promise<unknown>
    status: 'error' | 'pending' | 'success'
  }> = {},
) {
  return {
    data: items,
    status: 'success',
    error: null,
    refresh: () => Promise.resolve(),
    readModel: createWorkspaceResourceReadModel(items),
    ...overrides,
  }
}
