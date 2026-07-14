import { CAMPAIGN_MEMBER_ROLE } from '../../../shared/campaigns/types'
import type { ResourceId } from '@wizard-archive/editor/resources/domain-id'
import type { CampaignQueryCtx } from '../../functions'
import { findCanonicalResource } from './findCanonicalResource'
import { findNoteContent } from './noteContent'

export async function loadNoteContent(ctx: CampaignQueryCtx, resourceId: ResourceId) {
  const resource = await findCanonicalResource(ctx.db, resourceId)
  if (!resource || resource.campaignUuid !== ctx.resourceScope.campaignId) {
    return { status: 'unavailable' as const, reason: 'unauthorized' as const }
  }
  if (resource.kind !== 'note') {
    return { status: 'unavailable' as const, reason: 'capability_not_supported' as const }
  }
  if (ctx.membership.role !== CAMPAIGN_MEMBER_ROLE.DM) {
    return { status: 'unavailable' as const, reason: 'unauthorized' as const }
  }

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
