import {
  MAX_RESOURCE_REFERENCE_OCCURRENCES,
  parseAuthoredDestination,
  parseReferenceSourceOccurrence,
  projectReferenceOccurrences,
  referenceOccurrenceKey,
} from '@wizard-archive/editor/resources/authored-destination'
import type {
  AuthoredDestinationOccurrence,
  ReferenceGraphOccurrence,
  ReferenceSourceOccurrence,
} from '@wizard-archive/editor/resources/authored-destination'
import type { CanonicalTarget } from '@wizard-archive/editor/resources/authored-destination-contract'
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
  occurrences: ReadonlyArray<AuthoredDestinationOccurrence>
}>

export async function replaceResourceReferenceProjection(
  ctx: Pick<CampaignMutationCtx, 'db'>,
  projection: ResourceReferenceProjection,
): Promise<
  | Readonly<{ status: 'completed' }>
  | Readonly<{ status: 'rejected'; reason: 'content_limit_exceeded' }>
> {
  const { campaignId, sourceResourceId, sourceVersion, occurrences } = projection
  let nextOccurrences: ReadonlyArray<ReferenceGraphOccurrence>
  try {
    nextOccurrences = projectReferenceOccurrences(sourceResourceId, sourceVersion, occurrences)
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
    .take(MAX_RESOURCE_REFERENCE_OCCURRENCES + 1)
  if (existing.length > MAX_RESOURCE_REFERENCE_OCCURRENCES) {
    throw new TypeError('Resource reference projection is corrupt')
  }
  const nextByOccurrence = new Map(
    nextOccurrences.map((occurrence) => [
      referenceOccurrenceKey(occurrence.source, occurrence.target),
      occurrence,
    ]),
  )
  const retainedOccurrences = new Set<string>()
  await Promise.all(
    existing.map((row) => {
      const current = readReferenceOccurrence(row)
      const key = referenceOccurrenceKey(current.source, current.target)
      if (!nextByOccurrence.has(key)) return ctx.db.delete(row._id)
      if (retainedOccurrences.has(key)) {
        throw new TypeError('Resource reference projection contains duplicate occurrences')
      }
      retainedOccurrences.add(key)
      return versionStampEquals(current.sourceVersion, sourceVersion)
        ? Promise.resolve()
        : ctx.db.patch(row._id, { sourceVersion })
    }),
  )
  await Promise.all(
    nextOccurrences.flatMap((occurrence) =>
      retainedOccurrences.has(referenceOccurrenceKey(occurrence.source, occurrence.target))
        ? []
        : [
            ctx.db.insert('resourceReferenceEdges', {
              campaignUuid: campaignId,
              sourceResourceUuid: sourceResourceId,
              sourceVersion: occurrence.sourceVersion,
              source: occurrence.source,
              targetResourceUuid: occurrence.target.resourceId,
              target: occurrence.target,
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
      outgoing: ResourceReferenceRows
      backlinks: ResourceReferenceRows
    }>
  | Readonly<{ status: 'integrity_error' }>
> {
  const [outgoingRows, backlinkRows] = await Promise.all([
    ctx.db
      .query('resourceReferenceEdges')
      .withIndex('by_campaign_and_source', (query) =>
        query.eq('campaignUuid', ctx.resourceScope.campaignId).eq('sourceResourceUuid', resourceId),
      )
      .take(MAX_RESOURCE_REFERENCE_OCCURRENCES + 1),
    ctx.db
      .query('resourceReferenceEdges')
      .withIndex('by_campaign_and_target', (query) =>
        query.eq('campaignUuid', ctx.resourceScope.campaignId).eq('targetResourceUuid', resourceId),
      )
      .take(MAX_RESOURCE_REFERENCE_OCCURRENCES + 1),
  ])
  try {
    return {
      status: 'ready',
      outgoing: readBoundedRows(outgoingRows),
      backlinks: readBoundedRows(backlinkRows),
    }
  } catch {
    return { status: 'integrity_error' }
  }
}

export type ResourceReferenceRow = Readonly<{
  sourceResourceId: ResourceId
  sourceVersion: VersionStamp
  source: ReferenceSourceOccurrence
  target: CanonicalTarget
}>

export type ResourceReferenceRows =
  | Readonly<{ status: 'ready'; rows: ReadonlyArray<ResourceReferenceRow> }>
  | Readonly<{ status: 'capacity_exceeded' }>

function readBoundedRows(
  rows: ReadonlyArray<Parameters<typeof readReferenceOccurrence>[0]>,
): ResourceReferenceRows {
  return rows.length > MAX_RESOURCE_REFERENCE_OCCURRENCES
    ? { status: 'capacity_exceeded' }
    : { status: 'ready', rows: rows.map(readReferenceOccurrence) }
}

function readReferenceOccurrence(row: {
  sourceResourceUuid: string
  sourceVersion: unknown
  source: unknown
  target: unknown
  targetResourceUuid?: string
}): ResourceReferenceRow {
  const destination = parseAuthoredDestination({ kind: 'internal', target: row.target })
  if (destination?.kind !== 'internal') throw new TypeError('Invalid resource reference edge')
  if (
    row.targetResourceUuid !== undefined &&
    destination.target.resourceId !== row.targetResourceUuid
  ) {
    throw new TypeError('Resource reference edge target index is corrupt')
  }
  const source = parseReferenceSourceOccurrence(row.source)
  if (!source) throw new TypeError('Invalid resource reference source')
  return {
    sourceResourceId: assertDomainId(DOMAIN_ID_KIND.resource, row.sourceResourceUuid),
    sourceVersion: assertVersionStamp(row.sourceVersion),
    source,
    target: destination.target,
  }
}
