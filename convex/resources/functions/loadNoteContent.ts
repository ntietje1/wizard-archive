import type { ResourceId } from '@wizard-archive/editor/resources/domain-id'
import { assertVersionStamp } from '@wizard-archive/editor/resources/component-version'
import { noteContentProjectionVersion } from '@wizard-archive/editor/resources/content-version'
import type { CampaignQueryCtx } from '../../functions'
import { authorizeResourceContent } from './authorizeResourceContent'
import {
  assertContentGeneration,
  INITIAL_CONTENT_GENERATION,
} from '@wizard-archive/editor/resources/content-generation'
import { findNoteContent } from './noteContent'
import { filterNoteContentForMember } from './noteBlockAccess'

export async function loadNoteContent(ctx: CampaignQueryCtx, resourceId: ResourceId) {
  const authorization = await authorizeResourceContent(ctx, resourceId, 'note')
  if (authorization.status !== 'authorized') return authorization

  const content = await findNoteContent(ctx.db, resourceId)
  if (!content) return { status: 'integrity_error' as const, issue: 'content_missing' as const }
  const canonicalVersion = assertVersionStamp(content.version)
  if (ctx.resourceScope.projection !== 'dm' && authorization.permission !== 'edit') {
    const projection = await filterNoteContentForMember(
      ctx,
      resourceId,
      ctx.resourceScope.actorId,
      authorization.permission,
    )
    if (projection.status === 'integrity_error') {
      return { status: 'integrity_error' as const, issue: 'content_corrupt' as const }
    }
    if (projection.status === 'capacity_exceeded') {
      return { status: 'integrity_error' as const, issue: 'content_limit_exceeded' as const }
    }
    if (projection.status === 'empty') {
      return { status: 'empty' as const, reason: 'no_visible_blocks' as const }
    }
    return {
      status: 'ready' as const,
      generation: assertContentGeneration(content.generation ?? INITIAL_CONTENT_GENERATION),
      update: projection.update,
      version: projection.complete
        ? canonicalVersion
        : await noteContentProjectionVersion(canonicalVersion, new Uint8Array(projection.update)),
    }
  }
  return {
    status: 'ready' as const,
    generation: assertContentGeneration(content.generation ?? INITIAL_CONTENT_GENERATION),
    update: content.update,
    version: canonicalVersion,
  }
}
