import { describe, expect, it, vi } from 'vitest'
import type { MaybePromise } from '../../../../../shared/common/async'
import type { SidebarItemId } from '../../../../../shared/common/ids'
import { PERMISSION_LEVEL } from '../../../../../shared/permissions/types'
import type { ResourceCommandResult } from '../../filesystem/transaction-contract'
import { createBlocksShareRuntimeState } from '../contracts'
import type {
  BlockShareProjectionData,
  BlocksShareOperations,
  BlocksShareState,
  EditorShareParticipant,
  EditorShareParticipantId,
} from '../contracts'
import { DOMAIN_ID_KIND } from '../../resources/domain-id'
import { testDomainId } from '../../test/domain-id'

const PLAYER_1 = testDomainId(DOMAIN_ID_KIND.campaignMember, 'block_share_player_1')
const PLAYER_2 = testDomainId(DOMAIN_ID_KIND.campaignMember, 'block_share_player_2')

describe('createBlocksShareRuntimeState', () => {
  it('keeps missing selected block rows incomplete', () => {
    const state = createBlockShareState({
      noteBlockIds: ['block-1'],
      data: {
        blocks: [],
        notePermissionsByParticipantId: {},
        participants: [createPlayerMember(PLAYER_1)],
      },
    })

    expect(state.status).toBe('incomplete')
    expect(state.aggregateShareStatus).toBe('not_shared')
    expect(state.shareItems).toEqual([
      expect.objectContaining({
        participant: expect.objectContaining({ id: PLAYER_1 }),
        kind: 'controllable',
        permissionLevel: 'default',
      }),
    ])
  })

  it('projects mixed block visibility and note-edit locks', () => {
    const state = createBlockShareState({
      noteBlockIds: ['block-1', 'block-2'],
      data: {
        blocks: [
          {
            noteBlockId: 'block-1',
            shareStatus: 'all_shared',
            memberPermissions: { [PLAYER_1]: PERMISSION_LEVEL.VIEW },
          },
          {
            noteBlockId: 'block-2',
            shareStatus: 'not_shared',
            memberPermissions: { [PLAYER_1]: PERMISSION_LEVEL.NONE },
          },
        ],
        notePermissionsByParticipantId: {
          [PLAYER_1]: PERMISSION_LEVEL.NONE,
          [PLAYER_2]: PERMISSION_LEVEL.EDIT,
        },
        participants: [createPlayerMember(PLAYER_1), createPlayerMember(PLAYER_2)],
      },
    })

    expect(state).toMatchObject({
      status: 'ready',
      aggregateShareStatus: 'mixed_shared',
      defaultPermissionLevel: 'mixed',
      shareItems: [
        {
          participant: { id: PLAYER_1 },
          kind: 'controllable',
          permissionLevel: 'mixed',
          hasExplicitShare: true,
        },
        {
          participant: { id: PLAYER_2 },
          kind: 'locked_visible',
          permissionLevel: 'visible',
          hasExplicitShare: false,
        },
      ],
    })
  })

  it('assembles unavailable runtime state before live shares can load', () => {
    const state = createBlockShareState({
      canLoadShares: false,
      data: {
        blocks: [
          {
            noteBlockId: 'block-1',
            shareStatus: 'not_shared',
            memberPermissions: {},
          },
        ],
        notePermissionsByParticipantId: {},
        participants: [],
      },
    })

    expect(state.status).toBe('unavailable')
  })

  it('blocks ready runtime commands when live share mutations cannot run', async () => {
    const setBlocksShareStatus = vi.fn()
    const state = createBlockShareState({
      canRunShareMutations: false,
      operations: {
        setBlockParticipantPermission: vi.fn(),
        setBlocksShareStatus,
      },
    })

    expectReadyBlocksShareState(state)
    await expect(state.toggleShareStatus()).resolves.toEqual({
      status: 'blocked',
      reason: 'not_mutable',
    })
    expect(setBlocksShareStatus).not.toHaveBeenCalled()
  })

  it('toggles private blocks through exact block share operations', async () => {
    const setBlocksShareStatus = vi.fn(completedBlockShareCommandResult)
    const noteId = 'note-1' as SidebarItemId
    const state = createBlockShareState({
      noteId,
      operations: {
        setBlockParticipantPermission: vi.fn(),
        setBlocksShareStatus,
      },
    })

    expectReadyBlocksShareState(state)
    await expect(state.toggleShareStatus()).resolves.toEqual({ status: 'completed' })
    expect(setBlocksShareStatus).toHaveBeenCalledWith({
      noteBlockIds: ['block-1'],
      noteId,
      status: 'all_shared',
    })
  })

  it('toggles mixed all-player visibility back to not shared for the full block selection', async () => {
    const setBlocksShareStatus = vi.fn(completedBlockShareCommandResult)
    const noteId = 'note-1' as SidebarItemId
    const state = createBlockShareState({
      noteBlockIds: ['block-1', 'block-2'],
      noteId,
      data: {
        blocks: [
          {
            noteBlockId: 'block-1',
            shareStatus: 'all_shared',
            memberPermissions: {},
          },
          {
            noteBlockId: 'block-2',
            shareStatus: 'not_shared',
            memberPermissions: {},
          },
        ],
        notePermissionsByParticipantId: {},
        participants: [],
      },
      operations: {
        setBlockParticipantPermission: vi.fn(),
        setBlocksShareStatus,
      },
    })

    expectReadyBlocksShareState(state)
    await expect(state.toggleShareStatus()).resolves.toEqual({ status: 'completed' })
    expect(setBlocksShareStatus).toHaveBeenCalledWith({
      noteBlockIds: ['block-1', 'block-2'],
      noteId,
      status: 'not_shared',
    })
  })

  it('returns member share command results to callers', async () => {
    const playerId = PLAYER_1
    const state = createBlockShareState({
      data: {
        blocks: [
          {
            noteBlockId: 'block-1',
            shareStatus: 'not_shared',
            memberPermissions: {},
          },
        ],
        notePermissionsByParticipantId: {},
        participants: [createPlayerMember(playerId)],
      },
      operations: {
        setBlockParticipantPermission: vi.fn(completedBlockShareCommandResult),
        setBlocksShareStatus: vi.fn(),
      },
      runShareCommand: () => Promise.resolve({ status: 'failed' as const }),
    })

    expectReadyBlocksShareState(state)
    await expect(state.setParticipantPermission(playerId, 'visible')).resolves.toEqual({
      status: 'failed',
    })
  })
})

function expectReadyBlocksShareState(
  state: BlocksShareState,
): asserts state is Extract<BlocksShareState, { status: 'ready' }> {
  expect(state.status).toBe('ready')
}

function createBlockShareState({
  noteBlockIds = ['block-1'],
  canLoadShares = true,
  canRunShareMutations = true,
  data = {
    blocks: [
      {
        noteBlockId: 'block-1',
        shareStatus: 'not_shared',
        memberPermissions: {},
      },
    ],
    notePermissionsByParticipantId: {},
    participants: [],
  },
  isMutating = false,
  noteId = 'note-1' as SidebarItemId,
  operations = {
    setBlockParticipantPermission: vi.fn(),
    setBlocksShareStatus: vi.fn(completedBlockShareCommandResult),
  },
  runShareCommand = async (command: () => MaybePromise<ResourceCommandResult>) => {
    const result = await command()
    return result.status === 'completed'
      ? { status: 'completed' as const }
      : { status: 'failed' as const }
  },
}: {
  noteBlockIds?: Array<string>
  canLoadShares?: boolean
  canRunShareMutations?: boolean
  data?: BlockShareProjectionData | undefined
  isMutating?: boolean
  noteId?: SidebarItemId | undefined
  operations?: BlocksShareOperations
  runShareCommand?: Parameters<typeof createBlocksShareRuntimeState>[0]['runShareCommand']
} = {}) {
  return createBlocksShareRuntimeState({
    noteBlockIds,
    canLoadShares,
    canRunShareMutations,
    data,
    isMutating,
    noteId,
    operations,
    runShareCommand,
  })
}

function createPlayerMember<MemberId extends EditorShareParticipantId>(
  memberId: MemberId,
): EditorShareParticipant & { id: MemberId } {
  return {
    id: memberId,
    displayName: memberId,
    username: memberId,
    imageUrl: null,
  }
}

function completedBlockShareCommandResult(): ResourceCommandResult {
  return {
    status: 'completed',
    receipt: {
      transactionId: null,
      direction: 'forward',
      command: {
        type: 'setBlocksShareStatus',
        noteId: 'note-1' as SidebarItemId,
        blockNoteIds: ['block-1'],
        status: 'all_shared',
      },
      events: [],
      patches: [],
      summary: {
        kind: 'shared',
        affectedCount: 1,
        createdCount: 0,
      },
      undoable: false,
    },
  }
}
