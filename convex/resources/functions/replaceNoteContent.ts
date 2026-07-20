import {
  advanceContentGeneration,
  assertContentGeneration,
  INITIAL_CONTENT_GENERATION,
} from '@wizard-archive/editor/resources/content-generation'
import {
  assertVersionStamp,
  successorVersion,
} from '@wizard-archive/editor/resources/component-version'
import { initialNoteContentVersion } from '@wizard-archive/editor/resources/content-version'
import type { ResourceId } from '@wizard-archive/editor/resources/domain-id'
import {
  NOTE_YJS_FRAGMENT,
  decodeNoteYjsUpdatesToBlocks,
  noteYjsEncodedBytesWithinLimit,
} from '@wizard-archive/editor/notes/document-yjs'
import { noteAuthoredDestinationOccurrences } from '@wizard-archive/editor/notes/authored-destinations'
import type { CampaignMutationCtx } from '../../functions'
import { findNoteContent } from './noteContent'
import { flattenNoteBlockIds } from './noteBlockAccess'
import { queueNoteBlockAccessCleanup } from './noteBlockAccessCleanup'
import { replaceResourceReferenceProjection } from './resourceReferences'
import { syncNoteSearchProjection } from './resourceSearchProjection'
import { resolveReplacementTarget } from './replacementTarget'

export async function replaceNoteContent(
  ctx: CampaignMutationCtx,
  args: Readonly<{
    resourceId: ResourceId
    expectedVersion: unknown
    snapshotUpdate: ArrayBuffer
    snapshotVersion: unknown
  }>,
) {
  const currentRow = await findNoteContent(ctx.db, args.resourceId)
  const target = resolveReplacementTarget(
    currentRow,
    ctx.resourceScope.campaignId,
    args.expectedVersion,
  )
  if (target.status !== 'ready') return target
  const { current } = target
  const currentVersion = target.version

  const snapshotVersion = assertVersionStamp(args.snapshotVersion)
  if (!noteYjsEncodedBytesWithinLimit(args.snapshotUpdate)) {
    return { status: 'snapshot_incompatible' as const }
  }
  let blocks
  let currentBlockIds
  try {
    blocks = decodeNoteYjsUpdatesToBlocks([{ update: args.snapshotUpdate }], NOTE_YJS_FRAGMENT)
    currentBlockIds = new Set(
      flattenNoteBlockIds(
        decodeNoteYjsUpdatesToBlocks([{ update: current.update }], NOTE_YJS_FRAGMENT),
      ),
    )
  } catch {
    return { status: 'snapshot_incompatible' as const }
  }
  if (
    (await initialNoteContentVersion(new Uint8Array(args.snapshotUpdate))).digest !==
    snapshotVersion.digest
  ) {
    return { status: 'snapshot_incompatible' as const }
  }
  const version = successorVersion(currentVersion, snapshotVersion.digest)
  const references = await replaceResourceReferenceProjection(ctx, {
    campaignId: ctx.resourceScope.campaignId,
    sourceResourceId: args.resourceId,
    sourceVersion: version,
    occurrences: noteAuthoredDestinationOccurrences(blocks),
  })
  if (references.status !== 'completed') {
    return { status: 'snapshot_incompatible' as const }
  }

  for (const blockId of flattenNoteBlockIds(blocks)) currentBlockIds.delete(blockId)
  const generation = advanceContentGeneration(
    assertContentGeneration(current.generation ?? INITIAL_CONTENT_GENERATION),
  )
  await ctx.db.patch('resourceNoteContents', current._id, {
    generation,
    update: args.snapshotUpdate,
    version,
  })
  await queueNoteBlockAccessCleanup(ctx, args.resourceId, version, currentBlockIds.size > 0)
  await syncNoteSearchProjection(ctx, args.resourceId, args.snapshotUpdate)
  return {
    status: 'completed' as const,
    generation,
    previous: { update: current.update, version: currentVersion },
    version,
  }
}
