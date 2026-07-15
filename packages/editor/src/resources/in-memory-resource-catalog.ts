import { DOMAIN_ID_KIND, assertDomainId, generateDomainId } from './domain-id'
import type { CampaignId, CampaignMemberId, ResourceId } from './domain-id'
import type {
  ResourceCatalogPage,
  ResourceCatalogReader,
  ResourceCatalogSnapshotSource,
  ResourceCatalogSnapshot,
  SourcePathAlias,
} from './resource-catalog-contract'
import { assertResourceCatalogPageSize } from './resource-catalog-contract'
import { assertSourcePathAlias } from './source-path-alias'
import type {
  AuthoritativeResourceOperationExecutor,
  AuthoritativeResourceCompensationExecutor,
  CommandEnvelope,
  ResourceCommandReceipt,
  ResourceCompensationEnvelope,
  ResourcePostcondition,
  ResourceStructureCommand,
  ResourceStructureCommandResult,
} from './resource-command-contract'
import {
  RESOURCE_COMMAND_PROTOCOL_VERSION,
  fingerprintResourceStructureCommand,
  fingerprintResourceCompensation,
  normalizeResourcePostconditions,
  normalizeResourceStructureCommand,
  resourceStructureInputRejection,
} from './resource-command-protocol'
import type { AuditStamp, ResourceRecord } from './resource-record'
import { canonicalizeResourceTitle } from './resource-record'
import { initialResourceMetadataVersion } from './resource-metadata-version'
import type { ResourceTombstone } from './resource-metadata-version'
import type { ResourceCollectionQuery } from './resource-index-contract'
import { InMemoryResourceOperationLedger } from './resource-operation-ledger'
import type {
  CanonicalTargetMapEntry,
  ContentCopyPlanner,
  ResourceCopyMapEntry,
} from './content-copy-contract'
import {
  ResourceGraphRejection,
  requireActiveResourceFolder,
  selectResourceClosure,
  selectResourceRoots,
  transitionResourceGraph,
} from './resource-graph-transition'

export type ResourceOperationAuthorizer = (
  actorId: CampaignMemberId,
  envelope: CommandEnvelope<ResourceStructureCommand>,
) => boolean | Promise<boolean>

export type InMemoryResourceCatalogOptions = Readonly<{
  initialSnapshot?: ResourceCatalogSnapshot
}>

export type InMemoryResourceOperationsOptions<TContentCopyPlan = never> = Readonly<{
  authorize: ResourceOperationAuthorizer
  contentCopy?: ContentCopyPlanner<TContentCopyPlan, () => void>
  now?: () => number
}>

export interface InMemoryResourceOperations
  extends AuthoritativeResourceOperationExecutor, AuthoritativeResourceCompensationExecutor {
  appendAlias(alias: SourcePathAlias): Promise<SourcePathAlias>
  assignAssetsFolder(campaignId: CampaignId, resourceId: ResourceId | null): Promise<void>
}

type CatalogState = {
  resources: Map<ResourceId, ResourceRecord>
  tombstones: Map<ResourceId, ResourceTombstone>
  aliases: Map<ResourceId, Array<SourcePathAlias>>
  assetsFolders: Map<CampaignId, ResourceId>
}

type InMemoryResourceCatalogBackend = {
  state: CatalogState
  operationQueue: Promise<void>
  listeners: Map<CampaignId, Set<() => void>>
  snapshotCache: Map<CampaignId, ResourceCatalogSnapshot>
}

function emptyCatalogState(): CatalogState {
  return {
    resources: new Map(),
    tombstones: new Map(),
    aliases: new Map(),
    assetsFolders: new Map(),
  }
}

function cloneCatalogState(state: CatalogState): CatalogState {
  return {
    resources: new Map(state.resources),
    tombstones: new Map(state.tombstones),
    aliases: new Map(
      Array.from(state.aliases, ([resourceId, aliases]) => [resourceId, [...aliases]]),
    ),
    assetsFolders: new Map(state.assetsFolders),
  }
}

function addSnapshotResources(state: CatalogState, snapshot: ResourceCatalogSnapshot): void {
  for (const resource of snapshot.resources) {
    if (resource.campaignId !== snapshot.campaignId || state.resources.has(resource.id)) {
      throw new TypeError('Invalid initial resource catalog snapshot')
    }
    state.resources.set(resource.id, resource)
  }
}

function addSnapshotTombstones(state: CatalogState, snapshot: ResourceCatalogSnapshot): void {
  for (const tombstone of snapshot.tombstones) {
    if (
      tombstone.campaignId !== snapshot.campaignId ||
      state.resources.has(tombstone.resourceId) ||
      state.tombstones.has(tombstone.resourceId)
    ) {
      throw new TypeError('Invalid initial resource catalog snapshot')
    }
    state.tombstones.set(tombstone.resourceId, tombstone)
  }
}

function validateSnapshotHierarchy(state: CatalogState, campaignId: CampaignId): void {
  for (const resource of state.resources.values()) {
    const visited = new Set<ResourceId>([resource.id])
    let parentId = resource.parentId
    while (parentId !== null) {
      if (visited.has(parentId)) throw new TypeError('Invalid initial resource catalog hierarchy')
      visited.add(parentId)
      const parent = state.resources.get(parentId)
      if (!parent || parent.campaignId !== campaignId || parent.kind !== 'folder') {
        throw new TypeError('Invalid initial resource catalog hierarchy')
      }
      parentId = parent.parentId
    }
  }
}

function addSnapshotAliases(state: CatalogState, snapshot: ResourceCatalogSnapshot): void {
  for (const alias of snapshot.aliases) {
    assertSourcePathAlias(alias)
    if (alias.campaignId !== snapshot.campaignId || !state.resources.has(alias.resourceId)) {
      throw new TypeError('Invalid initial resource catalog alias')
    }
    const aliases = state.aliases.get(alias.resourceId) ?? []
    if (aliases.some((candidate) => sameAlias(candidate, alias))) {
      throw new TypeError('Duplicate initial resource catalog alias')
    }
    state.aliases.set(alias.resourceId, [...aliases, alias])
  }
}

function addSnapshotAssetsFolder(state: CatalogState, snapshot: ResourceCatalogSnapshot): void {
  if (snapshot.assetsFolderId === null) return
  const resource = state.resources.get(snapshot.assetsFolderId)
  if (!resource || resource.campaignId !== snapshot.campaignId || resource.kind !== 'folder') {
    throw new TypeError('Invalid initial resource catalog assets folder')
  }
  state.assetsFolders.set(snapshot.campaignId, snapshot.assetsFolderId)
}

function catalogStateFromSnapshot(snapshot: ResourceCatalogSnapshot): CatalogState {
  const state = emptyCatalogState()
  addSnapshotResources(state, snapshot)
  addSnapshotTombstones(state, snapshot)
  validateSnapshotHierarchy(state, snapshot.campaignId)
  addSnapshotAliases(state, snapshot)
  addSnapshotAssetsFolder(state, snapshot)
  return state
}

function byResourceId(left: ResourceRecord, right: ResourceRecord): number {
  return left.id.localeCompare(right.id)
}

function byTombstoneResourceId(left: ResourceTombstone, right: ResourceTombstone): number {
  return left.resourceId.localeCompare(right.resourceId)
}

function byAlias(left: SourcePathAlias, right: SourcePathAlias): number {
  return (
    left.resourceId.localeCompare(right.resourceId) ||
    left.importJobId.localeCompare(right.importJobId) ||
    left.sourceRootId.localeCompare(right.sourceRootId) ||
    left.normalizedPath.localeCompare(right.normalizedPath)
  )
}

function sameAlias(left: SourcePathAlias, right: SourcePathAlias): boolean {
  return (
    left.campaignId === right.campaignId &&
    left.resourceId === right.resourceId &&
    left.importJobId === right.importJobId &&
    left.sourceRootId === right.sourceRootId &&
    left.normalizedPath === right.normalizedPath
  )
}

function ownedResource(
  state: CatalogState,
  campaignId: CampaignId,
  resourceId: ResourceId,
): ResourceRecord {
  const resource = state.resources.get(resourceId)
  if (!resource) throw new ResourceGraphRejection('resource_missing')
  if (resource.campaignId !== campaignId) throw new ResourceGraphRejection('ownership_mismatch')
  return resource
}

function activeClosure(
  state: CatalogState,
  campaignId: CampaignId,
  resourceIds: ReadonlyArray<ResourceId>,
): Readonly<{ roots: ReadonlyArray<ResourceRecord>; closure: ReadonlyArray<ResourceRecord> }> {
  const graph = { resources: state.resources, tombstones: state.tombstones }
  const roots = selectResourceRoots(graph, campaignId, resourceIds)
  const closure = selectResourceClosure(graph, campaignId, roots)
  if (closure.some((resource) => resource.lifecycle.state !== 'active')) {
    throw new ResourceGraphRejection('invalid_lifecycle')
  }
  return { roots, closure }
}

function postconditions(
  resources: ReadonlyArray<ResourceRecord>,
): ReadonlyArray<ResourcePostcondition> {
  return resources.map((resource) => ({
    state: 'present',
    resourceId: resource.id,
    metadataVersion: resource.metadataVersion,
  }))
}

function completed(
  campaignId: CampaignId,
  operationId: CommandEnvelope<ResourceStructureCommand>['operationId'],
  result: ResourceCommandReceipt['result'],
  conditions: ReadonlyArray<ResourcePostcondition>,
): ResourceStructureCommandResult {
  return {
    status: 'completed',
    receipt: { campaignId, operationId, result, postconditions: conditions },
  }
}

type PreparedDeepCopy = Readonly<{
  result: ResourceStructureCommandResult
  commitContent: () => void
}>

export class InMemoryResourceCatalog
  implements ResourceCatalogReader, ResourceCatalogSnapshotSource
{
  readonly #backend: InMemoryResourceCatalogBackend

  constructor(options: InMemoryResourceCatalogOptions = {}) {
    this.#backend = {
      state: options.initialSnapshot
        ? catalogStateFromSnapshot(options.initialSnapshot)
        : emptyCatalogState(),
      operationQueue: Promise.resolve(),
      listeners: new Map(),
      snapshotCache: new Map(),
    }
  }

  operations<TContentCopyPlan = never>(
    options: InMemoryResourceOperationsOptions<TContentCopyPlan>,
  ): InMemoryResourceOperations {
    return new InMemoryResourceOperationExecutor(this.#backend, options)
  }

  getSnapshot(campaignId: CampaignId): ResourceCatalogSnapshot {
    const backend = this.#backend
    const cached = backend.snapshotCache.get(campaignId)
    if (cached) return cached
    const snapshot = {
      campaignId,
      resources: Array.from(backend.state.resources.values())
        .filter((resource) => resource.campaignId === campaignId)
        .sort(byResourceId),
      tombstones: Array.from(backend.state.tombstones.values())
        .filter((tombstone) => tombstone.campaignId === campaignId)
        .sort(byTombstoneResourceId),
      aliases: Array.from(backend.state.aliases.values())
        .flat()
        .filter((alias) => alias.campaignId === campaignId)
        .sort(byAlias),
      assetsFolderId: backend.state.assetsFolders.get(campaignId) ?? null,
    } satisfies ResourceCatalogSnapshot
    backend.snapshotCache.set(campaignId, snapshot)
    return snapshot
  }

  subscribe(campaignId: CampaignId, listener: () => void): () => void {
    const backend = this.#backend
    const listeners = backend.listeners.get(campaignId) ?? new Set<() => void>()
    listeners.add(listener)
    backend.listeners.set(campaignId, listeners)
    return () => {
      listeners.delete(listener)
      if (listeners.size === 0) backend.listeners.delete(campaignId)
    }
  }

  getResource(campaignId: CampaignId, resourceId: ResourceId): Promise<ResourceRecord | null> {
    const resource = this.#backend.state.resources.get(resourceId)
    return Promise.resolve(resource?.campaignId === campaignId ? resource : null)
  }

  getResources(
    campaignId: CampaignId,
    resourceIds: ReadonlyArray<ResourceId>,
  ): Promise<ReadonlyArray<ResourceRecord>> {
    const state = this.#backend.state
    return Promise.resolve(
      resourceIds.flatMap((resourceId) => {
        const resource = state.resources.get(resourceId)
        return resource?.campaignId === campaignId ? [resource] : []
      }),
    )
  }

  listCollection(
    campaignId: CampaignId,
    query: ResourceCollectionQuery,
    limit: number,
    cursor: string | null,
  ): Promise<ResourceCatalogPage<ResourceRecord>> {
    try {
      assertResourceCatalogPageSize(limit)
    } catch (error) {
      return Promise.reject(error)
    }
    const kinds = query.kinds === undefined ? null : new Set(query.kinds)
    const candidates = Array.from(this.#backend.state.resources.values())
      .filter((resource) => {
        if (
          resource.campaignId !== campaignId ||
          resource.lifecycle.state !== query.lifecycle ||
          (cursor !== null && resource.id <= cursor) ||
          (kinds !== null && !kinds.has(resource.kind))
        ) {
          return false
        }
        if (query.parentId !== null || query.lifecycle === 'active') {
          return resource.parentId === query.parentId
        }
        if (resource.parentId === null) return true
        const parent = this.#backend.state.resources.get(resource.parentId)
        return parent?.campaignId !== campaignId || parent.lifecycle.state !== 'trashed'
      })
      .sort(byResourceId)
    const items = candidates.slice(0, limit)
    return Promise.resolve({
      items,
      cursor: candidates.length > items.length ? items[items.length - 1]!.id : null,
    })
  }

  getTombstone(campaignId: CampaignId, resourceId: ResourceId): Promise<ResourceTombstone | null> {
    const tombstone = this.#backend.state.tombstones.get(resourceId)
    return Promise.resolve(tombstone?.campaignId === campaignId ? tombstone : null)
  }

  listAliases(
    campaignId: CampaignId,
    resourceId: ResourceId,
  ): Promise<ReadonlyArray<SourcePathAlias>> {
    return Promise.resolve(
      (this.#backend.state.aliases.get(resourceId) ?? [])
        .filter((alias) => alias.campaignId === campaignId)
        .sort(byAlias),
    )
  }

  getAssetsFolder(campaignId: CampaignId): Promise<ResourceId | null> {
    return Promise.resolve(this.#backend.state.assetsFolders.get(campaignId) ?? null)
  }

  readSnapshot(campaignId: CampaignId): Promise<ResourceCatalogSnapshot> {
    return Promise.resolve(this.getSnapshot(campaignId))
  }
}

class InMemoryResourceOperationExecutor<
  TContentCopyPlan = never,
> implements InMemoryResourceOperations {
  readonly #backend: InMemoryResourceCatalogBackend
  readonly #ledger = new InMemoryResourceOperationLedger<ResourceCommandReceipt>()
  readonly #authorize: ResourceOperationAuthorizer
  readonly #contentCopy: ContentCopyPlanner<TContentCopyPlan, () => void> | undefined
  readonly #now: () => number

  constructor(
    backend: InMemoryResourceCatalogBackend,
    options: InMemoryResourceOperationsOptions<TContentCopyPlan>,
  ) {
    this.#backend = backend
    this.#authorize = options.authorize
    this.#contentCopy = options.contentCopy
    this.#now = options.now ?? Date.now
  }

  appendAlias(alias: SourcePathAlias): Promise<SourcePathAlias> {
    return this.#enqueue(() => {
      assertSourcePathAlias(alias)
      ownedResource(this.#backend.state, alias.campaignId, alias.resourceId)
      const current = this.#backend.state.aliases.get(alias.resourceId) ?? []
      const existing = current.find((candidate) => sameAlias(candidate, alias))
      if (existing) return existing
      this.#backend.state.aliases.set(alias.resourceId, [...current, alias])
      this.#publish(alias.campaignId)
      return alias
    })
  }

  assignAssetsFolder(campaignId: CampaignId, resourceId: ResourceId | null): Promise<void> {
    return this.#enqueue(() => {
      if (resourceId !== null) {
        const resource = ownedResource(this.#backend.state, campaignId, resourceId)
        if (resource.kind !== 'folder') throw new TypeError('Assets must be assigned to a folder')
      }
      if ((this.#backend.state.assetsFolders.get(campaignId) ?? null) === resourceId) return
      if (resourceId === null) this.#backend.state.assetsFolders.delete(campaignId)
      else this.#backend.state.assetsFolders.set(campaignId, resourceId)
      this.#publish(campaignId)
    })
  }

  execute(
    actorId: CampaignMemberId,
    envelope: CommandEnvelope<ResourceStructureCommand>,
  ): Promise<ResourceStructureCommandResult> {
    return this.#enqueue(() => this.#executeInput(actorId, envelope))
  }

  executeCompensation(
    actorId: CampaignMemberId,
    envelope: ResourceCompensationEnvelope,
  ): Promise<ResourceStructureCommandResult> {
    return this.#enqueue(() =>
      this.#executeInput(actorId, envelope, envelope.expectedPostconditions),
    )
  }

  #enqueue<TResult>(operation: () => TResult | Promise<TResult>): Promise<TResult> {
    const result = this.#backend.operationQueue.then(operation)
    this.#backend.operationQueue = result.then(
      () => undefined,
      () => undefined,
    )
    return result
  }

  async #executeInput(
    actorId: CampaignMemberId,
    envelope: CommandEnvelope<ResourceStructureCommand>,
    expected?: ReadonlyArray<ResourcePostcondition>,
  ): Promise<ResourceStructureCommandResult> {
    let normalizedEnvelope: CommandEnvelope<ResourceStructureCommand>
    let expectedPostconditions: ReadonlyArray<ResourcePostcondition> | undefined
    try {
      normalizedEnvelope = {
        campaignId: assertDomainId(DOMAIN_ID_KIND.campaign, envelope.campaignId),
        operationId: assertDomainId(DOMAIN_ID_KIND.operation, envelope.operationId),
        command: normalizeResourceStructureCommand(envelope.command),
      }
      expectedPostconditions = expected && normalizeResourcePostconditions(expected)
      assertDomainId(DOMAIN_ID_KIND.campaignMember, actorId)
    } catch (error) {
      return { status: 'rejected', reason: resourceStructureInputRejection(error) }
    }

    return await this.#execute(actorId, normalizedEnvelope, expectedPostconditions)
  }

  async #execute(
    actorId: CampaignMemberId,
    normalizedEnvelope: CommandEnvelope<ResourceStructureCommand>,
    expectedPostconditions?: ReadonlyArray<ResourcePostcondition>,
  ): Promise<ResourceStructureCommandResult> {
    if (!(await this.#authorize(actorId, normalizedEnvelope))) {
      return { status: 'rejected', reason: 'unauthorized' }
    }
    const fingerprint = expectedPostconditions
      ? await fingerprintResourceCompensation(normalizedEnvelope.command, expectedPostconditions)
      : await fingerprintResourceStructureCommand(normalizedEnvelope.command)
    const lookup = this.#ledger.lookup(
      normalizedEnvelope.campaignId,
      actorId,
      normalizedEnvelope.operationId,
      fingerprint,
    )
    if (lookup.status === 'replay') return { status: 'completed', receipt: lookup.receipt }
    if (lookup.status === 'rejected') return { status: 'rejected', reason: lookup.reason }

    if (expectedPostconditions && !this.#matches(expectedPostconditions)) {
      return { status: 'rejected', reason: 'stale_history' }
    }

    const draft = cloneCatalogState(this.#backend.state)
    let result: ResourceStructureCommandResult
    let preparedDeepCopy: PreparedDeepCopy | undefined
    try {
      if (normalizedEnvelope.command.type === 'deepCopy') {
        preparedDeepCopy = await this.#deepCopy(
          { ...normalizedEnvelope, command: normalizedEnvelope.command },
          draft,
          { at: this.#now(), by: actorId },
        )
        result = preparedDeepCopy.result
      } else {
        result = await this.#apply(actorId, normalizedEnvelope, draft)
      }
    } catch (error) {
      if (error instanceof ResourceGraphRejection) {
        return { status: 'rejected', reason: error.reason }
      }
      if (error instanceof RangeError && error.message === 'version_exhausted') {
        return { status: 'rejected', reason: 'version_exhausted' }
      }
      throw error
    }
    if (result.status !== 'completed') return result

    preparedDeepCopy?.commitContent()
    this.#ledger.record({
      campaignId: normalizedEnvelope.campaignId,
      actorId,
      operationId: normalizedEnvelope.operationId,
      protocolVersion: RESOURCE_COMMAND_PROTOCOL_VERSION,
      fingerprint,
      receipt: result.receipt,
    })
    this.#backend.state = draft
    this.#publish(normalizedEnvelope.campaignId)
    return result
  }

  #matches(expectedPostconditions: ReadonlyArray<ResourcePostcondition>): boolean {
    return expectedPostconditions.every((condition) => {
      const resource = this.#backend.state.resources.get(condition.resourceId)
      if (condition.state === 'missing') return resource === undefined
      return (
        resource?.metadataVersion.revision === condition.metadataVersion.revision &&
        resource.metadataVersion.digest === condition.metadataVersion.digest
      )
    })
  }

  #publish(campaignId: CampaignId): void {
    this.#backend.snapshotCache.delete(campaignId)
    for (const listener of this.#backend.listeners.get(campaignId) ?? []) {
      try {
        listener()
      } catch {
        // Observers cannot change the outcome of an already committed catalog operation.
      }
    }
  }

  async #deepCopy(
    envelope: CommandEnvelope<Extract<ResourceStructureCommand, { type: 'deepCopy' }>>,
    state: CatalogState,
    audit: AuditStamp,
  ): Promise<PreparedDeepCopy> {
    if (!this.#contentCopy) {
      return {
        result: { status: 'unavailable', reason: 'capability_not_supported' },
        commitContent: () => undefined,
      }
    }
    const { campaignId, command, operationId } = envelope
    requireActiveResourceFolder(
      { resources: state.resources, tombstones: state.tombstones },
      campaignId,
      command.destinationParentId,
    )
    const { roots, closure } = activeClosure(state, campaignId, command.sourceRootIds)
    const rootIds = new Set(roots.map((resource) => resource.id))
    const resourceMap: Array<ResourceCopyMapEntry> = closure.map((resource) => ({
      sourceId: resource.id,
      destinationId: generateDomainId(DOMAIN_ID_KIND.resource),
    }))
    const destinationIdBySourceId = new Map(
      resourceMap.map((entry) => [entry.sourceId, entry.destinationId]),
    )
    const copies = await Promise.all(
      closure.map(async (source) => {
        const id = destinationIdBySourceId.get(source.id)!
        const parentId = rootIds.has(source.id)
          ? command.destinationParentId
          : destinationIdBySourceId.get(source.parentId!)!
        const title = canonicalizeResourceTitle(source.title)
        if (title !== source.title) {
          throw new ResourceGraphRejection('content_integrity_failure')
        }
        const metadata = {
          parentId,
          kind: source.kind,
          title,
          icon: source.icon,
          color: source.color,
          lifecycle: 'active' as const,
        }
        return {
          source,
          destination: {
            id,
            campaignId,
            ...metadata,
            lifecycle: { state: 'active' as const },
            metadataVersion: await initialResourceMetadataVersion(metadata),
            created: audit,
            updated: audit,
          } satisfies ResourceRecord,
        }
      }),
    )

    let commitContent: () => void
    try {
      const plan = await this.#contentCopy.prepare({
        sourceResourceIds: closure.map((resource) => resource.id),
        resourceMap,
      })
      const resourceTargets: Array<CanonicalTargetMapEntry> = resourceMap.map((entry) => ({
        source: { kind: 'resource', resourceId: entry.sourceId },
        destination: { kind: 'resource', resourceId: entry.destinationId },
      }))
      commitContent = await this.#contentCopy.finalize(plan, [
        ...resourceTargets,
        ...this.#contentCopy.referenceableTargets(plan),
      ])
    } catch {
      throw new ResourceGraphRejection('content_integrity_failure')
    }

    for (const copy of copies) state.resources.set(copy.destination.id, copy.destination)
    return {
      result: completed(
        campaignId,
        operationId,
        {
          type: 'deepCopied',
          roots: roots.map((root) => ({
            sourceRootId: root.id,
            destinationRootId: destinationIdBySourceId.get(root.id)!,
          })),
        },
        postconditions(copies.map((copy) => copy.destination)),
      ),
      commitContent,
    }
  }

  async #apply(
    actorId: CampaignMemberId,
    envelope: CommandEnvelope<ResourceStructureCommand>,
    state: CatalogState,
  ): Promise<ResourceStructureCommandResult> {
    if (envelope.command.type === 'deepCopy') {
      return { status: 'unavailable', reason: 'capability_not_supported' }
    }
    const transition = await transitionResourceGraph(
      { resources: state.resources, tombstones: state.tombstones },
      envelope.campaignId,
      envelope.operationId,
      envelope.command,
      { at: this.#now(), by: actorId },
    )
    for (const resource of transition.upserted) state.resources.set(resource.id, resource)
    for (const tombstone of transition.tombstones) {
      state.tombstones.set(tombstone.resourceId, tombstone)
    }
    for (const resourceId of transition.deletedResourceIds) {
      state.resources.delete(resourceId)
      state.aliases.delete(resourceId)
    }
    const deletedIds = new Set(transition.deletedResourceIds)
    const assetsFolderId = state.assetsFolders.get(envelope.campaignId)
    if (assetsFolderId !== undefined && deletedIds.has(assetsFolderId)) {
      state.assetsFolders.delete(envelope.campaignId)
    }
    return { status: 'completed', receipt: transition.receipt }
  }
}
