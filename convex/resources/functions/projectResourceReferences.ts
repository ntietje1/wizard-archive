import {
  MAX_RESOURCE_REFERENCE_OCCURRENCES,
  projectReferenceEdges,
} from '@wizard-archive/editor/resources/authored-destination'
import type { ReferenceGraphEdge } from '@wizard-archive/editor/resources/authored-destination'
import {
  assertVersionStamp,
  versionStampEquals,
} from '@wizard-archive/editor/resources/component-version'
import type { NoteBlockId, ResourceId } from '@wizard-archive/editor/resources/domain-id'
import type { AuthorizedResourceSummary } from '@wizard-archive/editor/resources/index-contract'
import type { CampaignQueryCtx } from '../../functions'
import { projectVisibleNoteBlockIds } from './noteBlockAccess'
import type { ResourceReferenceRow, ResourceReferenceRows } from './resourceReferences'

export type ProjectedResourceReferenceDirection =
  | Readonly<{ status: 'ready'; edges: ReadonlyArray<ReferenceGraphEdge> }>
  | Readonly<{ status: 'capacity_exceeded' }>

export async function projectResourceReferenceDirection(
  ctx: CampaignQueryCtx,
  kind: 'outgoing' | 'backlinks',
  rows: ResourceReferenceRows,
  resources: ReadonlyMap<ResourceId, AuthorizedResourceSummary>,
): Promise<ProjectedResourceReferenceDirection | Readonly<{ status: 'integrity_error' }>> {
  if (rows.status === 'capacity_exceeded') return rows
  const candidates = rows.rows.filter((row) => relatedResourceIsVisible(kind, row, resources))
  if (!(await sourceVersionsAreCurrent(ctx, candidates, resources))) {
    return { status: 'integrity_error' }
  }
  const blockVisibility = await loadBlockVisibility(ctx, candidates, resources)
  if (blockVisibility.status !== 'ready') return blockVisibility
  return {
    status: 'ready',
    edges: projectReferenceEdges(
      candidates.filter((row) => referenceOccurrenceIsVisible(row, blockVisibility.visible)),
      kind,
    ),
  }
}

function relatedResourceIsVisible(
  kind: 'outgoing' | 'backlinks',
  row: ResourceReferenceRow,
  resources: ReadonlyMap<ResourceId, AuthorizedResourceSummary>,
): boolean {
  return resources.has(kind === 'outgoing' ? row.target.resourceId : row.sourceResourceId)
}

async function sourceVersionsAreCurrent(
  ctx: CampaignQueryCtx,
  rows: ReadonlyArray<ResourceReferenceRow>,
  resources: ReadonlyMap<ResourceId, AuthorizedResourceSummary>,
): Promise<boolean> {
  const rowsBySource = new Map<ResourceId, Array<ResourceReferenceRow>>()
  for (const row of rows) {
    const sourceRows = rowsBySource.get(row.sourceResourceId) ?? []
    sourceRows.push(row)
    rowsBySource.set(row.sourceResourceId, sourceRows)
  }
  const results = await Promise.all(
    Array.from(rowsBySource.entries()).map(async ([sourceResourceId, sourceRows]) => {
      const source = resources.get(sourceResourceId)
      if (!source) return false
      const current = await loadCurrentSourceVersion(ctx, source)
      return (
        current !== null &&
        sourceRows.every((row) => versionStampEquals(row.sourceVersion, current))
      )
    }),
  )
  return results.every(Boolean)
}

async function loadCurrentSourceVersion(ctx: CampaignQueryCtx, source: AuthorizedResourceSummary) {
  const table =
    source.kind === 'note'
      ? 'resourceNoteContents'
      : source.kind === 'map'
        ? 'resourceMapContents'
        : source.kind === 'canvas'
          ? 'resourceCanvasContents'
          : null
  if (table === null) return null
  const content = await ctx.db
    .query(table)
    .withIndex('by_resourceUuid', (query) => query.eq('resourceUuid', source.id))
    .unique()
  return content?.campaignUuid === ctx.resourceScope.campaignId
    ? assertVersionStamp(content.version)
    : null
}

type NoteBlockVisibilityKey = `${ResourceId}:${NoteBlockId}`

async function loadBlockVisibility(
  ctx: CampaignQueryCtx,
  rows: ReadonlyArray<ResourceReferenceRow>,
  resources: ReadonlyMap<ResourceId, AuthorizedResourceSummary>,
): Promise<
  | Readonly<{ status: 'ready'; visible: ReadonlySet<NoteBlockVisibilityKey> }>
  | Readonly<{ status: 'capacity_exceeded' }>
  | Readonly<{ status: 'integrity_error' }>
> {
  const requested = new Map<ResourceId, Set<NoteBlockId>>()
  for (const row of rows) {
    if (row.source.kind === 'noteBlock') {
      addRequestedBlock(requested, row.sourceResourceId, row.source.blockId)
    }
    if (row.target.kind === 'noteBlock') {
      addRequestedBlock(requested, row.target.resourceId, row.target.blockId)
    }
  }
  let remainingPolicyBlocks = MAX_RESOURCE_REFERENCE_OCCURRENCES
  const visible = new Set<NoteBlockVisibilityKey>()
  for (const [noteId, blockIds] of requested) {
    const note = resources.get(noteId)
    if (!note || note.kind !== 'note') return { status: 'integrity_error' }
    const projection = await projectVisibleNoteBlockIds(
      ctx,
      noteId,
      ctx.resourceScope.actorId,
      note.permission,
      Array.from(blockIds),
      remainingPolicyBlocks,
    )
    if (projection.status !== 'ready') return projection
    remainingPolicyBlocks -= projection.policyBlockCount
    for (const blockId of projection.visibleBlockIds) {
      visible.add(blockVisibilityKey(noteId, blockId))
    }
  }
  return { status: 'ready', visible }
}

function addRequestedBlock(
  requested: Map<ResourceId, Set<NoteBlockId>>,
  noteId: ResourceId,
  blockId: NoteBlockId,
): void {
  const blockIds = requested.get(noteId) ?? new Set()
  blockIds.add(blockId)
  requested.set(noteId, blockIds)
}

function referenceOccurrenceIsVisible(
  row: ResourceReferenceRow,
  visible: ReadonlySet<NoteBlockVisibilityKey>,
): boolean {
  return (
    (row.source.kind === 'resource' ||
      visible.has(blockVisibilityKey(row.sourceResourceId, row.source.blockId))) &&
    (row.target.kind !== 'noteBlock' ||
      visible.has(blockVisibilityKey(row.target.resourceId, row.target.blockId)))
  )
}

function blockVisibilityKey(noteId: ResourceId, blockId: NoteBlockId): NoteBlockVisibilityKey {
  return `${noteId}:${blockId}`
}
