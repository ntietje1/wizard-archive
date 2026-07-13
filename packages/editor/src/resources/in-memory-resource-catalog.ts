import { DOMAIN_ID_KIND, assertDomainId } from './domain-id'
import type { CampaignId, CampaignMemberId, ResourceId } from './domain-id'
import type {
  ApplicationResourceRole,
  ResourceCatalogPage,
  ResourceCatalogReader,
  ResourceCatalogSnapshot,
  ResourceMetadataChanges,
  SourcePathAlias,
} from './resource-catalog-contract'
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
} from './resource-command-protocol'
import type { AuditStamp, ResourceRecord } from './resource-contract'
import { MAX_SYNCHRONOUS_RESOURCE_CLOSURE, resourceMetadataValue } from './resource-contract'
import {
  advanceResourceMetadataVersion,
  createResourceTombstone,
  initialResourceMetadataVersion,
} from './resource-metadata-version'
import type { ResourceTombstone } from './resource-metadata-version'
import { InMemoryResourceOperationLedger } from './resource-operation-ledger'

export const MAX_RESOURCE_CATALOG_PAGE_SIZE = 200

export type ResourceOperationAuthorizer = (
  actorId: CampaignMemberId,
  envelope: CommandEnvelope<ResourceStructureCommand>,
) => boolean | Promise<boolean>

export type InMemoryResourceCatalogOptions = Readonly<{
  authorize: ResourceOperationAuthorizer
  now?: () => number
}>

type CatalogState = {
  resources: Map<ResourceId, ResourceRecord>
  tombstones: Map<ResourceId, ResourceTombstone>
  aliases: Map<ResourceId, Array<SourcePathAlias>>
  roles: Map<CampaignId, Map<string, ResourceId>>
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

function byResourceId(left: ResourceRecord, right: ResourceRecord): number {
  return left.id.localeCompare(right.id)
}

function byTombstoneResourceId(left: ResourceTombstone, right: ResourceTombstone): number {
  return left.resourceId.localeCompare(right.resourceId)
}

function byAlias(left: SourcePathAlias, right: SourcePathAlias): number {
  return (
    left.resourceId.localeCompare(right.resourceId) ||
    left.value.normalizedPath.localeCompare(right.value.normalizedPath) ||
    left.firstSeenImportJobId.localeCompare(right.firstSeenImportJobId)
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
  const parent = ownedResource(state, campaignId, parentId)
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

function inputRejection(error: unknown): ResourceStructureRejection {
  if (!(error instanceof Error)) return 'invalid_command'
  if (error.message.includes('UUIDv7')) return 'invalid_uuid'
  if (error.message.includes('title') || error.message.includes('Title')) return 'invalid_title'
  return 'invalid_command'
}

export class InMemoryResourceCatalog
  implements ResourceCatalogReader, AuthoritativeResourceOperationExecutor
{
  #state = emptyCatalogState()
  readonly #ledger = new InMemoryResourceOperationLedger<ResourceCommandReceipt>()
  readonly #authorize: ResourceOperationAuthorizer
  readonly #now: () => number
  #operationQueue: Promise<void> = Promise.resolve()

  constructor(options: InMemoryResourceCatalogOptions) {
    this.#authorize = options.authorize
    this.#now = options.now ?? Date.now
  }

  getResource(campaignId: CampaignId, resourceId: ResourceId): Promise<ResourceRecord | null> {
    const resource = this.#state.resources.get(resourceId)
    return Promise.resolve(resource?.campaignId === campaignId ? resource : null)
  }

  getResources(
    campaignId: CampaignId,
    resourceIds: ReadonlyArray<ResourceId>,
  ): Promise<ReadonlyArray<ResourceRecord>> {
    return Promise.resolve(
      resourceIds.flatMap((resourceId) => {
        const resource = this.#state.resources.get(resourceId)
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
    if (!Number.isSafeInteger(limit) || limit < 1 || limit > MAX_RESOURCE_CATALOG_PAGE_SIZE) {
      return Promise.reject(
        new RangeError(
          `Resource catalog page size must be between 1 and ${MAX_RESOURCE_CATALOG_PAGE_SIZE}`,
        ),
      )
    }
    const candidates = Array.from(this.#state.resources.values())
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
      cursor: candidates.length > items.length ? items.at(-1)!.id : null,
    })
  }

  getTombstone(campaignId: CampaignId, resourceId: ResourceId): Promise<ResourceTombstone | null> {
    const tombstone = this.#state.tombstones.get(resourceId)
    return Promise.resolve(tombstone?.campaignId === campaignId ? tombstone : null)
  }

  listAliases(
    campaignId: CampaignId,
    resourceId: ResourceId,
  ): Promise<ReadonlyArray<SourcePathAlias>> {
    return Promise.resolve(
      (this.#state.aliases.get(resourceId) ?? [])
        .filter((alias) => alias.campaignId === campaignId)
        .sort(byAlias),
    )
  }

  listRoles(campaignId: CampaignId): Promise<ReadonlyArray<ApplicationResourceRole>> {
    return Promise.resolve(
      Array.from(this.#state.roles.get(campaignId) ?? [], ([role, resourceId]) => ({
        role,
        resourceId,
      })).sort(byRole),
    )
  }

  async readSnapshot(campaignId: CampaignId): Promise<ResourceCatalogSnapshot> {
    return {
      campaignId,
      resources: Array.from(this.#state.resources.values())
        .filter((resource) => resource.campaignId === campaignId)
        .sort(byResourceId),
      tombstones: Array.from(this.#state.tombstones.values())
        .filter((tombstone) => tombstone.campaignId === campaignId)
        .sort(byTombstoneResourceId),
      aliases: Array.from(this.#state.aliases.values())
        .flat()
        .filter((alias) => alias.campaignId === campaignId)
        .sort(byAlias),
      roles: await this.listRoles(campaignId),
    }
  }

  appendAlias(alias: SourcePathAlias): Promise<SourcePathAlias> {
    return this.#enqueue(() => {
      ownedResource(this.#state, alias.campaignId, alias.resourceId)
      const current = this.#state.aliases.get(alias.resourceId) ?? []
      const existing = current.find(
        (candidate) => candidate.value.normalizedPath === alias.value.normalizedPath,
      )
      if (existing) return existing
      this.#state.aliases.set(alias.resourceId, [...current, alias])
      return alias
    })
  }

  setRole(campaignId: CampaignId, role: ApplicationResourceRole): Promise<void> {
    return this.#enqueue(() => {
      ownedResource(this.#state, campaignId, role.resourceId)
      const roles = this.#state.roles.get(campaignId) ?? new Map<string, ResourceId>()
      roles.set(role.role, role.resourceId)
      this.#state.roles.set(campaignId, roles)
    })
  }

  removeRole(campaignId: CampaignId, role: string): Promise<void> {
    return this.#enqueue(() => {
      this.#state.roles.get(campaignId)?.delete(role)
    })
  }

  execute(
    actorId: CampaignMemberId,
    envelope: CommandEnvelope<ResourceStructureCommand>,
  ): Promise<ResourceStructureCommandResult> {
    return this.#enqueue(() => this.#execute(actorId, envelope))
  }

  #enqueue<TResult>(operation: () => TResult | Promise<TResult>): Promise<TResult> {
    const result = this.#operationQueue.then(operation)
    this.#operationQueue = result.then(
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
      return { status: 'rejected', reason: inputRejection(error) }
    }

    if (!(await this.#authorize(actorId, normalizedEnvelope))) {
      return { status: 'rejected', reason: 'unauthorized' }
    }
    if (normalizedEnvelope.command.type === 'deepCopy') {
      return { status: 'unavailable', reason: 'capability_not_supported' }
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

    const draft = cloneCatalogState(this.#state)
    let result: ResourceStructureCommandResult
    try {
      result = await this.#apply(actorId, normalizedEnvelope, draft)
    } catch (error) {
      if (error instanceof CatalogRejection) return { status: 'rejected', reason: error.reason }
      if (error instanceof RangeError && error.message === 'version_exhausted') {
        return { status: 'rejected', reason: 'version_exhausted' }
      }
      throw error
    }
    if (result.status !== 'completed') return result

    this.#ledger.record({
      campaignId: normalizedEnvelope.campaignId,
      actorId,
      operationId: normalizedEnvelope.operationId,
      protocolVersion: RESOURCE_COMMAND_PROTOCOL_VERSION,
      fingerprint,
      receipt: result.receipt,
    })
    this.#state = draft
    return result
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
    if (state.tombstones.has(command.resourceId)) throw new CatalogRejection('invalid_command')
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
