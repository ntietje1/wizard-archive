import type {
  ContentExportResult,
  ContentRecovery,
} from '@wizard-archive/editor/resources/content-session-contract'
import { assertContentGeneration } from '@wizard-archive/editor/resources/content-generation'
import type { ContentGeneration } from '@wizard-archive/editor/resources/content-generation'
import { assertVersionStamp } from '@wizard-archive/editor/resources/component-version'
import type { VersionStamp } from '@wizard-archive/editor/resources/component-version'
import type {
  CampaignId,
  CampaignMemberId,
  OperationId,
  ResourceId,
} from '@wizard-archive/editor/resources/domain-id'
import { createYjsUpdateOutbox } from './yjs-update-outbox'

type RecoveryLoadResult =
  | Readonly<{ status: 'ready'; generation: number; version: unknown }>
  | Readonly<{
      status: 'empty' | 'initializing' | 'integrity_error' | 'loading' | 'unavailable'
      reason?: string
    }>

type RecoveryReapply = (args: {
  campaignId: CampaignId
  expectedGeneration: ContentGeneration
  expectedVersion: VersionStamp
  operationId: OperationId
  resourceId: ResourceId
  snapshotUpdate: ArrayBuffer
  snapshotVersion: VersionStamp
}) => Promise<
  | Readonly<{ status: 'completed' }>
  | Readonly<{
      status: 'rejected'
      reason:
        | 'content_changed'
        | 'operation_id_reused'
        | 'resource_unavailable'
        | 'snapshot_incompatible'
        | 'scope_unavailable'
        | 'unauthorized'
    }>
>

export function createLiveYjsRecovery(
  options: Readonly<{
    kind: 'canvas' | 'note'
    campaignId: CampaignId
    memberId: CampaignMemberId
    resourceId: ResourceId
    load(): Promise<RecoveryLoadResult>
    reapply: RecoveryReapply
    reload(): void
    exportArtifact(update: Uint8Array): ContentExportResult
    versionArtifact(update: Uint8Array): Promise<VersionStamp>
  }>,
): ContentRecovery | null {
  const outbox = createYjsUpdateOutbox(
    options.kind,
    options.campaignId,
    options.resourceId,
    options.memberId,
  )
  const stored = outbox.load()
  const entry = stored.status === 'available' ? stored.entry : null
  if (!entry || entry.state !== 'recovery') {
    return null
  }
  const artifact = Uint8Array.from(entry.update)
  const clear = () => {
    if (outbox.clear().status !== 'accepted') {
      return { status: 'rejected', reason: 'scope_unavailable' } as const
    }
    options.reload()
    return { status: 'completed' } as const
  }
  return {
    export: () => options.exportArtifact(artifact),
    reapply: async () => {
      try {
        const snapshot = await options.load()
        if (snapshot.status !== 'ready') {
          return {
            status: 'rejected',
            reason:
              snapshot.status === 'unavailable'
                ? snapshot.reason === 'unauthorized'
                  ? 'unauthorized'
                  : 'scope_unavailable'
                : 'resource_unavailable',
          }
        }
        const result = await options.reapply({
          campaignId: options.campaignId,
          expectedGeneration: assertContentGeneration(snapshot.generation),
          expectedVersion: assertVersionStamp(snapshot.version),
          operationId: entry.operationId,
          resourceId: options.resourceId,
          snapshotUpdate: Uint8Array.from(artifact).buffer,
          snapshotVersion: await options.versionArtifact(artifact),
        })
        return result.status === 'completed' ? clear() : result
      } catch {
        return { status: 'rejected', reason: 'scope_unavailable' }
      }
    },
    discard: clear,
  }
}
