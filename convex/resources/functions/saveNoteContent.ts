import * as Y from 'yjs'
import { DOMAIN_ID_KIND, assertDomainId } from '@wizard-archive/editor/resources/domain-id'
import type { ResourceId } from '@wizard-archive/editor/resources/domain-id'
import { advanceNoteContentVersion } from '@wizard-archive/editor/resources/content-version'
import { assertVersionStamp } from '@wizard-archive/editor/resources/component-version'
import {
  NOTE_YJS_FRAGMENT,
  decodeNoteYjsUpdatesToBlocks,
} from '@wizard-archive/editor/notes/document-yjs'
import type { CampaignMutationCtx } from '../../functions'
import { findCanonicalResource } from './findCanonicalResource'
import { findNoteContent } from './noteContent'

export type SaveNoteContentResult =
  | {
      status: 'completed'
      resourceId: ResourceId
      update: ArrayBuffer
      version: Awaited<ReturnType<typeof advanceNoteContentVersion>>
    }
  | {
      status: 'rejected'
      reason:
        | 'invalid_uuid'
        | 'resource_missing'
        | 'ownership_mismatch'
        | 'wrong_kind'
        | 'content_missing'
        | 'content_corrupt'
        | 'version_exhausted'
    }

export async function saveNoteContent(
  ctx: CampaignMutationCtx,
  args: { resourceId: string; update: ArrayBuffer },
): Promise<SaveNoteContentResult> {
  let resourceId: ResourceId
  try {
    resourceId = assertDomainId(DOMAIN_ID_KIND.resource, args.resourceId)
  } catch {
    return { status: 'rejected', reason: 'invalid_uuid' }
  }

  const campaignId = ctx.resourceScope.campaignId
  const resource = await findCanonicalResource(ctx.db, resourceId)
  if (!resource) return { status: 'rejected', reason: 'resource_missing' }
  if (resource.campaignUuid !== campaignId) {
    return { status: 'rejected', reason: 'ownership_mismatch' }
  }
  if (resource.kind !== 'note') return { status: 'rejected', reason: 'wrong_kind' }

  const content = await findNoteContent(ctx.db, resourceId)
  if (!content || content.state !== 'ready') {
    return { status: 'rejected', reason: 'content_missing' }
  }

  const document = new Y.Doc()
  try {
    Y.applyUpdate(document, new Uint8Array(content.update))
    Y.applyUpdate(document, new Uint8Array(args.update))
    const update = Uint8Array.from(Y.encodeStateAsUpdate(document)).buffer
    decodeNoteYjsUpdatesToBlocks([{ update }], NOTE_YJS_FRAGMENT)
    const version = await advanceNoteContentVersion(
      assertVersionStamp(content.version),
      new Uint8Array(update),
    )
    if (version.digest !== content.version.digest) {
      await ctx.db.patch('resourceNoteContents', content._id, { update, version })
    }
    return { status: 'completed', resourceId, update, version }
  } catch (error) {
    return {
      status: 'rejected',
      reason: error instanceof RangeError ? 'version_exhausted' : 'content_corrupt',
    }
  } finally {
    document.destroy()
  }
}
