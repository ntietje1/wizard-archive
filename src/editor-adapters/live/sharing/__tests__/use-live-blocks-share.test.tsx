import { testResourceId } from '../../../../../shared/test/resource-id'
import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vite-plus/test'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useLiveBlocksShare } from '../use-live-blocks-share'
import { testId } from '~/test/helpers/test-id'
import type {
  BlockShareTargetBlock,
  BlockShareTargetNote,
  ShareActionResult,
} from '@wizard-archive/editor/sharing'
import type { ReactNode } from 'react'
import { testOperationId } from '../../../../../shared/test/operation-id'
import { testCampaignMemberId } from '../../../../../shared/test/campaign-member-id'
import type { CampaignMemberId, ResourceId } from '@wizard-archive/editor/resources/domain-id'

const useCampaignQueryMock = vi.hoisted(() => vi.fn())
const convexActionMock = vi.hoisted(() => vi.fn())
const campaignState = vi.hoisted(() => ({
  isDm: true,
  campaignId: 'campaign-id' as string | undefined,
}))

vi.mock('convex/_generated/api', () => ({
  api: {
    blocks: {
      queries: { getBlocksWithShares: 'getBlocksWithShares' },
    },
    blockShares: {
      actions: {
        setBlocksShareStatus: 'setBlocksShareStatus',
        setBlockMemberPermission: 'setBlockMemberPermission',
      },
    },
  },
}))

vi.mock('~/shared/hooks/useCampaignQuery', () => ({
  useCampaignQuery: (...args: Array<unknown>) => useCampaignQueryMock(...args),
}))

vi.mock('@convex-dev/react-query', () => ({
  useConvex: () => ({
    action: convexActionMock,
  }),
}))

vi.mock('~/features/campaigns/hooks/useCampaign', () => ({
  useCampaign: () => ({
    campaignId: campaignState.campaignId,
    isDm: campaignState.isDm,
  }),
}))

describe('useLiveBlocksShare', () => {
  beforeEach(() => {
    useCampaignQueryMock.mockReset()
    convexActionMock.mockReset()
    convexActionMock.mockResolvedValue({
      transactionId: testOperationId('transaction-1'),
      direction: 'forward',
      command: { type: 'setBlocksShareStatus' },
      events: [],
      patches: [],
      summary: {
        kind: 'shared',
        affectedCount: 1,
        createdCount: 0,
      },
      undoable: false,
    })
    campaignState.isDm = true
    campaignState.campaignId = 'campaign-id'
    useCampaignQueryMock.mockReturnValue({
      data: { blocks: [], playerMembers: [], notePermissionsByMemberId: {} },
      isPending: false,
    })
  })

  it('queries block shares for the provided embedded note', () => {
    const block = createBlock('block-1')
    const note = createNoteWithContent()

    renderHook(() => useLiveBlocksShare([block], note), { wrapper: createQueryWrapper() })

    expect(useCampaignQueryMock).toHaveBeenCalledWith('getBlocksWithShares', {
      noteId: note.id,
      blockNoteIds: ['block-1'],
    })
  })

  it.each([
    {
      name: 'non-DMs',
      blocks: [createBlock('block-1')],
      note: createNoteWithContent(),
      setup: () => {
        campaignState.isDm = false
      },
    },
    {
      name: 'missing campaign context',
      blocks: [createBlock('block-1')],
      note: createNoteWithContent(),
      setup: () => {
        campaignState.campaignId = undefined
      },
    },
    {
      name: 'optimistic notes',
      blocks: [createBlock('block-1')],
      note: createNoteWithContent('optimistic-note-1'),
      setup: () => {},
    },
    {
      name: 'empty block selections',
      blocks: [],
      note: createNoteWithContent(),
      setup: () => {},
    },
  ])('skips queries and mutations for $name', ({ blocks, note, setup }) => {
    setup()

    const { result } = renderHook(() => useLiveBlocksShare(blocks, note), {
      wrapper: createQueryWrapper(),
    })

    expect(useCampaignQueryMock).toHaveBeenCalledWith('getBlocksWithShares', 'skip')
    expect(result.current.status).toBe('unavailable')
  })

  it('uses projection-aware block share actions', async () => {
    const block = createBlock('block-1')
    const note = createNoteWithContent()
    useCampaignQueryMock.mockReturnValue({
      data: {
        blocks: [
          {
            noteBlockId: 'block-1',
            shareStatus: null,
            memberPermissions: {},
          },
        ],
        playerMembers: [],
        notePermissionsByMemberId: {},
      },
      isPending: false,
    })

    const { result } = renderHook(() => useLiveBlocksShare([block], note), {
      wrapper: createQueryWrapper(),
    })

    const state = result.current
    expect(state.status).toBe('ready')
    if (state.status !== 'ready') throw new Error('Expected ready block share state')

    await act(async () => {
      await state.toggleShareStatus()
    })

    expect(convexActionMock).toHaveBeenCalledWith('setBlocksShareStatus', {
      campaignId: 'campaign-id',
      noteId: note.id,
      blockNoteIds: ['block-1'],
      status: 'all_shared',
    })
  })

  it('keeps block share mutations pending until overlapping writes settle', async () => {
    const block = createBlock('block-1')
    const note = createNoteWithContent()
    const firstCommand = createDeferredPromise()
    const secondCommand = createDeferredPromise()
    let firstWrite: Promise<ShareActionResult> | undefined
    let secondWrite: Promise<ShareActionResult> | undefined
    convexActionMock
      .mockReturnValueOnce(firstCommand.promise)
      .mockReturnValueOnce(secondCommand.promise)
    useCampaignQueryMock.mockReturnValue({
      data: {
        blocks: [
          {
            noteBlockId: 'block-1',
            shareStatus: null,
            memberPermissions: {},
          },
        ],
        playerMembers: [],
        notePermissionsByMemberId: {},
      },
      isPending: false,
    })

    const { result } = renderHook(() => useLiveBlocksShare([block], note), {
      wrapper: createQueryWrapper(),
    })

    const state = result.current
    expect(state.status).toBe('ready')
    if (state.status !== 'ready') throw new Error('Expected ready block share state')

    act(() => {
      firstWrite = state.toggleShareStatus()
      secondWrite = state.toggleShareStatus()
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

  it('keeps loading block shares non-ready until share rows load', () => {
    const block = createBlock('block-1')
    const note = createNoteWithContent()
    useCampaignQueryMock.mockReturnValue({
      data: { blocks: [], playerMembers: [], notePermissionsByMemberId: {} },
      isPending: true,
    })

    const { result } = renderHook(() => useLiveBlocksShare([block], note), {
      wrapper: createQueryWrapper(),
    })

    expect(result.current.status).toBe('loading')
  })

  it('sets player block visibility through the projection-aware action', async () => {
    const block = createBlock('block-1')
    const note = createNoteWithContent()
    const playerId = testCampaignMemberId('live_blocks_player_1')
    useCampaignQueryMock.mockReturnValue({
      data: {
        blocks: [
          {
            noteBlockId: 'block-1',
            shareStatus: 'not_shared',
            memberPermissions: {},
          },
        ],
        playerMembers: [createPlayerMember(playerId)],
        notePermissionsByMemberId: { [playerId]: 'view' },
      },
      isPending: false,
    })

    const { result } = renderHook(() => useLiveBlocksShare([block], note), {
      wrapper: createQueryWrapper(),
    })

    const state = result.current
    expect(state.status).toBe('ready')
    if (state.status !== 'ready') throw new Error('Expected ready block share state')

    await act(async () => {
      await state.setParticipantPermission(playerId, 'visible')
    })

    expect(convexActionMock).toHaveBeenCalledWith('setBlockMemberPermission', {
      campaignId: 'campaign-id',
      noteId: note.id,
      blockNoteIds: ['block-1'],
      campaignMemberId: playerId,
      permissionLevel: 'view',
    })
  })

  it('projects mixed block visibility and edit-access players from the live source', () => {
    const firstBlock = createBlock('block-1')
    const secondBlock = createBlock('block-2')
    const note = createNoteWithContent()
    const playerId = testCampaignMemberId('live_blocks_mixed_player')
    const editorId = testCampaignMemberId('live_blocks_mixed_editor')
    useCampaignQueryMock.mockReturnValue({
      data: {
        blocks: [
          {
            noteBlockId: 'block-1',
            shareStatus: 'all_shared',
            memberPermissions: { [playerId]: 'view' },
          },
          {
            noteBlockId: 'block-2',
            shareStatus: 'not_shared',
            memberPermissions: { [playerId]: 'none' },
          },
        ],
        playerMembers: [createPlayerMember(playerId), createPlayerMember(editorId)],
        notePermissionsByMemberId: { [playerId]: 'none', [editorId]: 'edit' },
      },
      isPending: false,
    })

    const { result } = renderHook(() => useLiveBlocksShare([firstBlock, secondBlock], note), {
      wrapper: createQueryWrapper(),
    })

    expect(result.current).toMatchObject({
      status: 'ready',
      aggregateShareStatus: 'mixed_shared',
      defaultPermissionLevel: 'mixed',
      shareItems: [
        {
          participant: { id: playerId },
          kind: 'controllable',
          permissionLevel: 'mixed',
          hasExplicitShare: true,
        },
        {
          participant: { id: editorId },
          kind: 'locked_visible',
          permissionLevel: 'visible',
          hasExplicitShare: false,
        },
      ],
    })
  })

  it('exposes players without note access as controllable block-share rows', async () => {
    const block = createBlock('block-1')
    const note = createNoteWithContent()
    const playerId = testCampaignMemberId('live_blocks_permission_player')
    useCampaignQueryMock.mockReturnValue({
      data: {
        blocks: [
          {
            noteBlockId: 'block-1',
            shareStatus: 'not_shared',
            memberPermissions: {},
          },
        ],
        playerMembers: [createPlayerMember(playerId)],
        notePermissionsByMemberId: { [playerId]: 'none' },
      },
      isPending: false,
    })

    const { result } = renderHook(() => useLiveBlocksShare([block], note), {
      wrapper: createQueryWrapper(),
    })

    const state = result.current
    expect(state.status).toBe('ready')
    if (state.status !== 'ready') throw new Error('Expected ready block share state')

    expect(state.shareItems[0]?.kind).toBe('controllable')
    expect(state.shareItems[0]?.permissionLevel).toBe('default')

    await act(async () => {
      await state.setParticipantPermission(playerId, 'visible')
    })

    expect(convexActionMock).toHaveBeenCalledWith('setBlockMemberPermission', {
      campaignId: 'campaign-id',
      noteId: note.id,
      blockNoteIds: ['block-1'],
      campaignMemberId: playerId,
      permissionLevel: 'view',
    })
  })

  it('does not count explicit hidden member permissions as individual block shares', () => {
    const block = createBlock('block-1')
    const note = createNoteWithContent()
    const playerId = testCampaignMemberId('live_blocks_hidden_player')
    useCampaignQueryMock.mockReturnValue({
      data: {
        blocks: [
          {
            noteBlockId: 'block-1',
            shareStatus: 'not_shared',
            memberPermissions: { [playerId]: 'none' },
          },
        ],
        playerMembers: [createPlayerMember(playerId)],
        notePermissionsByMemberId: { [playerId]: 'none' },
      },
      isPending: false,
    })

    const { result } = renderHook(() => useLiveBlocksShare([block], note), {
      wrapper: createQueryWrapper(),
    })

    const state = result.current
    expect(state.status).toBe('ready')
    if (state.status !== 'ready') throw new Error('Expected ready block share state')

    expect(state.aggregateShareStatus).toBe('not_shared')
    expect(state.shareItems[0]).toMatchObject({
      participant: { id: playerId },
      kind: 'controllable',
      permissionLevel: 'hidden',
      hasExplicitShare: true,
    })
  })

  it('toggles individually shared hidden blocks back to not shared', async () => {
    const block = createBlock('block-1')
    const note = createNoteWithContent()
    const playerId = testCampaignMemberId('live_blocks_visible_player')
    useCampaignQueryMock.mockReturnValue({
      data: {
        blocks: [
          {
            noteBlockId: 'block-1',
            shareStatus: 'not_shared',
            memberPermissions: { [playerId]: 'view' },
          },
        ],
        playerMembers: [createPlayerMember(playerId)],
        notePermissionsByMemberId: { [playerId]: 'none' },
      },
      isPending: false,
    })

    const { result } = renderHook(() => useLiveBlocksShare([block], note), {
      wrapper: createQueryWrapper(),
    })

    const state = result.current
    expect(state.status).toBe('ready')
    if (state.status !== 'ready') throw new Error('Expected ready block share state')

    expect(state.aggregateShareStatus).toBe('individually_shared')

    await act(async () => {
      await state.toggleShareStatus()
    })

    expect(convexActionMock).toHaveBeenCalledWith('setBlocksShareStatus', {
      campaignId: 'campaign-id',
      noteId: note.id,
      blockNoteIds: ['block-1'],
      status: 'not_shared',
    })
  })
})

function createBlock(id: string): BlockShareTargetBlock {
  return { id }
}

function createQueryWrapper() {
  const queryClient = new QueryClient()
  return function QueryWrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  }
}

function createDeferredPromise() {
  let resolve: () => void = () => undefined
  const promise = new Promise<{
    transactionId: string
    direction: 'forward'
    command: { type: 'setBlocksShareStatus' }
    events: []
    patches: []
    summary: {
      kind: 'shared'
      affectedCount: number
      createdCount: number
    }
    undoable: boolean
  }>((resolvePromise) => {
    resolve = () =>
      resolvePromise({
        transactionId: testOperationId('transaction-1'),
        direction: 'forward',
        command: { type: 'setBlocksShareStatus' },
        events: [],
        patches: [],
        summary: {
          kind: 'shared',
          affectedCount: 1,
          createdCount: 0,
        },
        undoable: false,
      })
  })
  return { promise, resolve }
}

function createNoteWithContent(id = 'embedded-note-id'): BlockShareTargetNote {
  return { id: id.startsWith('optimistic-') ? (id as ResourceId) : testResourceId(id) }
}

function createPlayerMember(memberId: CampaignMemberId) {
  return {
    id: memberId,
    createdAt: 1,
    campaignId: testId<'campaigns'>('campaign-1'),
    userId: testId<'userProfiles'>('user-1'),
    role: 'Player',
    status: 'Accepted',
    userProfile: {
      id: testId<'userProfiles'>('user-1'),
      createdAt: 1,
      authUserId: 'auth-user-1',
      email: 'player@example.com',
      emailVerified: null,
      imageUrl: null,
      name: 'Player One',
      twoFactorEnabled: null,
      username: 'player-one',
    },
  } as const
}
