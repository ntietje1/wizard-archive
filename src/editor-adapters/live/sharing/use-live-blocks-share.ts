import { api } from 'convex/_generated/api'
import { useConvex } from '@convex-dev/react-query'
import { useMutation } from '@tanstack/react-query'
import type { CampaignMemberSummary } from 'shared/campaigns/types'
import type { ShareStatus } from 'shared/block-shares/share-status'
import type { PermissionLevel } from 'shared/permissions/types'
import type {
  BlockShareProjectionData,
  BlockShareTargetBlock,
  BlockShareTargetNote,
  BlocksShareOperations,
  BlocksShareState,
  EditorPermissionLevel,
} from '@wizard-archive/editor/sharing'
import type { CampaignMemberId } from '@wizard-archive/editor/resources/domain-id'
import { createBlocksShareRuntimeState } from '@wizard-archive/editor/sharing'
import {
  isPersistedWizardEditorItem,
  readWizardEditorResourceTransactionReceipt,
} from '@wizard-archive/editor/adapter'
import { useCampaignQuery } from '~/shared/hooks/useCampaignQuery'
import { useCampaign } from '~/features/campaigns/hooks/useCampaign'
import { canLoadLiveShareData, canRunLiveShareMutation } from './share-capability'
import { useShareMutationRunner } from './use-share-mutation-runner'
import { toEditorShareParticipant } from '~/editor-adapters/sharing/share-participants'

type BlockVisibilityLevel = Extract<PermissionLevel, 'none' | 'view'>
type BlockShareStatus = ShareStatus
type BlockShareCommandResult = Awaited<ReturnType<BlocksShareOperations['setBlocksShareStatus']>>

interface SetBlocksShareStatusInput {
  noteId: BlockShareTargetNote['id']
  noteBlockIds: Array<string>
  status: BlockShareStatus
}

interface SetBlockMemberPermissionInput {
  noteId: BlockShareTargetNote['id']
  noteBlockIds: Array<string>
  participantId: CampaignMemberId
  permissionLevel: BlockVisibilityLevel | null
}

export function useLiveBlocksShare(
  blocks: Array<BlockShareTargetBlock>,
  note: BlockShareTargetNote | undefined,
): BlocksShareState {
  const { campaignId: workspaceRecordId, isDm } = useCampaign()
  const convex = useConvex()
  const noteBlockIds = blocks.map((b) => b.id)
  const hasPersistedNote = isPersistedWizardEditorItem(note)
  const hasBlocks = noteBlockIds.length > 0
  const { isMutating, runShareCommand } = useShareMutationRunner()
  const canLoadShares = canLoadLiveShareData({
    hasPersistedTarget: hasPersistedNote,
    hasShareTargets: hasBlocks,
    isDm,
    workspaceRecordId,
  })

  const query = useCampaignQuery(
    api.blocks.queries.getBlocksWithShares,
    note && canLoadShares ? { noteId: note.id, blockNoteIds: noteBlockIds } : 'skip',
  )

  const setBlocksShareStatus = useMutation({
    mutationFn: (args: SetBlocksShareStatusInput) => {
      if (!workspaceRecordId) throw new Error('Block sharing requires a workspace context')
      return convex.action(api.blockShares.actions.setBlocksShareStatus, {
        campaignId: workspaceRecordId,
        noteId: args.noteId,
        blockNoteIds: args.noteBlockIds,
        status: args.status,
      })
    },
  })
  const setBlockMemberPermission = useMutation({
    mutationFn: (args: SetBlockMemberPermissionInput) => {
      if (!workspaceRecordId) throw new Error('Block sharing requires a workspace context')
      return convex.action(api.blockShares.actions.setBlockMemberPermission, {
        campaignId: workspaceRecordId,
        noteId: args.noteId,
        blockNoteIds: args.noteBlockIds,
        campaignMemberId: args.participantId,
        permissionLevel: args.permissionLevel,
      })
    },
  })

  const operations: BlocksShareOperations = {
    setBlockParticipantPermission: async (input) => {
      return normalizeBlockShareCommandResult(
        await setBlockMemberPermission.mutateAsync({
          ...input,
          participantId: input.participantId,
        }),
      )
    },
    setBlocksShareStatus: async (input) => {
      return normalizeBlockShareCommandResult(await setBlocksShareStatus.mutateAsync(input))
    },
  }
  return createBlocksShareRuntimeState({
    noteBlockIds,
    canLoadShares,
    canRunShareMutations: canRunLiveShareMutation({
      hasPersistedTarget: hasPersistedNote,
      hasShareTargets: hasBlocks,
      isMutating,
      isDm,
      workspaceRecordId,
    }),
    data: query.isPending ? undefined : toEditorBlockShareProjectionData(query.data),
    isMutating,
    noteId: note?.id,
    operations,
    runShareCommand,
  })
}

function toEditorBlockShareProjectionData(
  data:
    | {
        blocks?: BlockShareProjectionData<CampaignMemberId>['blocks']
        notePermissionsByMemberId?: Partial<Record<CampaignMemberId, EditorPermissionLevel>>
        playerMembers?: Array<CampaignMemberSummary>
      }
    | null
    | undefined,
): BlockShareProjectionData<CampaignMemberId> | undefined {
  if (!data) return undefined

  return {
    blocks: data.blocks,
    notePermissionsByParticipantId: data.notePermissionsByMemberId,
    participants: data.playerMembers?.map(toEditorShareParticipant),
  }
}

function normalizeBlockShareCommandResult(result: unknown): BlockShareCommandResult {
  if (isBlockShareCommandResult(result)) return result
  const receipt = readWizardEditorResourceTransactionReceipt(result)
  if (receipt) return { status: 'completed', receipt }
  return { status: 'error', error: new Error('Block share command did not return a receipt') }
}

function isBlockShareCommandResult(result: unknown): result is BlockShareCommandResult {
  return (
    isRecord(result) &&
    typeof result.status === 'string' &&
    ['completed', 'rejected', 'unsupported', 'unavailable', 'error'].includes(result.status)
  )
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}
