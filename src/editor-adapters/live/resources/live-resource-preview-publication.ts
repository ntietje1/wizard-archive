import type {
  ResourcePreviewPublicationGateway,
  ResourcePreviewPublicationResult,
} from '@wizard-archive/editor/resources/editor-runtime-contract'
import type { ResourceId } from '@wizard-archive/editor/resources/domain-id'
import type { api } from 'convex/_generated/api'
import type { Id } from 'convex/_generated/dataModel'
import type { FunctionReturnType } from 'convex/server'

type PreviewClaim = FunctionReturnType<
  typeof api.resources.mutations.claimResourcePreviewGeneration
>
type PreviewPublication = FunctionReturnType<typeof api.resources.mutations.publishResourcePreview>

export function createLiveResourcePreviewPublicationGateway(operations: {
  claim(resourceId: ResourceId): Promise<PreviewClaim>
  discard(sessionId: Id<'fileStorage'>): Promise<void>
  publish(args: {
    resourceId: ResourceId
    claimToken: string
    uploadSessionId: Id<'fileStorage'>
    byteSize: number
  }): Promise<PreviewPublication>
  upload(source: {
    bytes: Uint8Array
    fileName: string
    mediaType: 'image/webp'
  }): Promise<Id<'fileStorage'>>
}): ResourcePreviewPublicationGateway {
  return {
    publish: async (resourceId, generate, signal) => {
      let sessionId: Id<'fileStorage'> | null = null
      try {
        if (signal?.aborted) return { status: 'stale' }
        const claim = await operations.claim(resourceId)
        if (claim.status === 'unavailable') return unavailableResult(claim.reason)
        if (signal?.aborted) return { status: 'stale' }
        const preview = await generate()
        if (signal?.aborted) return { status: 'stale' }
        if (preview.size <= 0 || preview.type !== 'image/webp') {
          return { status: 'rejected', reason: 'integrity_error' }
        }
        sessionId = await operations.upload({
          bytes: new Uint8Array(await preview.arrayBuffer()),
          fileName: 'resource-preview.webp',
          mediaType: 'image/webp',
        })
        if (signal?.aborted) {
          await discard(operations, sessionId)
          return { status: 'stale' }
        }
        const publication = await operations.publish({
          resourceId,
          claimToken: claim.claimToken,
          uploadSessionId: sessionId,
          byteSize: preview.size,
        })
        if (publication.status === 'published') return publication
        await discard(operations, sessionId)
        if (publication.status === 'stale') return publication
        return {
          status: 'rejected',
          reason:
            publication.reason === 'unauthorized'
              ? ('unauthorized' as const)
              : ('integrity_error' as const),
        }
      } catch (error) {
        if (sessionId) await discard(operations, sessionId)
        return signal?.aborted ? { status: 'stale' } : { status: 'failed', error }
      }
    },
  }
}

function unavailableResult(
  reason: Exclude<PreviewClaim, { status: 'claimed' }>['reason'],
): ResourcePreviewPublicationResult {
  switch (reason) {
    case 'current':
    case 'in_progress':
    case 'unsupported':
      return { status: reason }
    case 'integrity_error':
    case 'unauthorized':
      return { status: 'rejected', reason }
  }
}

async function discard(
  operations: { discard(sessionId: Id<'fileStorage'>): Promise<void> },
  sessionId: Id<'fileStorage'>,
) {
  await operations.discard(sessionId).catch(() => undefined)
}
