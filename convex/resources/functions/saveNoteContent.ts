import * as Y from 'yjs'
import type { ResourceId } from '@wizard-archive/editor/resources/domain-id'
import { advanceNoteContentVersion } from '@wizard-archive/editor/resources/content-version'
import { assertVersionStamp } from '@wizard-archive/editor/resources/component-version'
import {
  NOTE_YJS_FRAGMENT,
  decodeNoteYjsUpdatesToBlocks,
} from '@wizard-archive/editor/notes/document-yjs'
import type { CampaignMutationCtx } from '../../functions'
import { authorizeResourceContent } from './authorizeResourceContent'
import { contentMergeRejection } from './contentVersion'
import type { ContentMergeRejection } from './contentVersion'
import { findNoteContent } from './noteContent'
import { syncNoteSearchProjection } from './resourceSearchProjection'

export type SaveNoteContentResult =
  | {
      status: 'completed'
      resourceId: ResourceId
      update: ArrayBuffer
      version: Awaited<ReturnType<typeof advanceNoteContentVersion>>
    }
  | {
      status: 'rejected'
      reason: 'unauthorized' | 'content_missing' | 'content_corrupt' | 'version_exhausted'
    }

export async function saveNoteContent(
  ctx: CampaignMutationCtx,
  args: { resourceId: ResourceId; update: ArrayBuffer },
): Promise<SaveNoteContentResult> {
  const authorization = await authorizeResourceContent(ctx, args.resourceId, 'note')
  if (authorization.status !== 'authorized') {
    return {
      status: 'rejected',
      reason: authorization.reason === 'unauthorized' ? 'unauthorized' : 'content_corrupt',
    }
  }
  const resourceId = args.resourceId
  const content = await findNoteContent(ctx.db, resourceId)
  if (!content) {
    return { status: 'rejected', reason: 'content_missing' }
  }

  const merged = await mergeNoteUpdate(content.update, args.update, content.version)
  if (merged.status === 'rejected') return merged
  if (merged.version.digest !== content.version.digest) {
    await ctx.db.patch('resourceNoteContents', content._id, {
      update: merged.update,
      version: merged.version,
    })
  }
  await syncNoteSearchProjection(ctx, resourceId, merged.update)
  return { status: 'completed', resourceId, update: merged.update, version: merged.version }
}

async function mergeNoteUpdate(
  current: ArrayBuffer,
  delta: ArrayBuffer,
  currentVersion: unknown,
): Promise<
  | Readonly<{
      status: 'completed'
      update: ArrayBuffer
      version: Awaited<ReturnType<typeof advanceNoteContentVersion>>
    }>
  | ContentMergeRejection
> {
  const document = new Y.Doc()
  try {
    Y.applyUpdate(document, new Uint8Array(current))
    Y.applyUpdate(document, new Uint8Array(delta))
    const update = Uint8Array.from(Y.encodeStateAsUpdate(document)).buffer
    decodeNoteYjsUpdatesToBlocks([{ update }], NOTE_YJS_FRAGMENT)
    const version = await advanceNoteContentVersion(
      assertVersionStamp(currentVersion),
      new Uint8Array(update),
    )
    return { status: 'completed', update, version }
  } catch (error) {
    return contentMergeRejection(error)
  } finally {
    document.destroy()
  }
}
