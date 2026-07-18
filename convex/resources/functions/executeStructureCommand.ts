import { assertVersionStamp } from '@wizard-archive/editor/resources/component-version'
import type { VersionStamp } from '@wizard-archive/editor/resources/component-version'
import {
  DOMAIN_ID_KIND,
  assertDomainId,
  generateDomainId,
} from '@wizard-archive/editor/resources/domain-id'
import type {
  CampaignId,
  CampaignMemberId,
  OperationId,
  ResourceId,
} from '@wizard-archive/editor/resources/domain-id'
import type {
  ResourceCompensationResult,
  ResourceCommandReceipt,
  ResourcePostcondition,
  ResourceStructureCommand,
  ResourceStructureCommandResult,
  ResourceStructureResult,
} from '@wizard-archive/editor/resources/command-contract'
import {
  RESOURCE_COMMAND_PROTOCOL_VERSION,
  fingerprintResourceCompensationRequest,
  fingerprintResourceStructureCommand,
  normalizeResourceStructureCommand,
  resourceStructureInputRejection,
} from '@wizard-archive/editor/resources/command-protocol'
import {
  ResourceGraphRejection,
  planResourceCompensation,
  requireActiveResourceFolder,
  selectResourceClosure,
  selectResourceRoots,
  transitionResourceCompensation,
  transitionResourceGraph,
} from '@wizard-archive/editor/resources/graph-transition'
import type {
  ResourceCompensationPlan,
  ResourceGraph,
  ResourceGraphTransition,
} from '@wizard-archive/editor/resources/graph-transition'
import type { ResourceRecord } from '@wizard-archive/editor/resources/resource-record'
import {
  MAX_SYNCHRONOUS_RESOURCE_CLOSURE,
  canonicalizeResourceTitle,
} from '@wizard-archive/editor/resources/resource-record'
import { initialResourceMetadataVersion } from '@wizard-archive/editor/resources/resource-metadata-version'
import type { ResourceTombstone } from '@wizard-archive/editor/resources/resource-metadata-version'
import { CAMPAIGN_MEMBER_ROLE } from '../../../shared/campaigns/types'
import type { Doc } from '../../_generated/dataModel'
import type { CampaignMutationCtx } from '../../functions'
import { findCanonicalResource } from './findCanonicalResource'
import { applyResourceDeletion, planResourceDeletion } from './resourceDeletion'
import { prepareResourceContentCopies } from './resourceContentCopy'
import { resourceRecordFromRow, resourceRowFromRecord } from './resourceRecordRow'
import {
  copyResourceSearchBody,
  deleteResourceSearchProjection,
  syncResourceSearchProjection,
} from './resourceSearchProjection'
import { copyResourceAccessPolicy, createInitialResourceAccessPolicy } from './resourceAccess'

type ExecuteStructureCommandArgs = {
  operationId: string
  command: ResourceStructureCommand
}

type CompensateResourceOperationArgs = {
  operationId: string
  originalOperationId: string
}

type AppliedCommand = Readonly<{
  result: ResourceStructureCommandResult
  compensation: ResourceCompensationPlan | null
}>

type LoadedGraph = ResourceGraph & {
  rows: ReadonlyMap<ResourceId, Doc<'resources'>>
}

const MAX_LOADED_GRAPH_RESOURCES = MAX_SYNCHRONOUS_RESOURCE_CLOSURE * 2

function ensureGraphBound(rows: ReadonlyMap<ResourceId, Doc<'resources'>>): void {
  if (rows.size > MAX_LOADED_GRAPH_RESOURCES) {
    throw new ResourceGraphRejection('closure_too_large')
  }
}

async function loadResourceSpine(
  ctx: CampaignMutationCtx,
  resourceId: ResourceId,
  rows: Map<ResourceId, Doc<'resources'>>,
  resources: Map<ResourceId, ResourceRecord>,
): Promise<void> {
  const visited = new Set<ResourceId>()
  let currentId: ResourceId | null = resourceId
  while (currentId !== null) {
    if (visited.has(currentId)) throw new ResourceGraphRejection('hierarchy_cycle')
    visited.add(currentId)
    let resource = resources.get(currentId)
    if (!resource) {
      const row = await findCanonicalResource(ctx.db, currentId)
      if (!row) return
      resource = resourceRecordFromRow(row)
      rows.set(resource.id, row)
      resources.set(resource.id, resource)
    }
    ensureGraphBound(rows)
    currentId = resource.parentId
  }
}

async function loadResource(
  ctx: CampaignMutationCtx,
  resourceId: ResourceId,
  rows: Map<ResourceId, Doc<'resources'>>,
  resources: Map<ResourceId, ResourceRecord>,
): Promise<void> {
  const row = await findCanonicalResource(ctx.db, resourceId)
  if (!row) return
  const resource = resourceRecordFromRow(row)
  rows.set(resource.id, row)
  resources.set(resource.id, resource)
}

async function loadDescendants(
  ctx: CampaignMutationCtx,
  campaignId: CampaignId,
  rootIds: ReadonlyArray<ResourceId>,
  rows: Map<ResourceId, Doc<'resources'>>,
  resources: Map<ResourceId, ResourceRecord>,
): Promise<void> {
  const pending = [...rootIds]
  const visited = new Set<ResourceId>()
  while (pending.length > 0) {
    const resourceId = pending.shift()
    if (resourceId === undefined || visited.has(resourceId)) continue
    visited.add(resourceId)
    const resource = resources.get(resourceId)
    if (!resource || resource.campaignId !== campaignId) continue
    const remaining = MAX_LOADED_GRAPH_RESOURCES + 1 - rows.size
    if (remaining < 1) throw new ResourceGraphRejection('closure_too_large')
    const children = await ctx.db
      .query('resources')
      .withIndex('by_campaign_and_parent', (query) =>
        query.eq('campaignUuid', campaignId).eq('parentResourceUuid', resourceId),
      )
      .take(remaining)
    for (const child of children) {
      const childResource = resourceRecordFromRow(child)
      rows.set(childResource.id, child)
      resources.set(childResource.id, childResource)
      pending.push(childResource.id)
    }
    ensureGraphBound(rows)
  }
}

function selectedResourceIds(command: ResourceStructureCommand): ReadonlyArray<ResourceId> {
  switch (command.type) {
    case 'create':
    case 'updateMetadata':
      return [command.resourceId]
    case 'move':
    case 'trash':
    case 'restore':
    case 'permanentlyDelete':
      return command.resourceIds
    case 'deepCopy':
      return command.sourceRootIds
  }
}

function destinationParentId(command: ResourceStructureCommand): ResourceId | null {
  return command.type === 'create'
    ? command.parentId
    : command.type === 'move' || command.type === 'deepCopy'
      ? command.destinationParentId
      : null
}

function needsDescendants(command: ResourceStructureCommand): boolean {
  return (
    command.type === 'trash' ||
    command.type === 'restore' ||
    command.type === 'permanentlyDelete' ||
    command.type === 'deepCopy'
  )
}

async function loadGraph(
  ctx: CampaignMutationCtx,
  campaignId: CampaignId,
  command: ResourceStructureCommand,
): Promise<LoadedGraph> {
  const rows = new Map<ResourceId, Doc<'resources'>>()
  const resources = new Map<ResourceId, ResourceRecord>()
  const selectedIds = selectedResourceIds(command)
  const needsSpines =
    command.type === 'move' ||
    command.type === 'trash' ||
    command.type === 'restore' ||
    command.type === 'permanentlyDelete' ||
    command.type === 'deepCopy'
  await Promise.all(
    selectedIds.map((resourceId) =>
      needsSpines
        ? loadResourceSpine(ctx, resourceId, rows, resources)
        : loadResource(ctx, resourceId, rows, resources),
    ),
  )
  const destinationId = destinationParentId(command)
  if (destinationId !== null) {
    if (command.type === 'move' || command.type === 'deepCopy') {
      await loadResourceSpine(ctx, destinationId, rows, resources)
    } else {
      await loadResource(ctx, destinationId, rows, resources)
    }
  }
  if (needsDescendants(command)) {
    await loadDescendants(ctx, campaignId, selectedIds, rows, resources)
  }

  const tombstones = new Map<ResourceId, ResourceTombstone>()
  if (command.type === 'create') {
    const tombstone = await ctx.db
      .query('resourceTombstones')
      .withIndex('by_resourceUuid', (query) => query.eq('resourceUuid', command.resourceId))
      .unique()
    if (tombstone) {
      const resourceId = assertDomainId(DOMAIN_ID_KIND.resource, tombstone.resourceUuid)
      tombstones.set(resourceId, {
        resourceId,
        campaignId: assertDomainId(DOMAIN_ID_KIND.campaign, tombstone.campaignUuid),
        deletionVersion: assertVersionStamp(tombstone.deletionVersion),
        deletedAt: tombstone.deletedAt,
      })
    }
  }
  return { resources, tombstones, rows }
}

async function loadCompensationGraph(
  ctx: CampaignMutationCtx,
  campaignId: CampaignId,
  plan: ResourceCompensationPlan,
): Promise<LoadedGraph> {
  const rows = new Map<ResourceId, Doc<'resources'>>()
  const resources = new Map<ResourceId, ResourceRecord>()
  await Promise.all(
    plan.requiredPostconditions.map((condition) =>
      loadResource(ctx, condition.resourceId, rows, resources),
    ),
  )
  switch (plan.type) {
    case 'updateMetadata':
      await loadResource(ctx, plan.resourceId, rows, resources)
      break
    case 'move':
      await Promise.all([
        ...plan.placements.map((placement) =>
          loadResourceSpine(ctx, placement.resourceId, rows, resources),
        ),
        ...plan.placements.flatMap((placement) =>
          placement.destinationParentId === null
            ? []
            : [loadResourceSpine(ctx, placement.destinationParentId, rows, resources)],
        ),
      ])
      break
    case 'trash':
    case 'restore':
      await Promise.all(
        plan.resourceIds.map((resourceId) => loadResourceSpine(ctx, resourceId, rows, resources)),
      )
      await loadDescendants(ctx, campaignId, plan.resourceIds, rows, resources)
      break
  }
  ensureGraphBound(rows)
  return { resources, rows, tombstones: new Map() }
}

async function persistTransition(
  ctx: CampaignMutationCtx,
  loaded: LoadedGraph,
  transition: ResourceGraphTransition,
): Promise<void> {
  if (transition.deletedResourceIds.length > 0) {
    const rows = transition.deletedResourceIds.map((resourceId) => {
      const row = loaded.rows.get(resourceId)
      if (!row) throw new ResourceGraphRejection('content_integrity_failure')
      return row
    })
    const campaignId = transition.receipt.campaignId
    const deletion = await planResourceDeletion(ctx, campaignId, rows)
    if (!deletion) throw new ResourceGraphRejection('closure_too_large')
    await applyResourceDeletion(ctx, deletion)
    await Promise.all([
      ...rows.map((row) => ctx.db.delete(row._id)),
      ...transition.deletedResourceIds.map((resourceId) =>
        deleteResourceSearchProjection(ctx, resourceId),
      ),
      ...transition.tombstones.map((tombstone) =>
        ctx.db.insert('resourceTombstones', {
          resourceUuid: tombstone.resourceId,
          campaignUuid: tombstone.campaignId,
          deletionVersion: tombstone.deletionVersion,
          deletedAt: tombstone.deletedAt,
        }),
      ),
    ])
  }

  await Promise.all(
    transition.upserted.map(async (resource) => {
      const row = loaded.rows.get(resource.id)
      if (row) {
        await ctx.db.replace('resources', row._id, resourceRowFromRecord(resource))
        await syncResourceSearchProjection(ctx, resource)
        return
      }
      const resourceRow = resourceRowFromRecord(resource)
      await ctx.db.insert('resources', resourceRow)
      await createInitialResourceAccessPolicy(ctx, resourceRow)
      await syncResourceSearchProjection(ctx, resource)
    }),
  )
}

function copiedResourceId(
  resourceMap: ReadonlyMap<ResourceId, ResourceId>,
  sourceId: ResourceId,
): ResourceId {
  const resourceId = resourceMap.get(sourceId)
  if (!resourceId) throw new ResourceGraphRejection('content_integrity_failure')
  return resourceId
}

async function deepCopyResources(
  ctx: CampaignMutationCtx,
  graph: LoadedGraph,
  campaignId: CampaignId,
  actorId: CampaignMemberId,
  operationId: OperationId,
  command: Extract<ResourceStructureCommand, { type: 'deepCopy' }>,
): Promise<ResourceStructureCommandResult> {
  requireActiveResourceFolder(graph, campaignId, command.destinationParentId)
  const roots = selectResourceRoots(graph, campaignId, command.sourceRootIds)
  const closure = selectResourceClosure(graph, campaignId, roots)
  if (closure.some((resource) => resource.lifecycle.state !== 'active')) {
    throw new ResourceGraphRejection('invalid_lifecycle')
  }
  const rootIds = new Set(roots.map((root) => root.id))
  const resourceMap = new Map(
    closure.map((resource) => [resource.id, generateDomainId(DOMAIN_ID_KIND.resource)]),
  )
  const now = Date.now()
  const copies = await Promise.all(
    closure.map(async (source) => {
      const id = copiedResourceId(resourceMap, source.id)
      const parentId = rootIds.has(source.id)
        ? command.destinationParentId
        : source.parentId === null
          ? null
          : copiedResourceId(resourceMap, source.parentId)
      if (!rootIds.has(source.id) && source.parentId === null) {
        throw new ResourceGraphRejection('content_integrity_failure')
      }
      const title = canonicalizeResourceTitle(source.title)
      if (title !== source.title) throw new ResourceGraphRejection('content_integrity_failure')
      const metadata = {
        parentId,
        kind: source.kind,
        title,
        icon: source.icon,
        color: source.color,
        lifecycle: 'active' as const,
      }
      const destination: ResourceRecord = {
        id,
        campaignId,
        ...metadata,
        lifecycle: { state: 'active' },
        metadataVersion: await initialResourceMetadataVersion(metadata),
        created: { at: now, by: actorId },
        updated: { at: now, by: actorId },
      }
      return { source, destination }
    }),
  )

  const content = await prepareResourceContentCopies(
    ctx,
    campaignId,
    operationId,
    copies.map(({ source, destination }) => ({
      sourceResourceId: source.id,
      destinationResourceId: destination.id,
      kind: source.kind,
    })),
  )
  if (content.status === 'unavailable') throw new ResourceGraphRejection('content_unavailable')
  if (content.status === 'integrity_error') {
    throw new ResourceGraphRejection('content_integrity_failure')
  }
  await Promise.all(
    copies.map(async ({ source, destination }) => {
      const sourceRow = graph.rows.get(source.id)
      if (!sourceRow) throw new ResourceGraphRejection('content_integrity_failure')
      const destinationRow = resourceRowFromRecord(destination)
      await ctx.db.insert('resources', destinationRow)
      await copyResourceAccessPolicy(ctx, sourceRow, destinationRow)
    }),
  )
  await Promise.all(content.commits.map((commit) => commit()))
  await Promise.all(
    copies.map(({ source, destination }) => copyResourceSearchBody(ctx, source.id, destination)),
  )

  return {
    status: 'completed',
    receipt: {
      campaignId,
      operationId,
      result: {
        type: 'deepCopied',
        roots: roots.map((root) => ({
          sourceRootId: root.id,
          destinationRootId: copiedResourceId(resourceMap, root.id),
        })),
      },
      postconditions: copies.map(({ destination }) => ({
        state: 'present',
        resourceId: destination.id,
        metadataVersion: destination.metadataVersion,
      })),
    },
  }
}

function resultFromRow(
  result: Doc<'resourceOperations'>['receipt']['result'],
): ResourceStructureResult {
  switch (result.type) {
    case 'created':
    case 'metadataUpdated':
      return {
        type: result.type,
        resourceId: assertDomainId(DOMAIN_ID_KIND.resource, result.resourceId),
      }
    case 'moved':
    case 'trashed':
    case 'restored':
    case 'permanentlyDeleted':
      return {
        type: result.type,
        resourceIds: result.resourceIds.map((resourceId) =>
          assertDomainId(DOMAIN_ID_KIND.resource, resourceId),
        ),
      }
    case 'deepCopied':
      return {
        type: 'deepCopied',
        roots: result.roots.map((root) => ({
          sourceRootId: assertDomainId(DOMAIN_ID_KIND.resource, root.sourceRootId),
          destinationRootId: assertDomainId(DOMAIN_ID_KIND.resource, root.destinationRootId),
        })),
      }
  }
}

function postconditionsFromRows(
  conditions: Doc<'resourceOperations'>['receipt']['postconditions'],
): ReadonlyArray<ResourcePostcondition> {
  const result = conditions.map((condition) =>
    condition.state === 'missing'
      ? {
          state: condition.state,
          resourceId: assertDomainId(DOMAIN_ID_KIND.resource, condition.resourceId),
        }
      : {
          state: condition.state,
          resourceId: assertDomainId(DOMAIN_ID_KIND.resource, condition.resourceId),
          metadataVersion: assertVersionStamp(condition.metadataVersion),
        },
  )
  if (new Set(result.map((condition) => condition.resourceId)).size !== result.length) {
    throw new TypeError('Duplicate resource postcondition')
  }
  return result
}

function receiptFromRow(receipt: Doc<'resourceOperations'>['receipt']): ResourceCommandReceipt {
  return {
    campaignId: assertDomainId(DOMAIN_ID_KIND.campaign, receipt.campaignId),
    operationId: assertDomainId(DOMAIN_ID_KIND.operation, receipt.operationId),
    result: resultFromRow(receipt.result),
    postconditions: postconditionsFromRows(receipt.postconditions),
  }
}

function compensationFromRow(
  plan: NonNullable<Doc<'resourceOperations'>['compensation']>,
): ResourceCompensationPlan {
  const requiredPostconditions = postconditionsFromRows(plan.requiredPostconditions)
  switch (plan.type) {
    case 'updateMetadata':
      return {
        type: plan.type,
        resourceId: assertDomainId(DOMAIN_ID_KIND.resource, plan.resourceId),
        changes: {
          ...(plan.changes.title === undefined
            ? {}
            : { title: canonicalizeResourceTitle(plan.changes.title) }),
          ...(plan.changes.icon === undefined ? {} : { icon: plan.changes.icon }),
          ...(plan.changes.color === undefined ? {} : { color: plan.changes.color }),
        },
        requiredPostconditions,
      }
    case 'move':
      return {
        type: plan.type,
        placements: plan.placements.map((placement) => ({
          resourceId: assertDomainId(DOMAIN_ID_KIND.resource, placement.resourceId),
          destinationParentId:
            placement.destinationParentId === null
              ? null
              : assertDomainId(DOMAIN_ID_KIND.resource, placement.destinationParentId),
        })),
        requiredPostconditions,
      }
    case 'trash':
    case 'restore':
      return {
        type: plan.type,
        resourceIds: plan.resourceIds.map((resourceId) =>
          assertDomainId(DOMAIN_ID_KIND.resource, resourceId),
        ),
        expectedClosureResourceIds: plan.expectedClosureResourceIds.map((resourceId) =>
          assertDomainId(DOMAIN_ID_KIND.resource, resourceId),
        ),
        requiredPostconditions,
      }
  }
}

function storedVersion(
  version: VersionStamp,
): Doc<'resourceOperations'>['receipt']['postconditions'][number] extends infer _
  ? { scheme: 'authoritative-revision-v1'; revision: number; digest: string }
  : never {
  return { scheme: version.scheme, revision: version.revision, digest: version.digest }
}

function receiptForRow(receipt: ResourceCommandReceipt): Doc<'resourceOperations'>['receipt'] {
  return {
    campaignId: receipt.campaignId,
    operationId: receipt.operationId,
    result: structuredResult(receipt.result),
    postconditions: receipt.postconditions.map((condition) =>
      condition.state === 'missing'
        ? { state: 'missing', resourceId: condition.resourceId }
        : {
            state: 'present',
            resourceId: condition.resourceId,
            metadataVersion: storedVersion(condition.metadataVersion),
          },
    ),
  }
}

function compensationForRow(
  plan: ResourceCompensationPlan | null,
): Doc<'resourceOperations'>['compensation'] {
  if (plan === null) return null
  const requiredPostconditions = plan.requiredPostconditions.map((condition) =>
    condition.state === 'missing'
      ? { state: condition.state, resourceId: condition.resourceId }
      : {
          state: condition.state,
          resourceId: condition.resourceId,
          metadataVersion: storedVersion(condition.metadataVersion),
        },
  )
  switch (plan.type) {
    case 'updateMetadata':
      return {
        type: plan.type,
        resourceId: plan.resourceId,
        changes: { ...plan.changes },
        requiredPostconditions,
      }
    case 'move':
      return {
        type: plan.type,
        placements: plan.placements.map((placement) => ({ ...placement })),
        requiredPostconditions,
      }
    case 'trash':
    case 'restore':
      return {
        type: plan.type,
        resourceIds: [...plan.resourceIds],
        expectedClosureResourceIds: [...plan.expectedClosureResourceIds],
        requiredPostconditions,
      }
  }
}

function replayStoredOperation(
  stored: Doc<'resourceOperations'> | null,
  actorId: CampaignMemberId,
  fingerprint: string,
) {
  if (!stored) return null
  if (stored.actorMemberUuid !== actorId || stored.fingerprint !== fingerprint) {
    return { status: 'rejected', reason: 'operation_id_reused' } as const
  }
  return { status: 'completed', receipt: receiptFromRow(stored.receipt) } as const
}

function structuredResult(
  result: ResourceCommandReceipt['result'],
): Doc<'resourceOperations'>['receipt']['result'] {
  switch (result.type) {
    case 'created':
    case 'metadataUpdated':
      return { type: result.type, resourceId: result.resourceId }
    case 'moved':
    case 'trashed':
    case 'restored':
    case 'permanentlyDeleted':
      return { type: result.type, resourceIds: [...result.resourceIds] }
    case 'deepCopied':
      return { type: 'deepCopied', roots: result.roots.map((root) => ({ ...root })) }
  }
}

async function applyCommand(
  ctx: CampaignMutationCtx,
  campaignId: CampaignId,
  actorId: CampaignMemberId,
  operationId: OperationId,
  command: ResourceStructureCommand,
): Promise<AppliedCommand> {
  const graph = await loadGraph(ctx, campaignId, command)
  if (command.type === 'deepCopy') {
    const result = await deepCopyResources(ctx, graph, campaignId, actorId, operationId, command)
    return {
      result,
      compensation:
        result.status === 'completed'
          ? planResourceCompensation(graph, campaignId, command, result.receipt)
          : null,
    }
  }
  const transition = await transitionResourceGraph(graph, campaignId, operationId, command, {
    at: Date.now(),
    by: actorId,
  })
  const compensation = planResourceCompensation(graph, campaignId, command, transition.receipt)
  await persistTransition(ctx, graph, transition)
  return { result: { status: 'completed', receipt: transition.receipt }, compensation }
}

async function execute(
  ctx: CampaignMutationCtx,
  args: ExecuteStructureCommandArgs,
): Promise<ResourceStructureCommandResult> {
  let operationId: OperationId
  let command: ResourceStructureCommand
  try {
    operationId = assertDomainId(DOMAIN_ID_KIND.operation, args.operationId)
    command = normalizeResourceStructureCommand(args.command)
  } catch (error) {
    return { status: 'rejected', reason: resourceStructureInputRejection(error) }
  }
  if (ctx.membership.role !== CAMPAIGN_MEMBER_ROLE.DM) {
    return { status: 'rejected', reason: 'unauthorized' }
  }

  const { campaignId, actorId } = ctx.resourceScope
  const [fingerprint, stored] = await Promise.all([
    fingerprintResourceStructureCommand(command),
    ctx.db
      .query('resourceOperations')
      .withIndex('by_campaign_and_operation', (query) =>
        query.eq('campaignUuid', campaignId).eq('operationUuid', operationId),
      )
      .unique(),
  ])
  const replay = replayStoredOperation(stored, actorId, fingerprint)
  if (replay) return replay

  try {
    const applied = await applyCommand(ctx, campaignId, actorId, operationId, command)
    if (applied.result.status === 'completed') {
      await ctx.db.insert('resourceOperations', {
        campaignUuid: campaignId,
        actorMemberUuid: actorId,
        operationUuid: operationId,
        protocolVersion: RESOURCE_COMMAND_PROTOCOL_VERSION,
        fingerprint,
        receipt: receiptForRow(applied.result.receipt),
        compensation: compensationForRow(applied.compensation),
      })
    }
    return applied.result
  } catch (error) {
    if (error instanceof ResourceGraphRejection) {
      return { status: 'rejected', reason: error.reason }
    }
    if (error instanceof RangeError && error.message === 'version_exhausted') {
      return { status: 'rejected', reason: 'version_exhausted' }
    }
    throw error
  }
}

export async function executeStructureCommand(
  ctx: CampaignMutationCtx,
  args: ExecuteStructureCommandArgs,
): Promise<ResourceStructureCommandResult> {
  return await execute(ctx, args)
}

export async function compensateResourceOperation(
  ctx: CampaignMutationCtx,
  args: CompensateResourceOperationArgs,
): Promise<ResourceCompensationResult> {
  let operationId: OperationId
  let originalOperationId: OperationId
  try {
    operationId = assertDomainId(DOMAIN_ID_KIND.operation, args.operationId)
    originalOperationId = assertDomainId(DOMAIN_ID_KIND.operation, args.originalOperationId)
  } catch {
    return { status: 'rejected', reason: 'invalid_uuid' }
  }
  if (ctx.membership.role !== CAMPAIGN_MEMBER_ROLE.DM) {
    return { status: 'rejected', reason: 'unauthorized' }
  }

  const { campaignId, actorId } = ctx.resourceScope
  const [fingerprint, stored, original] = await Promise.all([
    fingerprintResourceCompensationRequest(originalOperationId),
    ctx.db
      .query('resourceOperations')
      .withIndex('by_campaign_and_operation', (query) =>
        query.eq('campaignUuid', campaignId).eq('operationUuid', operationId),
      )
      .unique(),
    ctx.db
      .query('resourceOperations')
      .withIndex('by_campaign_and_operation', (query) =>
        query.eq('campaignUuid', campaignId).eq('operationUuid', originalOperationId),
      )
      .unique(),
  ])
  const replay = replayStoredOperation(stored, actorId, fingerprint)
  if (replay) return replay
  if (!original) return { status: 'rejected', reason: 'history_missing' }
  if (original.actorMemberUuid !== actorId) return { status: 'rejected', reason: 'unauthorized' }
  if (original.compensation === null) {
    return { status: 'rejected', reason: 'history_irreversible' }
  }

  try {
    const plan = compensationFromRow(original.compensation)
    const graph = await loadCompensationGraph(ctx, campaignId, plan)
    const applied = await transitionResourceCompensation(graph, campaignId, operationId, plan, {
      at: Date.now(),
      by: actorId,
    })
    if (!applied) return { status: 'rejected', reason: 'history_conflict' }
    await persistTransition(ctx, graph, applied.transition)
    await ctx.db.insert('resourceOperations', {
      campaignUuid: campaignId,
      actorMemberUuid: actorId,
      operationUuid: operationId,
      protocolVersion: RESOURCE_COMMAND_PROTOCOL_VERSION,
      fingerprint,
      receipt: receiptForRow(applied.transition.receipt),
      compensation: compensationForRow(applied.compensation),
    })
    return { status: 'completed', receipt: applied.transition.receipt }
  } catch (error) {
    if (
      error instanceof ResourceGraphRejection ||
      (error instanceof RangeError && error.message === 'version_exhausted')
    ) {
      return { status: 'rejected', reason: 'history_conflict' }
    }
    throw error
  }
}
