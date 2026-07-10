import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vite-plus/test'
import type { Id } from 'convex/_generated/dataModel'
import { PERMISSION_LEVEL } from 'shared/permissions/types'
import type { PermissionLevel } from 'shared/permissions/types'
import { createFolder, createNote } from '~/test/factories/sidebar-item-factory'
import type {
  ResourceShareOperations,
  ResourceShareState,
  ShareActionResult,
} from '@wizard-archive/editor/sharing'
import { useLiveSidebarItemsShare } from '../use-live-sidebar-items-share'

type ReadyResourceShareState = Extract<ResourceShareState, { status: 'ready' }>

type SidebarShareQueryItem = {
  sidebarItemId: Id<'sidebarItems'>
  allPermissionLevel: PermissionLevel | null
  inheritShares: boolean
  inheritedAllPermissionLevel: PermissionLevel | null
  inheritedFromFolderName: string | null
  shares: Array<{
    campaignMemberId: Id<'campaignMembers'>
    permissionLevel: PermissionLevel | null
  }>
  memberInheritedPermissions: Partial<Record<Id<'campaignMembers'>, PermissionLevel>>
  memberInheritedFromFolderNames: Partial<Record<Id<'campaignMembers'>, string>>
}

const useLiveSidebarItemsShareQueryMock = vi.hoisted(() => vi.fn())
const campaignMock = vi.hoisted(
  (): { isDm: boolean; campaignData: { id: string } | undefined } => ({
    isDm: true,
    campaignData: { id: 'campaign_1' },
  }),
)
const useCampaignMembersMock = vi.hoisted(() => vi.fn())
const operationsMock = vi.hoisted(() => ({
  setDefaultPermission: vi.fn<ResourceShareOperations['setDefaultPermission']>(),
  setParticipantPermission: vi.fn<ResourceShareOperations['setParticipantPermission']>(),
  clearParticipantPermission: vi.fn<ResourceShareOperations['clearParticipantPermission']>(),
  setFolderInheritShares: vi.fn<ResourceShareOperations['setFolderInheritShares']>(),
}))
const handleErrorMock = vi.hoisted(() => vi.fn())

vi.mock('../use-live-sidebar-items-share-query', () => ({
  useLiveSidebarItemsShareQuery: (itemIds: Array<Id<'sidebarItems'>>) =>
    useLiveSidebarItemsShareQueryMock(itemIds),
}))

vi.mock('~/features/campaigns/hooks/useCampaign', () => ({
  useCampaign: () => ({
    isDm: campaignMock.isDm,
    campaign: { data: campaignMock.campaignData },
  }),
}))

vi.mock('~/features/campaigns/hooks/useCampaignMembers', () => ({
  useCampaignMembers: () => useCampaignMembersMock(),
}))

vi.mock('~/shared/utils/logger', () => ({
  handleError: (...args: Array<unknown>) => handleErrorMock(...args),
}))

function shareQueryItem(
  itemId: Id<'sidebarItems'>,
  overrides: Partial<SidebarShareQueryItem> = {},
): SidebarShareQueryItem {
  return {
    sidebarItemId: itemId,
    allPermissionLevel: null,
    inheritShares: false,
    inheritedAllPermissionLevel: null,
    inheritedFromFolderName: null,
    shares: [],
    memberInheritedPermissions: {},
    memberInheritedFromFolderNames: {},
    ...overrides,
  }
}

function playerMember(memberId: Id<'campaignMembers'>, name = 'Player One') {
  return {
    id: memberId,
    role: 'Player',
    userProfile: { id: `${memberId}_user`, name },
  }
}

function createDeferredPromise() {
  let resolve: () => void = () => undefined
  const promise = new Promise<ReturnType<typeof completedShareCommandResult>>((resolvePromise) => {
    resolve = () => resolvePromise(completedShareCommandResult())
  })
  return { promise, resolve }
}

function renderLiveShareHook(items: Parameters<typeof useLiveSidebarItemsShare>[0]) {
  return renderHook(() => useLiveSidebarItemsShare(items, operationsMock))
}

function completedShareCommandResult() {
  return {
    status: 'completed' as const,
    receipt: {
      transactionId: null,
      direction: 'forward' as const,
      command: {
        type: 'setResourceAudiencePermission' as const,
        itemIds: [],
        permissionLevel: null,
      },
      events: [],
      patches: [],
      summary: {
        kind: 'shared' as const,
        affectedCount: 1,
        createdCount: 0,
        mergedCount: 0,
        skippedCount: 0,
      },
      undoable: true,
    },
  }
}

describe('useLiveSidebarItemsShare', () => {
  beforeEach(() => {
    useLiveSidebarItemsShareQueryMock.mockReset()
    useCampaignMembersMock.mockReset()
    operationsMock.setDefaultPermission.mockReset()
    operationsMock.setParticipantPermission.mockReset()
    operationsMock.clearParticipantPermission.mockReset()
    operationsMock.setFolderInheritShares.mockReset()
    operationsMock.setDefaultPermission.mockResolvedValue(completedShareCommandResult())
    operationsMock.setParticipantPermission.mockResolvedValue(completedShareCommandResult())
    operationsMock.clearParticipantPermission.mockResolvedValue(completedShareCommandResult())
    operationsMock.setFolderInheritShares.mockResolvedValue(completedShareCommandResult())
    handleErrorMock.mockReset()
    campaignMock.isDm = true
    campaignMock.campaignData = { id: 'campaign_1' }
    useLiveSidebarItemsShareQueryMock.mockReturnValue({
      data: [],
      error: null,
      isError: false,
      isPending: false,
      isSuccess: true,
    })
    useCampaignMembersMock.mockReturnValue({
      data: [],
      isSuccess: true,
    })
  })

  it('skips share queries for optimistic sidebar items', () => {
    const item = createNote({ id: 'optimistic-create-1' as Id<'sidebarItems'> })

    const { result } = renderLiveShareHook([item])

    expect(useLiveSidebarItemsShareQueryMock).toHaveBeenCalledWith([])
    expect(result.current.status).toBe('unavailable')
  })

  it('loads persisted share rows for mixed persisted and optimistic selections', () => {
    const persistedItem = createNote({ id: 'note_1' as Id<'sidebarItems'> })
    const optimisticItem = createNote({ id: 'optimistic-create-1' as Id<'sidebarItems'> })
    useLiveSidebarItemsShareQueryMock.mockReturnValue({
      data: [
        shareQueryItem(persistedItem.id, {
          allPermissionLevel: PERMISSION_LEVEL.VIEW,
        }),
      ],
      isPending: false,
      isSuccess: true,
    })

    const { result } = renderLiveShareHook([persistedItem, optimisticItem])

    expect(useLiveSidebarItemsShareQueryMock).toHaveBeenCalledWith(['note_1'])
    expect(result.current.status).toBe('incomplete')
  })

  it('queries share data for persisted sidebar items', () => {
    const item = createNote({ id: 'note_1' as Id<'sidebarItems'> })
    useLiveSidebarItemsShareQueryMock.mockReturnValue({
      data: [shareQueryItem(item.id)],
      isPending: false,
      isSuccess: true,
    })

    const { result } = renderLiveShareHook([item])

    expect(useLiveSidebarItemsShareQueryMock).toHaveBeenCalledWith(['note_1'])
    expect(result.current.status).toBe('ready')
    expect(result.current.shareableItems).toEqual([item])
    expect(result.current.aggregateShareStatus).toBe('not_shared')
  })

  it('loads share rows for large sidebars through the share query boundary', () => {
    const items = Array.from({ length: 101 }, (_, index) =>
      createNote({ id: `note_${index + 1}` as Id<'sidebarItems'> }),
    )
    useLiveSidebarItemsShareQueryMock.mockImplementation((itemIds: Array<Id<'sidebarItems'>>) => ({
      data: itemIds.map((id) => shareQueryItem(id)),
      isPending: false,
      isSuccess: true,
    }))

    const { result } = renderLiveShareHook(items)

    expect(useLiveSidebarItemsShareQueryMock).toHaveBeenCalledWith(items.map((item) => item.id))
    expect(result.current.status).toBe('ready')
  })

  it('keeps sharing unavailable until campaign context is loaded', () => {
    campaignMock.campaignData = undefined
    const item = createNote({ id: 'note_1' as Id<'sidebarItems'> })

    const { result } = renderLiveShareHook([item])

    expect(useLiveSidebarItemsShareQueryMock).toHaveBeenCalledWith([])
    expect(result.current.status).toBe('unavailable')
  })

  it('surfaces share query failures without projecting private state', () => {
    const item = createNote({ id: 'note_1' as Id<'sidebarItems'> })
    const error = new Error('share query failed')
    useLiveSidebarItemsShareQueryMock.mockReturnValue({
      data: undefined,
      error,
      isError: true,
      isPending: false,
      isSuccess: false,
    })

    const { result } = renderLiveShareHook([item])

    expect(result.current.status).toBe('failed')
    expect(result.current.aggregateShareStatus).toBeNull()
    expect('setDefaultPermission' in result.current).toBe(false)
  })

  it('projects loaded share rows into aggregate item state', () => {
    const playerId = 'member_1' as Id<'campaignMembers'>
    const otherPlayerId = 'member_2' as Id<'campaignMembers'>
    const folder = createFolder({ id: 'folder_1' as Id<'sidebarItems'>, name: 'Lore' })
    const firstNote = createNote({
      id: 'note_1' as Id<'sidebarItems'>,
      parentId: folder.id,
    })
    const secondNote = createNote({
      id: 'note_2' as Id<'sidebarItems'>,
      parentId: folder.id,
    })
    useCampaignMembersMock.mockReturnValue({
      data: [playerMember(playerId), playerMember(otherPlayerId, 'Player Two')],
      isSuccess: true,
    })
    useLiveSidebarItemsShareQueryMock.mockReturnValue({
      data: [
        shareQueryItem(firstNote.id, {
          allPermissionLevel: PERMISSION_LEVEL.VIEW,
          inheritedAllPermissionLevel: PERMISSION_LEVEL.EDIT,
          inheritedFromFolderName: 'Lore',
          memberInheritedPermissions: { [otherPlayerId]: PERMISSION_LEVEL.EDIT },
          memberInheritedFromFolderNames: { [otherPlayerId]: 'Lore' },
          shares: [{ campaignMemberId: playerId, permissionLevel: PERMISSION_LEVEL.VIEW }],
        }),
        shareQueryItem(secondNote.id, {
          inheritedFromFolderName: 'Lore',
          memberInheritedPermissions: { [otherPlayerId]: PERMISSION_LEVEL.EDIT },
          memberInheritedFromFolderNames: { [otherPlayerId]: 'Lore' },
          shares: [{ campaignMemberId: playerId, permissionLevel: PERMISSION_LEVEL.EDIT }],
        }),
      ],
      isPending: false,
      isSuccess: true,
    })

    const { result } = renderLiveShareHook([firstNote, secondNote])

    expect(result.current).toMatchObject({
      aggregateShareStatus: 'individually_shared',
      defaultPermissionLevel: 'mixed',
      inheritedAllPermissionLevel: 'mixed',
      inheritedFromFolderName: 'Lore',
      isFolderItem: false,
      inheritShares: false,
      shareItems: [
        {
          participant: { id: playerId },
          shareState: 'all',
          permissionLevel: 'mixed',
          hasExplicitShare: true,
          inheritedPermissionLevel: 'mixed',
        },
        {
          participant: { id: otherPlayerId },
          shareState: 'all',
          permissionLevel: 'mixed',
          hasExplicitShare: false,
          inheritedPermissionLevel: 'mixed',
          inheritedFromFolderName: 'Lore',
        },
      ],
    })
  })

  it('reports mixed share status when selected items combine shared and unshared state', () => {
    const sharedNote = createNote({ id: 'note_1' as Id<'sidebarItems'> })
    const unsharedNote = createNote({ id: 'note_2' as Id<'sidebarItems'> })
    useLiveSidebarItemsShareQueryMock.mockReturnValue({
      data: [
        shareQueryItem(sharedNote.id, {
          allPermissionLevel: PERMISSION_LEVEL.VIEW,
        }),
        shareQueryItem(unsharedNote.id),
      ],
      isPending: false,
      isSuccess: true,
    })

    const { result } = renderLiveShareHook([sharedNote, unsharedNote])

    expect(result.current.aggregateShareStatus).toBe('mixed_shared')
  })

  it('keeps explicit member denies ahead of inherited all-player access', () => {
    const playerId = 'member_1' as Id<'campaignMembers'>
    const item = createNote({ id: 'note_1' as Id<'sidebarItems'> })
    useCampaignMembersMock.mockReturnValue({
      data: [playerMember(playerId)],
      isSuccess: true,
    })
    useLiveSidebarItemsShareQueryMock.mockReturnValue({
      data: [
        shareQueryItem(item.id, {
          inheritedAllPermissionLevel: PERMISSION_LEVEL.VIEW,
          inheritedFromFolderName: 'Lore',
          shares: [{ campaignMemberId: playerId, permissionLevel: PERMISSION_LEVEL.NONE }],
        }),
      ],
      isPending: false,
      isSuccess: true,
    })

    const { result } = renderLiveShareHook([item])

    expect(result.current.shareItems).toEqual([
      expect.objectContaining({
        participant: expect.objectContaining({ id: playerId }),
        shareState: 'none',
        permissionLevel: PERMISSION_LEVEL.NONE,
        hasExplicitShare: true,
        inheritedPermissionLevel: PERMISSION_LEVEL.VIEW,
      }),
    ])
  })

  it('does not count explicit member denies as active individual shares', () => {
    const playerId = 'member_1' as Id<'campaignMembers'>
    const item = createNote({ id: 'note_1' as Id<'sidebarItems'> })
    useCampaignMembersMock.mockReturnValue({
      data: [playerMember(playerId)],
      isSuccess: true,
    })
    useLiveSidebarItemsShareQueryMock.mockReturnValue({
      data: [
        shareQueryItem(item.id, {
          shares: [{ campaignMemberId: playerId, permissionLevel: PERMISSION_LEVEL.NONE }],
        }),
      ],
      isPending: false,
      isSuccess: true,
    })

    const { result } = renderLiveShareHook([item])

    expect(result.current).toMatchObject({
      aggregateShareStatus: 'not_shared',
      shareItems: [
        {
          participant: { id: playerId },
          shareState: 'none',
          permissionLevel: PERMISSION_LEVEL.NONE,
          hasExplicitShare: true,
        },
      ],
    })
  })

  it('marks sharing incomplete when loaded selections are missing item share rows', () => {
    const item = createNote({ id: 'note_1' as Id<'sidebarItems'> })
    const playerId = 'member_1' as Id<'campaignMembers'>
    useCampaignMembersMock.mockReturnValue({
      data: [playerMember(playerId)],
      isSuccess: true,
    })

    const { result } = renderLiveShareHook([item])

    expect(result.current.status).toBe('incomplete')
  })

  it('keeps sharing pending until campaign members load', () => {
    const item = createNote({ id: 'note_1' as Id<'sidebarItems'> })
    useLiveSidebarItemsShareQueryMock.mockReturnValue({
      data: [shareQueryItem(item.id)],
      isPending: false,
      isSuccess: true,
    })
    useCampaignMembersMock.mockReturnValue({
      data: undefined,
      isPending: true,
      isSuccess: false,
    })

    const { result } = renderLiveShareHook([item])

    expect(result.current.status).toBe('loading')
  })

  it('marks sharing unavailable for non-DMs', () => {
    campaignMock.isDm = false
    const item = createNote({ id: 'note_1' as Id<'sidebarItems'> })

    const { result } = renderLiveShareHook([item])

    expect(result.current.status).toBe('unavailable')
    expect(result.current.aggregateShareStatus).toBeNull()
  })

  it('routes all-player share writes through filesystem operations', async () => {
    const item = createNote({ id: 'note_1' as Id<'sidebarItems'> })
    useLiveSidebarItemsShareQueryMock.mockReturnValue({
      data: [shareQueryItem(item.id)],
      isPending: false,
      isSuccess: true,
    })

    const { result } = renderLiveShareHook([item])
    const state = result.current
    expectReadyResourceShareState(state)

    await expect(state.setDefaultPermission(PERMISSION_LEVEL.VIEW)).resolves.toEqual({
      status: 'completed',
    })

    expect(operationsMock.setDefaultPermission).toHaveBeenCalledExactlyOnceWith({
      itemIds: ['note_1'],
      permissionLevel: PERMISSION_LEVEL.VIEW,
    })
  })

  it('reports failed share writes and clears the mutation state', async () => {
    const item = createNote({ id: 'note_1' as Id<'sidebarItems'> })
    const error = new Error('share failed')
    operationsMock.setDefaultPermission.mockRejectedValue(error)
    useLiveSidebarItemsShareQueryMock.mockReturnValue({
      data: [shareQueryItem(item.id)],
      isPending: false,
      isSuccess: true,
    })

    const { result } = renderLiveShareHook([item])
    const state = result.current
    expectReadyResourceShareState(state)

    await expect(state.setDefaultPermission(PERMISSION_LEVEL.VIEW)).resolves.toEqual({
      status: 'failed',
      error,
    })

    expect(handleErrorMock).toHaveBeenCalledWith(error, 'Failed to update share')
    expect(result.current.isMutating).toBe(false)
  })

  it('routes member share writes and clears through filesystem operations', async () => {
    const item = createNote({ id: 'note_1' as Id<'sidebarItems'> })
    const player = {
      id: 'member_1' as Id<'campaignMembers'>,
      role: 'Player',
      userProfile: { id: 'user_1', name: 'Player One' },
    }
    useCampaignMembersMock.mockReturnValue({
      data: [player],
      isSuccess: true,
    })
    useLiveSidebarItemsShareQueryMock.mockReturnValue({
      data: [shareQueryItem(item.id)],
      isPending: false,
      isSuccess: true,
    })

    const { result } = renderLiveShareHook([item])
    const state = result.current
    expectReadyResourceShareState(state)

    await state.setParticipantPermission(player.id, PERMISSION_LEVEL.EDIT)
    await state.clearParticipantPermission(player.id)

    expect(operationsMock.setParticipantPermission).toHaveBeenCalledExactlyOnceWith({
      itemIds: ['note_1'],
      participantId: player.id,
      permissionLevel: PERMISSION_LEVEL.EDIT,
    })
    expect(operationsMock.clearParticipantPermission).toHaveBeenCalledExactlyOnceWith({
      itemIds: ['note_1'],
      participantId: player.id,
    })
  })

  it('keeps sharing mutations pending until overlapping commands settle', async () => {
    const item = createNote({ id: 'note_1' as Id<'sidebarItems'> })
    const player = playerMember('member_1' as Id<'campaignMembers'>)
    const firstCommand = createDeferredPromise()
    const secondCommand = createDeferredPromise()
    let firstWrite: Promise<ShareActionResult> | undefined
    let secondWrite: Promise<ShareActionResult> | undefined
    operationsMock.setDefaultPermission.mockReturnValueOnce(firstCommand.promise)
    operationsMock.setParticipantPermission.mockReturnValueOnce(secondCommand.promise)
    useCampaignMembersMock.mockReturnValue({
      data: [player],
      isSuccess: true,
    })
    useLiveSidebarItemsShareQueryMock.mockReturnValue({
      data: [shareQueryItem(item.id)],
      isPending: false,
      isSuccess: true,
    })

    const { result } = renderLiveShareHook([item])
    const state = result.current
    expectReadyResourceShareState(state)

    act(() => {
      firstWrite = state.setDefaultPermission(PERMISSION_LEVEL.VIEW)
      secondWrite = state.setParticipantPermission(player.id, PERMISSION_LEVEL.EDIT)
    })
    expect(result.current.isMutating).toBe(true)

    await act(async () => {
      firstCommand.resolve()
      await firstWrite
    })
    expect(result.current.isMutating).toBe(true)

    await act(async () => {
      secondCommand.resolve()
      await secondWrite
    })
    expect(result.current.isMutating).toBe(false)
  })

  it('writes an explicit member deny when toggling inherited member access off', async () => {
    const item = createNote({ id: 'note_1' as Id<'sidebarItems'> })
    const player = playerMember('member_1' as Id<'campaignMembers'>)
    useCampaignMembersMock.mockReturnValue({
      data: [player],
      isSuccess: true,
    })
    useLiveSidebarItemsShareQueryMock.mockReturnValue({
      data: [
        shareQueryItem(item.id, {
          inheritedAllPermissionLevel: PERMISSION_LEVEL.VIEW,
          inheritedFromFolderName: 'Lore',
        }),
      ],
      isPending: false,
      isSuccess: true,
    })

    const { result } = renderLiveShareHook([item])
    const state = result.current
    expectReadyResourceShareState(state)

    await act(async () => {
      await state.toggleShareWithParticipant(player.id)
    })

    expect(operationsMock.setParticipantPermission).toHaveBeenCalledExactlyOnceWith({
      itemIds: ['note_1'],
      participantId: player.id,
      permissionLevel: PERMISSION_LEVEL.NONE,
    })
    expect(operationsMock.clearParticipantPermission).not.toHaveBeenCalled()
  })

  it('routes folder inheritance changes through filesystem operations', async () => {
    const folder = createFolder({ id: 'folder_1' as Id<'sidebarItems'> })
    useLiveSidebarItemsShareQueryMock.mockReturnValue({
      data: [{ ...shareQueryItem(folder.id), inheritShares: false }],
      isPending: false,
      isSuccess: true,
    })

    const { result } = renderLiveShareHook([folder])
    const state = result.current
    expectReadyResourceShareState(state)

    expect(state).toMatchObject({
      isFolderItem: true,
      inheritShares: false,
    })

    await state.setInheritShares(true)

    expect(operationsMock.setFolderInheritShares).toHaveBeenCalledExactlyOnceWith({
      folderId: 'folder_1',
      inheritShares: true,
    })
  })
})

function expectReadyResourceShareState(
  state: ResourceShareState,
): asserts state is ReadyResourceShareState {
  expect(state.status).toBe('ready')
}
