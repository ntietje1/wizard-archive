import { describe, expect, it, vi } from 'vitest'
import type { MaybePromise } from '../../../../../shared/common/async'
import { PERMISSION_LEVEL } from '../../../../../shared/permissions/types'
import type { ResourceCommandResult } from '../../filesystem/transaction-contract'
import type { AnyItem } from '../../workspace/items'
import { RESOURCE_STATUS, RESOURCE_TYPES } from '../../workspace/items-persistence-contract'
import { createResourceShareRuntimeState } from '../contracts'
import type {
  EditorShareParticipant,
  EditorShareParticipantId,
  ResourceShareOperations,
  ResourceShareProjectionData,
  ResourceShareState,
} from '../contracts'
import { DOMAIN_ID_KIND } from '../../resources/domain-id'
import { testDomainId } from '../../test/domain-id'

const PLAYER_1 = testDomainId(DOMAIN_ID_KIND.campaignMember, 'item_share_player_1')
const PLAYER_2 = testDomainId(DOMAIN_ID_KIND.campaignMember, 'item_share_player_2')

describe('createResourceShareRuntimeState', () => {
  it('keeps missing selected item rows incomplete', () => {
    const state = createResourceShareState({
      shareableItems: [createNoteItem('note-1')],
      itemShareData: [],
      participants: [createPlayerMember(PLAYER_1)],
    })

    expect(state.status).toBe('incomplete')
    expect(state.aggregateShareStatus).toBeNull()
    expect(state.shareItems).toEqual([])
  })

  it('projects mixed selected item shares and inherited member access', () => {
    const state = createResourceShareState({
      shareableItems: [createNoteItem('note-1'), createNoteItem('note-2')],
      itemShareData: [
        createShareData('note-1', {
          allPermissionLevel: PERMISSION_LEVEL.VIEW,
          inheritedAllPermissionLevel: PERMISSION_LEVEL.EDIT,
          inheritedFromFolderName: 'Lore',
          memberInheritedPermissions: { [PLAYER_2]: PERMISSION_LEVEL.EDIT },
          memberInheritedFromFolderNames: { [PLAYER_2]: 'Lore' },
          shares: [{ participantId: PLAYER_1, permissionLevel: PERMISSION_LEVEL.VIEW }],
        }),
        createShareData('note-2', {
          inheritedFromFolderName: 'Lore',
          memberInheritedPermissions: { [PLAYER_2]: PERMISSION_LEVEL.EDIT },
          memberInheritedFromFolderNames: { [PLAYER_2]: 'Lore' },
          shares: [{ participantId: PLAYER_1, permissionLevel: PERMISSION_LEVEL.EDIT }],
        }),
      ],
      participants: [createPlayerMember(PLAYER_1), createPlayerMember(PLAYER_2)],
    })

    expect(state).toMatchObject({
      status: 'ready',
      aggregateShareStatus: 'individually_shared',
      defaultPermissionLevel: 'mixed',
      inheritedAllPermissionLevel: 'mixed',
      inheritedFromFolderName: 'Lore',
      isFolderItem: false,
      inheritShares: false,
      shareItems: [
        {
          participant: { id: PLAYER_1 },
          shareState: 'all',
          permissionLevel: 'mixed',
          hasExplicitShare: true,
          inheritedPermissionLevel: 'mixed',
        },
        {
          participant: { id: PLAYER_2 },
          shareState: 'all',
          permissionLevel: 'mixed',
          hasExplicitShare: false,
          inheritedPermissionLevel: 'mixed',
          inheritedFromFolderName: 'Lore',
        },
      ],
    })
  })

  it('projects folder inheritance only for a single selected folder', () => {
    const state = createResourceShareState({
      shareableItems: [createFolderItem('folder-1')],
      itemShareData: [createShareData('folder-1', { inheritShares: true })],
    })

    expect(state).toMatchObject({
      status: 'ready',
      isFolderItem: true,
      inheritShares: true,
    })
  })

  it('assembles unavailable runtime state before live item shares can load', () => {
    const state = createResourceShareState({
      canLoadShares: false,
      shareableItems: [createNoteItem('note-1')],
      itemShareData: [createShareData('note-1')],
    })

    expect(state.status).toBe('unavailable')
  })

  it('blocks ready runtime commands when live item share mutations cannot run', async () => {
    const operations = createShareOperations()
    const state = createResourceShareState({
      canRunShareMutations: false,
      shareableItems: [createNoteItem('note-1')],
      itemShareData: [createShareData('note-1')],
      operations,
    })

    expectReadyResourceShareState(state)
    await expect(state.setDefaultPermission(PERMISSION_LEVEL.VIEW)).resolves.toEqual({
      status: 'blocked',
      reason: 'not_mutable',
    })
    expect(operations.setDefaultPermission).not.toHaveBeenCalled()
  })

  it('writes an explicit deny when toggling inherited member access off', async () => {
    const item = createNoteItem('note-1')
    const player = createPlayerMember(PLAYER_1)
    const operations = createShareOperations()
    const runShareCommand = vi.fn(
      async (command: () => MaybePromise<ResourceCommandResult>, _errorMessage: string) => {
        await command()
        return { status: 'completed' as const }
      },
    )
    const state = createResourceShareState({
      shareableItems: [item],
      itemShareData: [
        createShareData('note-1', {
          inheritedAllPermissionLevel: PERMISSION_LEVEL.VIEW,
          inheritedFromFolderName: 'Lore',
        }),
      ],
      operations,
      participants: [player],
      runShareCommand,
    })

    expectReadyResourceShareState(state)
    await expect(state.toggleShareWithParticipant(player.id)).resolves.toEqual({
      status: 'completed',
    })

    expect(operations.setParticipantPermission).toHaveBeenCalledExactlyOnceWith({
      itemIds: [item.id],
      participantId: player.id,
      permissionLevel: PERMISSION_LEVEL.NONE,
    })
    expect(operations.clearParticipantPermission).not.toHaveBeenCalled()
  })

  it('keeps incomplete share state read-only without projecting private state', () => {
    const state = createResourceShareState({
      shareableItems: [createNoteItem('note-1')],
      itemShareData: [],
      participants: [createPlayerMember(PLAYER_1)],
      runShareCommand: vi.fn(),
    })

    expect(state.aggregateShareStatus).toBeNull()
    expect(state.shareItems).toEqual([])
    expect('toggleShareStatus' in state).toBe(false)
    expect('toggleShareWithParticipant' in state).toBe(false)
    expect('setDefaultPermission' in state).toBe(false)
  })
})

function expectReadyResourceShareState(
  state: ResourceShareState,
): asserts state is Extract<ResourceShareState, { status: 'ready' }> {
  expect(state.status).toBe('ready')
}

function createResourceShareState({
  canLoadShares = true,
  canRunShareMutations = true,
  isMutating = false,
  itemShareData = [createShareData('note-1')],
  operations = createShareOperations(),
  participants = [],
  participantsLoaded = true,
  runShareCommand = async (command: () => MaybePromise<ResourceCommandResult>) => {
    const result = await command()
    return result.status === 'completed'
      ? { status: 'completed' as const }
      : { status: 'failed' as const }
  },
  shareDataError,
  shareableItems = [createNoteItem('note-1')],
  shareDataLoaded = true,
}: {
  canLoadShares?: boolean
  canRunShareMutations?: boolean
  isMutating?: boolean
  itemShareData?: Array<ResourceShareProjectionData>
  operations?: ResourceShareOperations
  participants?: Array<EditorShareParticipant>
  participantsLoaded?: boolean
  runShareCommand?: Parameters<typeof createResourceShareRuntimeState>[0]['runShareCommand']
  shareDataError?: unknown
  shareableItems?: Array<AnyItem>
  shareDataLoaded?: boolean
} = {}) {
  return createResourceShareRuntimeState({
    canLoadShares,
    canRunShareMutations,
    isMutating,
    itemShareData,
    operations,
    participants,
    participantsLoaded,
    runShareCommand,
    shareDataError,
    shareableItems,
    shareDataLoaded,
  })
}

function createShareData<MemberId extends EditorShareParticipantId = EditorShareParticipantId>(
  itemId: string,
  overrides: Partial<ResourceShareProjectionData<MemberId>> = {},
): ResourceShareProjectionData<MemberId> {
  return {
    sidebarItemId: itemId as AnyItem['id'],
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

function createNoteItem(itemId: string): AnyItem {
  return {
    id: itemId,
    createdAt: 1,
    name: itemId,
    parentId: null,
    status: RESOURCE_STATUS.active,
    type: RESOURCE_TYPES.notes,
  } as AnyItem
}

function createFolderItem(itemId: string): AnyItem {
  return {
    ...createNoteItem(itemId),
    type: RESOURCE_TYPES.folders,
    inheritShares: false,
  } as AnyItem
}

function createPlayerMember<MemberId extends EditorShareParticipantId>(
  memberId: MemberId,
): EditorShareParticipant & { id: MemberId } {
  return {
    id: memberId,
    displayName: String(memberId),
    username: String(memberId),
    imageUrl: null,
  }
}

function createShareOperations(): ResourceShareOperations {
  return {
    setDefaultPermission: vi.fn(() => completedShareCommandResult()),
    setParticipantPermission: vi.fn(() => completedShareCommandResult()),
    clearParticipantPermission: vi.fn(() => completedShareCommandResult()),
    setFolderInheritShares: vi.fn(() => completedShareCommandResult()),
  }
}

function completedShareCommandResult(): ResourceCommandResult {
  return {
    status: 'completed',
    receipt: {
      transactionId: null,
      direction: 'forward',
      command: { type: 'setResourceAudiencePermission', itemIds: [], permissionLevel: null },
      events: [],
      patches: [],
      summary: {
        kind: 'shared',
        affectedCount: 1,
        createdCount: 0,
      },
      undoable: true,
    },
  }
}
