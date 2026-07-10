import type { Id } from 'convex/_generated/dataModel'

interface LiveShareCapabilityInput {
  workspaceRecordId: Id<'campaigns'> | undefined
  hasPersistedTarget: boolean
  hasShareTargets: boolean
  isDm: boolean | undefined
}

interface LiveShareMutationCapabilityInput extends LiveShareCapabilityInput {
  isMutating: boolean
}

export function canLoadLiveShareData({
  hasPersistedTarget,
  hasShareTargets,
  isDm,
  workspaceRecordId,
}: LiveShareCapabilityInput): boolean {
  return Boolean(workspaceRecordId) && Boolean(isDm) && hasPersistedTarget && hasShareTargets
}

export function canRunLiveShareMutation({
  isMutating,
  ...input
}: LiveShareMutationCapabilityInput): boolean {
  return canLoadLiveShareData(input) && !isMutating
}
