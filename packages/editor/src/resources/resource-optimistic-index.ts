import { DOMAIN_ID_KIND, assertDomainId } from './domain-id'
import type { OperationId, ResourceId } from './domain-id'
import type {
  CommandDelivery,
  ResourceCommandReceipt,
  ResourcePostcondition,
  ResourceStructureCommandResult,
} from './resource-command-contract'
import { normalizeResourceStructureCommand } from './resource-command-protocol'
import type {
  OptimisticResourceCommand,
  ResourceOptimisticOverlay,
} from './resource-optimism-contract'
import type {
  AuthorizedResourceSummary,
  CollectionKnowledge,
  ResourceCollectionQuery,
  ResourceKnowledge,
  ResourceProjectionScope,
  WorkspaceResourceIndex,
  WorkspaceResourceIndexSnapshot,
} from './resource-index-contract'
import {
  resourceMatchesCollectionQuery,
  sameResourceProjectionScope,
} from './resource-index-contract'
import { initialResourceMetadataVersion } from './resource-metadata-version'
import { planProjectedResourceStructureCommand } from './resource-projected-structure-plan'
import type { ResourceGraphPlan } from './resource-graph-transition'

type StoredOverlay = ResourceOptimisticOverlay & {
  affectedResourceIds: ReadonlySet<ResourceId>
  structurePlan: ResourceGraphPlan
  createdResource?: AuthorizedResourceSummary
}

type OptimisticCreateCommand = Extract<OptimisticResourceCommand, { type: 'create' }>

export type ResourceOptimisticSubmitResult =
  | { readonly status: 'applied' }
  | { readonly status: 'duplicate' }
  | {
      readonly status: 'rejected'
      readonly reason:
        | 'dependency_unavailable'
        | 'invalid_command'
        | 'operation_id_reused'
        | 'scope_changed'
    }

type ResourceOptimisticConfirmResult =
  | { readonly status: 'confirmed' }
  | { readonly status: 'retired' }
  | {
      readonly status: 'rejected'
      readonly reason: 'overlay_missing' | 'receipt_mismatch' | 'wrong_scope'
    }

type ResourceOptimisticReconcileResult =
  | { readonly status: 'confirmed' }
  | { readonly status: 'retained' }
  | { readonly status: 'removed' }
  | { readonly status: 'retired' }
  | {
      readonly status: 'rejected'
      readonly reason: 'overlay_missing' | 'receipt_mismatch' | 'wrong_scope'
    }

function sameVersion(
  left: AuthorizedResourceSummary['metadataVersion'],
  right: AuthorizedResourceSummary['metadataVersion'],
): boolean {
  return (
    left.scheme === right.scheme && left.revision === right.revision && left.digest === right.digest
  )
}

function postconditionsSatisfied(
  snapshot: WorkspaceResourceIndexSnapshot,
  postconditions: ReadonlyArray<ResourcePostcondition>,
): boolean {
  return postconditions.every((postcondition) => {
    const knowledge = snapshot.lookup(postcondition.resourceId)
    return postcondition.state === 'missing'
      ? knowledge.state === 'missing'
      : knowledge.state === 'known' &&
          sameVersion(knowledge.value.metadataVersion, postcondition.metadataVersion)
  })
}

function commandResourceIds(command: OptimisticResourceCommand): ReadonlyArray<ResourceId> {
  switch (command.type) {
    case 'create':
    case 'updateMetadata':
      return [command.resourceId]
    case 'move':
    case 'trash':
    case 'restore':
      return command.resourceIds
  }
}

function normalizeOptimisticCommand(command: OptimisticResourceCommand): OptimisticResourceCommand {
  const normalized = normalizeResourceStructureCommand(command)
  if (normalized.type === 'deepCopy' || normalized.type === 'permanentlyDelete') {
    throw new TypeError('Command does not support optimism')
  }
  return normalized
}

function sameCommand(left: OptimisticResourceCommand, right: OptimisticResourceCommand): boolean {
  return JSON.stringify(left) === JSON.stringify(right)
}

async function createOptimisticResource(
  command: OptimisticCreateCommand,
  scope: ResourceProjectionScope,
  at: number,
): Promise<AuthorizedResourceSummary> {
  return {
    id: command.resourceId,
    campaignId: scope.campaignId,
    displayParentId: command.parentId,
    kind: command.kind,
    title: command.title,
    icon: command.icon,
    color: command.color,
    lifecycle: 'active',
    permission: 'edit',
    metadataVersion: await initialResourceMetadataVersion({
      parentId: command.parentId,
      kind: command.kind,
      title: command.title,
      icon: command.icon,
      color: command.color,
      lifecycle: 'active',
    }),
    createdAt: at,
    updatedAt: at,
  }
}

function affectedResourceIds(plan: ResourceGraphPlan): ReadonlySet<ResourceId> {
  return new Set([
    ...plan.created.map((resource) => resource.resourceId),
    ...plan.patches.map(({ resourceId }) => resourceId),
    ...plan.deletedResourceIds,
  ])
}

function confirmedVersion(
  overlay: StoredOverlay,
  resourceId: ResourceId,
): AuthorizedResourceSummary['metadataVersion'] | null {
  if (overlay.status !== 'confirmed') return null
  const postcondition = overlay.postconditions.find(
    (candidate) => candidate.state === 'present' && candidate.resourceId === resourceId,
  )
  return postcondition?.state === 'present' ? postcondition.metadataVersion : null
}

function applyOverlay(
  resource: AuthorizedResourceSummary,
  overlay: StoredOverlay,
): AuthorizedResourceSummary {
  const changes = overlay.structurePlan.patches.find(
    ({ resourceId }) => resourceId === resource.id,
  )?.changes
  const projected =
    changes === undefined
      ? resource
      : {
          ...resource,
          ...(changes.parentId === undefined ? {} : { displayParentId: changes.parentId }),
          ...(changes.title === undefined ? {} : { title: changes.title }),
          ...(changes.icon === undefined ? {} : { icon: changes.icon }),
          ...(changes.color === undefined ? {} : { color: changes.color }),
          ...(changes.lifecycle === undefined ? {} : { lifecycle: changes.lifecycle }),
        }
  const metadataVersion = confirmedVersion(overlay, resource.id)
  return metadataVersion === null ? projected : { ...projected, metadataVersion }
}

function createProjectedSnapshot(
  base: WorkspaceResourceIndexSnapshot,
  overlays: ReadonlyArray<StoredOverlay>,
): WorkspaceResourceIndexSnapshot {
  const lookup = (resourceId: ResourceId): ResourceKnowledge<AuthorizedResourceSummary> => {
    let knowledge = base.lookup(resourceId)
    for (const overlay of overlays) {
      if (overlay.command.type === 'create' && overlay.command.resourceId === resourceId) {
        knowledge = { state: 'known', value: overlay.createdResource! }
      }
      if (knowledge.state === 'known') {
        knowledge = { state: 'known', value: applyOverlay(knowledge.value, overlay) }
      }
    }
    return knowledge
  }

  const list = (query: ResourceCollectionQuery): CollectionKnowledge<AuthorizedResourceSummary> => {
    const baseCollection = base.list(query)
    if (baseCollection.state === 'unknown') return baseCollection
    const resourceIds = new Set(baseCollection.items.map((resource) => resource.id))
    for (const overlay of overlays) {
      for (const resourceId of commandResourceIds(overlay.command)) resourceIds.add(resourceId)
      for (const resourceId of overlay.affectedResourceIds) resourceIds.add(resourceId)
    }
    const items = Array.from(resourceIds)
      .flatMap((resourceId) => {
        const knowledge = lookup(resourceId)
        return knowledge.state === 'known' && resourceMatchesCollectionQuery(knowledge.value, query)
          ? [knowledge.value]
          : []
      })
      .sort((left, right) => left.id.localeCompare(right.id))
    return { state: 'known', items, complete: baseCollection.complete }
  }

  const ancestors = (
    resourceId: ResourceId,
  ): ResourceKnowledge<ReadonlyArray<AuthorizedResourceSummary>> => {
    const resource = lookup(resourceId)
    if (resource.state !== 'known') return resource
    const result: Array<AuthorizedResourceSummary> = []
    const visited = new Set<ResourceId>([resourceId])
    let parentId = resource.value.displayParentId
    while (parentId !== null) {
      if (visited.has(parentId)) return { state: 'unknown' }
      visited.add(parentId)
      const parent = lookup(parentId)
      if (parent.state !== 'known' || parent.value.kind !== 'folder') return { state: 'unknown' }
      result.push(parent.value)
      parentId = parent.value.displayParentId
    }
    return { state: 'known', value: result.reverse() }
  }

  return { scope: base.scope, revision: base.revision, lookup, list, ancestors }
}

export class OptimisticWorkspaceResourceIndex {
  #baseScope: ResourceProjectionScope
  #nextOrdinal = 1
  #overlays: Array<StoredOverlay> = []
  #snapshot: WorkspaceResourceIndexSnapshot
  readonly #listeners = new Set<() => void>()
  readonly #unsubscribeBase: () => void

  constructor(
    private readonly base: WorkspaceResourceIndex,
    private readonly now: () => number = Date.now,
  ) {
    this.#snapshot = base.getSnapshot()
    this.#baseScope = this.#snapshot.scope
    this.#unsubscribeBase = base.subscribe(() => this.#baseChanged())
  }

  snapshot(): WorkspaceResourceIndexSnapshot {
    return this.#snapshot
  }

  onChange(listener: () => void): () => void {
    this.#listeners.add(listener)
    return () => this.#listeners.delete(listener)
  }

  async submit(
    operationIdValue: string,
    commandValue: OptimisticResourceCommand,
  ): Promise<ResourceOptimisticSubmitResult> {
    let operationId: OperationId
    let command: OptimisticResourceCommand
    try {
      operationId = assertDomainId(DOMAIN_ID_KIND.operation, operationIdValue)
      command = normalizeOptimisticCommand(commandValue)
    } catch {
      return { status: 'rejected', reason: 'invalid_command' }
    }

    const existing = this.#overlays.find((overlay) => overlay.operationId === operationId)
    if (existing) {
      return sameCommand(existing.command, command)
        ? { status: 'duplicate' }
        : { status: 'rejected', reason: 'operation_id_reused' }
    }
    const baseSnapshot = this.base.getSnapshot()
    if (!sameResourceProjectionScope(baseSnapshot.scope, this.#baseScope)) {
      return { status: 'rejected', reason: 'scope_changed' }
    }
    const basePlan = planProjectedResourceStructureCommand(baseSnapshot, command)
    if (basePlan.status === 'unavailable') return { status: 'rejected', reason: basePlan.reason }
    if (basePlan.status === 'rejected') return { status: 'rejected', reason: 'invalid_command' }
    const projectedPlan = planProjectedResourceStructureCommand(this.#snapshot, command)
    if (projectedPlan.status === 'unavailable') {
      return { status: 'rejected', reason: projectedPlan.reason }
    }
    if (projectedPlan.status === 'rejected')
      return { status: 'rejected', reason: 'invalid_command' }

    const createdResource =
      command.type === 'create'
        ? await createOptimisticResource(command, this.#baseScope, this.now())
        : undefined
    if (!sameResourceProjectionScope(this.base.getSnapshot().scope, this.#baseScope)) {
      return { status: 'rejected', reason: 'scope_changed' }
    }

    this.#overlays.push({
      status: 'pending',
      ordinal: this.#nextOrdinal++,
      operationId,
      command,
      structurePlan: projectedPlan.plan,
      affectedResourceIds: affectedResourceIds(projectedPlan.plan),
      ...(createdResource === undefined ? {} : { createdResource }),
    })
    this.#publish()
    return { status: 'applied' }
  }

  confirm(receipt: ResourceCommandReceipt): ResourceOptimisticConfirmResult {
    if (receipt.campaignId !== this.#baseScope.campaignId) {
      return { status: 'rejected', reason: 'wrong_scope' }
    }
    const index = this.#overlays.findIndex((overlay) => overlay.operationId === receipt.operationId)
    if (index < 0) return { status: 'rejected', reason: 'overlay_missing' }
    const overlay = this.#overlays[index]!
    if (
      overlay.status === 'confirmed' &&
      JSON.stringify(overlay.postconditions) !== JSON.stringify(receipt.postconditions)
    ) {
      return { status: 'rejected', reason: 'receipt_mismatch' }
    }
    if (postconditionsSatisfied(this.base.getSnapshot(), receipt.postconditions)) {
      this.#overlays.splice(index, 1)
      this.#publish()
      return { status: 'retired' }
    }
    this.#overlays[index] = {
      ...overlay,
      status: 'confirmed',
      postconditions: receipt.postconditions,
    }
    this.#publish()
    return { status: 'confirmed' }
  }

  reconcile(
    operationId: OperationId,
    delivery: CommandDelivery<ResourceStructureCommandResult>,
  ): ResourceOptimisticReconcileResult {
    if (delivery.status === 'indeterminate') {
      return this.#hasOverlay(operationId)
        ? { status: 'retained' }
        : { status: 'rejected', reason: 'overlay_missing' }
    }
    if (delivery.status === 'not_committed' || delivery.result.status !== 'completed') {
      return this.remove(operationId)
        ? { status: 'removed' }
        : { status: 'rejected', reason: 'overlay_missing' }
    }
    if (delivery.result.receipt.operationId !== operationId) {
      return { status: 'rejected', reason: 'receipt_mismatch' }
    }
    return this.confirm(delivery.result.receipt)
  }

  remove(operationId: OperationId): boolean {
    const index = this.#overlays.findIndex((overlay) => overlay.operationId === operationId)
    if (index < 0) return false
    this.#overlays.splice(index, 1)
    this.#publish()
    return true
  }

  dispose(): void {
    this.#unsubscribeBase()
    this.#listeners.clear()
  }

  #hasOverlay(operationId: OperationId): boolean {
    return this.#overlays.some((overlay) => overlay.operationId === operationId)
  }

  #baseChanged(): void {
    const baseSnapshot = this.base.getSnapshot()
    if (!sameResourceProjectionScope(baseSnapshot.scope, this.#baseScope)) {
      this.#baseScope = baseSnapshot.scope
      this.#overlays = []
    } else {
      this.#overlays = this.#overlays.filter(
        (overlay) =>
          overlay.status !== 'confirmed' ||
          !postconditionsSatisfied(baseSnapshot, overlay.postconditions),
      )
    }
    this.#publish()
  }

  #publish(): void {
    this.#snapshot =
      this.#overlays.length === 0
        ? this.base.getSnapshot()
        : createProjectedSnapshot(this.base.getSnapshot(), this.#overlays)
    for (const listener of this.#listeners) listener()
  }
}
