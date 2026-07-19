import * as Y from 'yjs'
import {
  canvasAuthoredDestinations,
  parseCanvasDocumentContent,
} from '@wizard-archive/editor/canvas/document-contract'
import { canvasEncodedBytesWithinWorkload } from '@wizard-archive/editor/canvas/workload'
import {
  advanceContentGeneration,
  assertContentGeneration,
  INITIAL_CONTENT_GENERATION,
} from '@wizard-archive/editor/resources/content-generation'
import {
  assertVersionStamp,
  sha256Digest,
  successorVersion,
} from '@wizard-archive/editor/resources/component-version'
import { resourceAuthoredDestinationOccurrences } from '@wizard-archive/editor/resources/authored-destination'
import type { ResourceId } from '@wizard-archive/editor/resources/domain-id'
import type { CampaignMutationCtx } from '../../functions'
import { loadCanvasContentDeletion } from './canvasContent'
import { replaceResourceReferenceProjection } from './resourceReferences'
import { resolveReplacementTarget } from './replacementTarget'

export async function replaceCanvasContent(
  ctx: CampaignMutationCtx,
  args: Readonly<{
    resourceId: ResourceId
    expectedVersion: unknown
    snapshotUpdate: ArrayBuffer
    snapshotVersion: unknown
  }>,
) {
  const currentRow = await loadCanvasContentDeletion(ctx, args.resourceId)
  const target = resolveReplacementTarget(
    currentRow,
    ctx.resourceScope.campaignId,
    args.expectedVersion,
  )
  if (target.status !== 'ready') return target
  const { current } = target
  const currentVersion = target.version
  if (!canvasEncodedBytesWithinWorkload(args.snapshotUpdate)) {
    return { status: 'snapshot_incompatible' as const }
  }

  const snapshotVersion = assertVersionStamp(args.snapshotVersion)
  if ((await sha256Digest(new Uint8Array(args.snapshotUpdate))) !== snapshotVersion.digest) {
    return { status: 'snapshot_incompatible' as const }
  }
  const content = parseCanvasSnapshot(args.snapshotUpdate)
  if (!content) return { status: 'snapshot_incompatible' as const }
  const version = successorVersion(currentVersion, snapshotVersion.digest)
  const references = await replaceResourceReferenceProjection(ctx, {
    campaignId: ctx.resourceScope.campaignId,
    sourceResourceId: args.resourceId,
    sourceVersion: version,
    occurrences: resourceAuthoredDestinationOccurrences(canvasAuthoredDestinations(content.nodes)),
  })
  if (references.status !== 'completed') {
    return { status: 'snapshot_incompatible' as const }
  }
  const generation = advanceContentGeneration(
    assertContentGeneration(current.generation ?? INITIAL_CONTENT_GENERATION),
  )
  await ctx.db.patch('resourceCanvasContents', current._id, {
    generation,
    update: args.snapshotUpdate,
    version,
  })
  return {
    status: 'completed' as const,
    generation,
    previous: { update: current.update, version: currentVersion },
    version,
  }
}

function parseCanvasSnapshot(update: ArrayBuffer) {
  const document = new Y.Doc()
  try {
    Y.applyUpdate(document, new Uint8Array(update))
    return parseCanvasDocumentContent(document)
  } catch {
    return null
  } finally {
    document.destroy()
  }
}
