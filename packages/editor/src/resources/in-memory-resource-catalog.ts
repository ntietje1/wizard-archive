import { DOMAIN_ID_KIND, assertDomainId, generateDomainId } from './domain-id'
import type { CampaignId, CampaignMemberId, ResourceId } from './domain-id'
import type {
  ApplicationResourceRole,
  ResourceCatalogPage,
  ResourceCatalogReader,
  ResourceCatalogSnapshotSource,
  ResourceCatalogSnapshot,
  ResourceMetadataChanges,
  SourcePathAlias,
} from './resource-catalog-contract'
import { assertResourceCatalogPageSize } from './resource-catalog-contract'
import { assertSourcePathAlias } from './source-path-alias'
import type {
  AuthoritativeResourceOperationExecutor,
  CommandEnvelope,
  ResourceCommandReceipt,
  ResourcePostcondition,
  ResourceStructureCommand,
  ResourceStructureCommandResult,
  ResourceStructureRejection,
} from './resource-command-contract'
import {
  RESOURCE_COMMAND_PROTOCOL_VERSION,
  fingerprintResourceStructureCommand,
  normalizeResourceStructureCommand,
  resourceStructureInputRejection,
} from './resource-command-protocol'
import type { AuditStamp, ResourceRecord } from './resource-contract'
import {
  MAX_SYNCHRONOUS_RESOURCE_CLOSURE,
  canonicalizeResourceTitle,
  resourceMetadataValue,
} from './resource-contract'
import {
  advanceResourceMetadataVersion,
  createResourceTombstone,
  initialResourceMetadataVersion,
} from './resource-metadata-version'
import type { ResourceTombstone } from './resource-metadata-version'
import { InMemoryResourceOperationLedger } from './resource-operation-ledger'
import type {
  CanonicalTargetMapEntry,
  ContentCopyPlanner,
  ResourceCopyMapEntry,
} from './content-copy-contract'

export type ResourceOperationAuthorizer = (
  actorId: CampaignMemberId,
  envelope: CommandEnvelope<ResourceStructureCommand>,
) => boolean | Promise<boolean>

export type InMemoryResourceCatalogOptions = Readonly<{
  initialSnapshot?: ResourceCatalogSnapshot
}>

export type InMemoryResourceOperationExecutorOptions<TContentCopyPlan = never> = Readonly<{
  authorize: ResourceOperationAuthorizer
  contentCopy?: ContentCopyPlanner<TContentCopyPlan, () => void>
  now?: () => number
}>

type CatalogState = {
  resources: Map<ResourceId, ResourceRecord>
  tombstones: Map<ResourceId, ResourceTombstone>
  aliases: Map<ResourceId, Array<SourcePathAlias>>
  roles: Map<CampaignId, Map<string, ResourceId>>
}

type InMemoryResourceCatalogBackend = {
  state: CatalogState
  operationQueue: Promise<void>
  listeners: Map<CampaignId, Set<() => void>>
  snapshotCache: Map<CampaignId, ResourceCatalogSnapshot>
}

const catalogBackends = new WeakMap<InMemoryResourceCatalog, InMemoryResourceCatalogBackend>()

function requireCatalogBackend(catalog: InMemoryResourceCatalog): InMemoryResourceCatalogBackend {
  const backend = catalogBackends.get(catalog)
  if (!backend) throw new TypeError('Unknown in-memory resource catalog')
  return backend
}

class CatalogRejection extends Error {
  constructor(readonly reason: ResourceStructureRejection) {
    super(reason)
  }
}

function emptyCatalogState(): CatalogState {
  return {
    resources: new Map(),
    tombstones: new Map(),
    aliases: new Map(),
    roles: new Map(),
  }
}

function cloneCatalogState(state: CatalogState): CatalogState {
  return {
    resources: new Map(state.resources),
    tombstones: new Map(state.tombstones),
    aliases: new Map(
      Array.from(state.aliases, ([resourceId, aliases]) => [resourceId, [...aliases]]),
    ),
    roles: new Map(Array.from(state.roles, ([campaignId, roles]) => [campaignId, new Map(roles)])),
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

function addSnapshotRoles(state: CatalogState, snapshot: ResourceCatalogSnapshot): void {
  const roles = new Map<string, ResourceId>()
  for (const role of snapshot.roles) {
    if (roles.has(role.role) || !state.resources.has(role.resourceId)) {
      throw new TypeError('Invalid initial resource catalog role')
    }
    roles.set(role.role, role.resourceId)
  }
  if (roles.size > 0) state.roles.set(snapshot.campaignId, roles)
}

function catalogStateFromSnapshot(snapshot: ResourceCatalogSnapshot): CatalogState {
  const state = emptyCatalogState()
  addSnapshotResources(state, snapshot)
  addSnapshotTombstones(state, snapshot)
  validateSnapshotHierarchy(state, snapshot.campaignId)
  addSnapshotAliases(state, snapshot)
  addSnapshotRoles(state, snapshot)
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

function byRole(left: ApplicationResourceRole, right: ApplicationResourceRole): number {
  return left.role.localeCompare(right.role) || left.resourceId.localeCompare(right.resourceId)
}

function operationRoots(
  state: CatalogState,
  campaignId: CampaignId,
  resourceIds: ReadonlyArray<ResourceId>,
): ReadonlyArray<ResourceRecord> {
  const selected = new Set(resourceIds)
  const resources = resourceIds.map((resourceId) => ownedResource(state, campaignId, resourceId))
  if (resources.length > MAX_SYNCHRONOUS_RESOURCE_CLOSURE) {
    throw new CatalogRejection('closure_too_large')
  }
  return resources.filter((resource) => {
    let parentId = resource.parentId
    while (parentId !== null) {
      if (selected.has(parentId)) return false
      const parent = state.resources.get(parentId)
      if (!parent || parent.campaignId !== campaignId) break
      parentId = parent.parentId
    }
    return true
  })
}

function ownedResource(
  state: CatalogState,
  campaignId: CampaignId,
  resourceId: ResourceId,
): ResourceRecord {
  const resource = state.resources.get(resourceId)
  if (!resource) throw new CatalogRejection('resource_missing')
  if (resource.campaignId !== campaignId) throw new CatalogRejection('ownership_mismatch')
  return resource
}

function activeFolder(
  state: CatalogState,
  campaignId: CampaignId,
  parentId: ResourceId | null,
): ResourceRecord | null {
  if (parentId === null) return null
  const parent = state.resources.get(parentId)
  if (!parent) throw new CatalogRejection('invalid_parent')
  if (parent.campaignId !== campaignId) throw new CatalogRejection('ownership_mismatch')
  if (parent.kind !== 'folder') throw new CatalogRejection('invalid_parent_kind')
  if (parent.lifecycle.state !== 'active') throw new CatalogRejection('invalid_parent')
  return parent
}

function descendants(
  state: CatalogState,
  campaignId: CampaignId,
  roots: ReadonlyArray<ResourceRecord>,
): ReadonlyArray<ResourceRecord> {
  const result: Array<ResourceRecord> = []
  const pending = roots.map((resource) => resource.id)
  const visited = new Set<ResourceId>()

  while (pending.length > 0) {
    const resourceId = pending.shift()!
    if (visited.has(resourceId)) continue
    visited.add(resourceId)
    const resource = ownedResource(state, campaignId, resourceId)
    result.push(resource)
    if (result.length > MAX_SYNCHRONOUS_RESOURCE_CLOSURE) {
      throw new CatalogRejection('closure_too_large')
    }
    for (const candidate of state.resources.values()) {
      if (candidate.campaignId === campaignId && candidate.parentId === resourceId) {
        pending.push(candidate.id)
      }
    }
  }

  return result.sort(byResourceId)
}

function lifecycleClosure(
  state: CatalogState,
  campaignId: CampaignId,
  resourceIds: ReadonlyArray<ResourceId>,
  lifecycle: ResourceRecord['lifecycle']['state'],
): Readonly<{ roots: ReadonlyArray<ResourceRecord>; closure: ReadonlyArray<ResourceRecord> }> {
  const roots = operationRoots(state, campaignId, resourceIds)
  const closure = descendants(state, campaignId, roots)
  if (closure.some((resource) => resource.lifecycle.state !== lifecycle)) {
    throw new CatalogRejection('invalid_lifecycle')
  }
  return { roots, closure }
}

async function replaceMetadata(
  resource: ResourceRecord,
  changes: ResourceMetadataChanges & { lifecycle?: ResourceRecord['lifecycle'] },
  audit: AuditStamp,
): Promise<ResourceRecord> {
  const candidate: ResourceRecord = {
    ...resource,
    ...changes,
    updated: audit,
  }
  const metadataVersion = await advanceResourceMetadataVersion(
    resource.metadataVersion,
    resourceMetadataValue(candidate),
  )
  if (metadataVersion === resource.metadataVersion) return resource
  return { ...candidate, metadataVersion }
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
  constructor(options: InMemoryResourceCatalogOptions = {}) {
    catalogBackends.set(this, {
      state: options.initialSnapshot
        ? catalogStateFromSnapshot(options.initialSnapshot)
        : emptyCatalogState(),
      operationQueue: Promise.resolve(),
      listeners: new Map(),
      snapshotCache: new Map(),
    })
  }

  getSnapshot(campaignId: CampaignId): ResourceCatalogSnapshot {
    const backend = requireCatalogBackend(this)
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
      roles: Array.from(backend.state.roles.get(campaignId) ?? [], ([role, resourceId]) => ({
        role,
        resourceId,
      })).sort(byRole),
    } satisfies ResourceCatalogSnapshot
    backend.snapshotCache.set(campaignId, snapshot)
    return snapshot
  }

  subscribe(campaignId: CampaignId, listener: () => void): () => void {
    const backend = requireCatalogBackend(this)
    const listeners = backend.listeners.get(campaignId) ?? new Set<() => void>()
    listeners.add(listener)
    backend.listeners.set(campaignId, listeners)
    return () => {
      listeners.delete(listener)
      if (listeners.size === 0) backend.listeners.delete(campaignId)
    }
  }

  getResource(campaignId: CampaignId, resourceId: ResourceId): Promise<ResourceRecord | null> {
    const resource = requireCatalogBackend(this).state.resources.get(resourceId)
    return Promise.resolve(resource?.campaignId === campaignId ? resource : null)
  }

  getResources(
    campaignId: CampaignId,
    resourceIds: ReadonlyArray<ResourceId>,
  ): Promise<ReadonlyArray<ResourceRecord>> {
    const state = requireCatalogBackend(this).state
    return Promise.resolve(
      resourceIds.flatMap((resourceId) => {
        const resource = state.resources.get(resourceId)
        return resource?.campaignId === campaignId ? [resource] : []
      }),
    )
  }

  listChildren(
    campaignId: CampaignId,
    parentId: ResourceId | null,
    lifecycle: 'active' | 'trashed',
    limit: number,
    cursor: string | null,
  ): Promise<ResourceCatalogPage<ResourceRecord>> {
    try {
      assertResourceCatalogPageSize(limit)
    } catch (error) {
      return Promise.reject(error)
    }
    const candidates = Array.from(requireCatalogBackend(this).state.resources.values())
      .filter(
        (resource) =>
          resource.campaignId === campaignId &&
          resource.parentId === parentId &&
          resource.lifecycle.state === lifecycle &&
          (cursor === null || resource.id > cursor),
      )
      .sort(byResourceId)
    const items = candidates.slice(0, limit)
    return Promise.resolve({
      items,
      cursor: candidates.length > items.length ? items[items.length - 1]!.id : null,
    })
  }

  getTombstone(campaignId: CampaignId, resourceId: ResourceId): Promise<ResourceTombstone | null> {
    const tombstone = requireCatalogBackend(this).state.tombstones.get(resourceId)
    return Promise.resolve(tombstone?.campaignId === campaignId ? tombstone : null)
  }

  listAliases(
    campaignId: CampaignId,
    resourceId: ResourceId,
  ): Promise<ReadonlyArray<SourcePathAlias>> {
    return Promise.resolve(
      (requireCatalogBackend(this).state.aliases.get(resourceId) ?? [])
        .filter((alias) => alias.campaignId === campaignId)
        .sort(byAlias),
    )
  }

  listRoles(campaignId: CampaignId): Promise<ReadonlyArray<ApplicationResourceRole>> {
    return Promise.resolve(
      Array.from(
        requireCatalogBackend(this).state.roles.get(campaignId) ?? [],
        ([role, resourceId]) => ({
          role,
          resourceId,
        }),
      ).sort(byRole),
    )
  }

  readSnapshot(campaignId: CampaignId): Promise<ResourceCatalogSnapshot> {
    return Promise.resolve(this.getSnapshot(campaignId))
  }
}

export class InMemoryResourceOperationExecutor<
  TContentCopyPlan = never,
> implements AuthoritativeResourceOperationExecutor {
  readonly #backend: InMemoryResourceCatalogBackend
  readonly #ledger = new InMemoryResourceOperationLedger<ResourceCommandReceipt>()
  readonly #authorize: ResourceOperationAuthorizer
  readonly #contentCopy: ContentCopyPlanner<TContentCopyPlan, () => void> | undefined
  readonly #now: () => number

  constructor(
    catalog: InMemoryResourceCatalog,
    options: InMemoryResourceOperationExecutorOptions<TContentCopyPlan>,
  ) {
    this.#backend = requireCatalogBackend(catalog)
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

  setRole(campaignId: CampaignId, role: ApplicationResourceRole): Promise<void> {
    return this.#enqueue(() => {
      ownedResource(this.#backend.state, campaignId, role.resourceId)
      const roles = this.#backend.state.roles.get(campaignId) ?? new Map<string, ResourceId>()
      if (roles.get(role.role) === role.resourceId) return
      roles.set(role.role, role.resourceId)
      this.#backend.state.roles.set(campaignId, roles)
      this.#publish(campaignId)
    })
  }

  removeRole(campaignId: CampaignId, role: string): Promise<void> {
    return this.#enqueue(() => {
      if (this.#backend.state.roles.get(campaignId)?.delete(role)) this.#publish(campaignId)
    })
  }

  execute(
    actorId: CampaignMemberId,
    envelope: CommandEnvelope<ResourceStructureCommand>,
  ): Promise<ResourceStructureCommandResult> {
    return this.#enqueue(() => this.#execute(actorId, envelope))
  }

  #enqueue<TResult>(operation: () => TResult | Promise<TResult>): Promise<TResult> {
    const result = this.#backend.operationQueue.then(operation)
    this.#backend.operationQueue = result.then(
      () => undefined,
      () => undefined,
    )
    return result
  }

  async #execute(
    actorId: CampaignMemberId,
    envelope: CommandEnvelope<ResourceStructureCommand>,
  ): Promise<ResourceStructureCommandResult> {
    let normalizedEnvelope: CommandEnvelope<ResourceStructureCommand>
    try {
      normalizedEnvelope = {
        campaignId: assertDomainId(DOMAIN_ID_KIND.campaign, envelope.campaignId),
        operationId: assertDomainId(DOMAIN_ID_KIND.operation, envelope.operationId),
        command: normalizeResourceStructureCommand(envelope.command),
      }
      assertDomainId(DOMAIN_ID_KIND.campaignMember, actorId)
    } catch (error) {
      return { status: 'rejected', reason: resourceStructureInputRejection(error) }
    }

    if (!(await this.#authorize(actorId, normalizedEnvelope))) {
      return { status: 'rejected', reason: 'unauthorized' }
    }
    const fingerprint = await fingerprintResourceStructureCommand(normalizedEnvelope.command)
    const lookup = this.#ledger.lookup(
      normalizedEnvelope.campaignId,
      actorId,
      normalizedEnvelope.operationId,
      fingerprint,
    )
    if (lookup.status === 'replay') return { status: 'completed', receipt: lookup.receipt }
    if (lookup.status === 'rejected') return { status: 'rejected', reason: lookup.reason }

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
      if (error instanceof CatalogRejection) return { status: 'rejected', reason: error.reason }
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
    activeFolder(state, campaignId, command.destinationParentId)
    const { roots, closure } = lifecycleClosure(state, campaignId, command.sourceRootIds, 'active')
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
        if (title !== source.title) throw new CatalogRejection('content_integrity_failure')
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
      throw new CatalogRejection('content_integrity_failure')
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
    const audit = { at: this.#now(), by: actorId } as const
    switch (envelope.command.type) {
      case 'create':
        return await this.#create({ ...envelope, command: envelope.command }, state, audit)
      case 'updateMetadata':
        return await this.#updateMetadata({ ...envelope, command: envelope.command }, state, audit)
      case 'move':
        return await this.#move({ ...envelope, command: envelope.command }, state, audit)
      case 'trash':
        return await this.#trash({ ...envelope, command: envelope.command }, state, audit)
      case 'restore':
        return await this.#restore({ ...envelope, command: envelope.command }, state, audit)
      case 'permanentlyDelete':
        return await this.#permanentlyDelete(
          { ...envelope, command: envelope.command },
          state,
          audit,
        )
      case 'deepCopy':
        return { status: 'unavailable', reason: 'capability_not_supported' }
    }
  }

  async #create(
    envelope: CommandEnvelope<Extract<ResourceStructureCommand, { type: 'create' }>>,
    state: CatalogState,
    audit: AuditStamp,
  ): Promise<ResourceStructureCommandResult> {
    const { command, campaignId, operationId } = envelope
    const existing = state.resources.get(command.resourceId)
    if (existing) {
      throw new CatalogRejection(
        existing.campaignId === campaignId ? 'invalid_command' : 'ownership_mismatch',
      )
    }
    const tombstone = state.tombstones.get(command.resourceId)
    if (tombstone) {
      throw new CatalogRejection(
        tombstone.campaignId === campaignId ? 'invalid_command' : 'ownership_mismatch',
      )
    }
    activeFolder(state, campaignId, command.parentId)
    const metadata = {
      parentId: command.parentId,
      kind: command.kind,
      title: command.title,
      icon: command.icon,
      color: command.color,
      lifecycle: 'active' as const,
    }
    const resource: ResourceRecord = {
      id: command.resourceId,
      campaignId,
      ...metadata,
      lifecycle: { state: 'active' },
      metadataVersion: await initialResourceMetadataVersion(metadata),
      created: audit,
      updated: audit,
    }
    state.resources.set(resource.id, resource)
    return completed(
      campaignId,
      operationId,
      { type: 'created', resourceId: resource.id },
      postconditions([resource]),
    )
  }

  async #updateMetadata(
    envelope: CommandEnvelope<Extract<ResourceStructureCommand, { type: 'updateMetadata' }>>,
    state: CatalogState,
    audit: AuditStamp,
  ): Promise<ResourceStructureCommandResult> {
    const { command, campaignId, operationId } = envelope
    const resource = ownedResource(state, campaignId, command.resourceId)
    if (resource.lifecycle.state !== 'active') throw new CatalogRejection('invalid_lifecycle')
    const updated = await replaceMetadata(resource, command.changes, audit)
    state.resources.set(updated.id, updated)
    return completed(
      campaignId,
      operationId,
      { type: 'metadataUpdated', resourceId: updated.id },
      postconditions([updated]),
    )
  }

  async #move(
    envelope: CommandEnvelope<Extract<ResourceStructureCommand, { type: 'move' }>>,
    state: CatalogState,
    audit: AuditStamp,
  ): Promise<ResourceStructureCommandResult> {
    const { command, campaignId, operationId } = envelope
    const roots = operationRoots(state, campaignId, command.resourceIds)
    const destination = activeFolder(state, campaignId, command.destinationParentId)
    if (destination) {
      const movedIds = new Set(roots.map((resource) => resource.id))
      let ancestor: ResourceRecord | undefined = destination
      while (ancestor) {
        if (movedIds.has(ancestor.id)) throw new CatalogRejection('hierarchy_cycle')
        ancestor = ancestor.parentId === null ? undefined : state.resources.get(ancestor.parentId)
      }
    }
    const updated: Array<ResourceRecord> = []
    for (const resource of roots) {
      if (resource.lifecycle.state !== 'active') throw new CatalogRejection('invalid_lifecycle')
      const moved = await replaceMetadata(
        resource,
        { parentId: command.destinationParentId },
        audit,
      )
      state.resources.set(moved.id, moved)
      updated.push(moved)
    }
    return completed(
      campaignId,
      operationId,
      { type: 'moved', resourceIds: updated.map((resource) => resource.id) },
      postconditions(updated),
    )
  }

  async #trash(
    envelope: CommandEnvelope<Extract<ResourceStructureCommand, { type: 'trash' }>>,
    state: CatalogState,
    audit: AuditStamp,
  ): Promise<ResourceStructureCommandResult> {
    const { command, campaignId, operationId } = envelope
    const { closure } = lifecycleClosure(state, campaignId, command.resourceIds, 'active')
    const updated: Array<ResourceRecord> = []
    for (const resource of closure) {
      const trashed = await replaceMetadata(
        resource,
        { lifecycle: { state: 'trashed', ...audit } },
        audit,
      )
      state.resources.set(trashed.id, trashed)
      updated.push(trashed)
    }
    return completed(
      campaignId,
      operationId,
      { type: 'trashed', resourceIds: updated.map((resource) => resource.id) },
      postconditions(updated),
    )
  }

  async #restore(
    envelope: CommandEnvelope<Extract<ResourceStructureCommand, { type: 'restore' }>>,
    state: CatalogState,
    audit: AuditStamp,
  ): Promise<ResourceStructureCommandResult> {
    const { command, campaignId, operationId } = envelope
    const { roots, closure } = lifecycleClosure(state, campaignId, command.resourceIds, 'trashed')
    const rootIds = new Set(roots.map((resource) => resource.id))
    const updated: Array<ResourceRecord> = []
    for (const resource of closure) {
      const parent = resource.parentId === null ? null : state.resources.get(resource.parentId)
      const parentId =
        rootIds.has(resource.id) &&
        (!parent || parent.campaignId !== campaignId || parent.lifecycle.state !== 'active')
          ? null
          : resource.parentId
      const restored = await replaceMetadata(
        resource,
        { parentId, lifecycle: { state: 'active' } },
        audit,
      )
      state.resources.set(restored.id, restored)
      updated.push(restored)
    }
    return completed(
      campaignId,
      operationId,
      { type: 'restored', resourceIds: updated.map((resource) => resource.id) },
      postconditions(updated),
    )
  }

  async #permanentlyDelete(
    envelope: CommandEnvelope<Extract<ResourceStructureCommand, { type: 'permanentlyDelete' }>>,
    state: CatalogState,
    audit: AuditStamp,
  ): Promise<ResourceStructureCommandResult> {
    const { command, campaignId, operationId } = envelope
    const roots = operationRoots(state, campaignId, command.resourceIds)
    for (const root of roots) {
      const parent = root.parentId === null ? null : state.resources.get(root.parentId)
      if (
        root.lifecycle.state !== 'trashed' ||
        (parent?.campaignId === campaignId && parent.lifecycle.state === 'trashed')
      ) {
        throw new CatalogRejection('invalid_root_selection')
      }
    }
    const closure = descendants(state, campaignId, roots)
    if (closure.some((resource) => resource.lifecycle.state !== 'trashed')) {
      throw new CatalogRejection('invalid_lifecycle')
    }
    const deletedResourceIds = closure.map((resource) => resource.id)
    const tombstones: Array<ResourceTombstone> = []
    for (const resource of closure) {
      const tombstone = await createResourceTombstone(
        resource.id,
        campaignId,
        resource.metadataVersion,
        audit.at,
      )
      state.resources.delete(resource.id)
      state.tombstones.set(resource.id, tombstone)
      state.aliases.delete(resource.id)
      tombstones.push(tombstone)
    }
    const deletedIds = new Set(deletedResourceIds)
    const roles = state.roles.get(campaignId)
    if (roles) {
      for (const [role, resourceId] of roles) {
        if (deletedIds.has(resourceId)) roles.delete(role)
      }
    }
    return completed(
      campaignId,
      operationId,
      { type: 'permanentlyDeleted', resourceIds: deletedResourceIds },
      deletedResourceIds.map((resourceId) => ({ state: 'missing', resourceId })),
    )
  }
}
