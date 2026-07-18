import {
  MAX_RESOURCE_REFERENCE_TARGETS,
  canonicalTargetKey,
  parseAuthoredDestination,
  projectReferenceGraph,
} from '@wizard-archive/editor/resources/authored-destination'
import type { ReferenceGraphEdge } from '@wizard-archive/editor/resources/authored-destination'
import type {
  AuthoredDestination,
  CanonicalTarget,
} from '@wizard-archive/editor/resources/authored-destination-contract'
import {
  assertVersionStamp,
  versionStampEquals,
} from '@wizard-archive/editor/resources/component-version'
import type { VersionStamp } from '@wizard-archive/editor/resources/component-version'
import { assertDomainId, DOMAIN_ID_KIND } from '@wizard-archive/editor/resources/domain-id'
import type { CampaignId, ResourceId } from '@wizard-archive/editor/resources/domain-id'
import type { CampaignMutationCtx, CampaignQueryCtx } from '../../functions'

export type ResourceReferenceProjection = Readonly<{
  campaignId: CampaignId
  sourceResourceId: ResourceId
  sourceVersion: VersionStamp
  destinations: ReadonlyArray<AuthoredDestination>
}>

export async function replaceResourceReferenceProjection(
  ctx: Pick<CampaignMutationCtx, 'db'>,
  projection: ResourceReferenceProjection,
): Promise<
  | Readonly<{ status: 'completed' }>
  | Readonly<{ status: 'rejected'; reason: 'content_limit_exceeded' }>
> {
  const { campaignId, sourceResourceId, sourceVersion, destinations } = projection
  let edges: ReadonlyArray<ReferenceGraphEdge>
  try {
    edges = projectReferenceGraph(sourceResourceId, sourceVersion, destinations)
  } catch (error) {
    if (error instanceof RangeError) {
      return { status: 'rejected', reason: 'content_limit_exceeded' }
    }
    throw error
  }
  const existing = await ctx.db
    .query('resourceReferenceEdges')
    .withIndex('by_campaign_and_source', (query) =>
      query.eq('campaignUuid', campaignId).eq('sourceResourceUuid', sourceResourceId),
    )
    .take(MAX_RESOURCE_REFERENCE_TARGETS + 1)
  if (existing.length > MAX_RESOURCE_REFERENCE_TARGETS) {
    throw new TypeError('Resource reference projection is corrupt')
  }
  const nextByTarget = new Map(edges.map((edge) => [canonicalTargetKey(edge.target), edge]))
  const retainedTargets = new Set<string>()
  await Promise.all(
    existing.map((edge) => {
      const current = readReferenceEdge(edge)
      const key = canonicalTargetKey(current.target)
      if (!nextByTarget.has(key)) return ctx.db.delete(edge._id)
      if (retainedTargets.has(key)) {
        throw new TypeError('Resource reference projection contains duplicate targets')
      }
      retainedTargets.add(key)
      return versionStampEquals(current.sourceVersion, sourceVersion)
        ? Promise.resolve()
        : ctx.db.patch(edge._id, { sourceVersion })
    }),
  )
  await Promise.all(
    edges.flatMap((edge) =>
      retainedTargets.has(canonicalTargetKey(edge.target))
        ? []
        : [
            ctx.db.insert('resourceReferenceEdges', {
              campaignUuid: campaignId,
              sourceResourceUuid: sourceResourceId,
              sourceVersion: edge.sourceVersion,
              targetResourceUuid: edge.target.resourceId,
              target: edge.target,
            }),
          ],
    ),
  )
  return { status: 'completed' }
}

export async function loadResourceReferenceRows(
  ctx: CampaignQueryCtx,
  resourceId: ResourceId,
): Promise<
  | Readonly<{
      status: 'ready'
      outgoing: ReadonlyArray<{
        sourceResourceId: ResourceId
        sourceVersion: VersionStamp
        target: CanonicalTarget
      }>
      backlinks: ReadonlyArray<{
        sourceResourceId: ResourceId
        sourceVersion: VersionStamp
        target: CanonicalTarget
      }>
    }>
  | Readonly<{ status: 'integrity_error' }>
> {
  const [outgoingRows, backlinkRows] = await Promise.all([
    ctx.db
      .query('resourceReferenceEdges')
      .withIndex('by_campaign_and_source', (query) =>
        query.eq('campaignUuid', ctx.resourceScope.campaignId).eq('sourceResourceUuid', resourceId),
      )
      .take(MAX_RESOURCE_REFERENCE_TARGETS + 1),
    ctx.db
      .query('resourceReferenceEdges')
      .withIndex('by_campaign_and_target', (query) =>
        query.eq('campaignUuid', ctx.resourceScope.campaignId).eq('targetResourceUuid', resourceId),
      )
      .take(MAX_RESOURCE_REFERENCE_TARGETS),
  ])
  if (outgoingRows.length > MAX_RESOURCE_REFERENCE_TARGETS) {
    return { status: 'integrity_error' }
  }
  return {
    status: 'ready',
    outgoing: outgoingRows.map(readReferenceEdge),
    backlinks: backlinkRows.map(readReferenceEdge),
  }
}

function readReferenceEdge(row: {
  sourceResourceUuid: string
  sourceVersion: unknown
  target: unknown
  targetResourceUuid?: string
}) {
  const destination = parseAuthoredDestination({ kind: 'internal', target: row.target })
  if (destination?.kind !== 'internal') throw new TypeError('Invalid resource reference edge')
  if (
    row.targetResourceUuid !== undefined &&
    destination.target.resourceId !== row.targetResourceUuid
  ) {
    throw new TypeError('Resource reference edge target index is corrupt')
  }
  return {
    sourceResourceId: assertDomainId(DOMAIN_ID_KIND.resource, row.sourceResourceUuid),
    sourceVersion: assertVersionStamp(row.sourceVersion),
    target: destination.target,
  }
}
