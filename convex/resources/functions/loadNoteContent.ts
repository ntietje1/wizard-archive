import type { ResourceId } from '@wizard-archive/editor/resources/domain-id'
import type { CampaignQueryCtx } from '../../functions'
import { authorizeResourceContent } from './authorizeResourceContent'
import { findNoteContent } from './noteContent'

export async function loadNoteContent(ctx: CampaignQueryCtx, resourceId: ResourceId) {
  const authorization = await authorizeResourceContent(ctx, resourceId, 'note')
  if (authorization.status !== 'authorized') return authorization

  const content = await findNoteContent(ctx.db, resourceId)
  if (!content) return { status: 'integrity_error' as const, issue: 'content_missing' as const }
  return content.state === 'initializing'
    ? {
        status: 'initializing' as const,
        operationId: content.initializationOperationUuid,
      }
    : {
        status: 'ready' as const,
        update: content.update,
        version: content.version,
      }
}
