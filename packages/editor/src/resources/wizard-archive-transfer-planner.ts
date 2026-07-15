import type { CanonicalTargetMapEntry, ResourceCopyMapEntry } from './content-copy-contract'
import { compareVersionStamps } from './component-version'
import type { VersionComparison, VersionStamp } from './component-version'
import type { CampaignId, ResourceId } from './domain-id'
import { initialResourceMetadataVersion } from './resource-metadata-version'
import type { ResourceKind } from './resource-record'
import type { SourcePathAlias } from './resource-catalog-contract'
import type {
  SameCampaignPolicy,
  WizardArchiveCanvasSection,
  WizardArchiveFileSection,
  WizardArchiveManifest,
  WizardArchiveMapSection,
  WizardArchiveMode,
  WizardArchiveNoteSection,
  WizardArchiveResource,
} from './wizard-archive-contract'

type ContentKind = Exclude<ResourceKind, 'folder'>
type ComparedComponent = 'metadata' | 'content' | 'deletion'

export type DestinationResourceVersion = Readonly<{
  resourceId: ResourceId
  campaignId: CampaignId
  kind: ResourceKind
  metadataVersion: VersionStamp
  contentVersion: VersionStamp | null
}>

export type WizardArchiveDestination =
  | Readonly<{
      state: 'existing'
      campaignId: CampaignId
      resources: ReadonlyArray<DestinationResourceVersion>
      tombstones: WizardArchiveManifest['tombstones']
      authorizedRestoreResourceIds: ReadonlyArray<ResourceId>
    }>
  | Readonly<{ state: 'new'; campaignId: CampaignId }>

export type WizardArchivePolicyDecision = Readonly<{
  resourceId: ResourceId
  component: ComparedComponent
  action: SameCampaignPolicy
}>

export type WizardArchiveContentTransferInput<TEntry> = Readonly<{
  mode: WizardArchiveMode
  sourceCampaignId: CampaignId
  destinationCampaignId: CampaignId
  entries: ReadonlyArray<TEntry>
  resourceMap: ReadonlyArray<ResourceCopyMapEntry>
  freshDestinationResourceIds: ReadonlyArray<ResourceId>
  initialContentRevision: 1
}>

export type WizardArchivePreparedContent = Readonly<{
  opaque: unknown
  referenceableTargets: ReadonlyArray<CanonicalTargetMapEntry>
}>

export interface WizardArchiveContentDomainPlanner<TEntry> {
  prepare(input: WizardArchiveContentTransferInput<TEntry>): WizardArchivePreparedContent
  finalize(
    prepared: WizardArchivePreparedContent['opaque'],
    targetMap: ReadonlyArray<CanonicalTargetMapEntry>,
  ): unknown
}

export type WizardArchiveContentDomainPlanners = Readonly<{
  notes: WizardArchiveContentDomainPlanner<WizardArchiveNoteSection>
  files: WizardArchiveContentDomainPlanner<WizardArchiveFileSection>
  maps: WizardArchiveContentDomainPlanner<WizardArchiveMapSection>
  canvases: WizardArchiveContentDomainPlanner<WizardArchiveCanvasSection>
}>

export type WizardArchiveVersionObservation = Readonly<{
  imported: VersionStamp
  destination: VersionStamp
  comparison: VersionComparison
}>

export type WizardArchiveTransferAction = Readonly<{
  resourceId: ResourceId
  component: ComparedComponent
  action:
    | 'create'
    | 'delete'
    | 'keep_destination'
    | 'keep_deletion'
    | 'recover_as_new'
    | 'retain_equal_frontier'
    | 'use_package'
  source: 'automatic' | 'policy'
  observation: WizardArchiveVersionObservation | null
  explanation: string
}>

export type WizardArchiveUnknownComponentDecision = Readonly<{
  component: ComparedComponent
  supportedActions: ReadonlyArray<SameCampaignPolicy>
  observation: WizardArchiveVersionObservation
}>

export type WizardArchiveUnknownDecisionGroup = Readonly<{
  resourceId: ResourceId
  components: ReadonlyArray<WizardArchiveUnknownComponentDecision>
}>

export type WizardArchiveResourceWrite = Readonly<{
  sourceResourceId: ResourceId
  destinationResourceId: ResourceId
  writeMetadata: boolean
  writeContent: boolean
  parentId: ResourceId | null
  kind: ResourceKind
  title: WizardArchiveResource['title']
  icon: WizardArchiveResource['icon']
  color: WizardArchiveResource['color']
  lifecycle: WizardArchiveResource['lifecycle']
  metadataVersion: VersionStamp
}>

export type WizardArchiveContentPlan = Readonly<{
  domain: ContentKind
  plan: unknown
}>

export type WizardArchiveTransferPlan = Readonly<{
  mode: WizardArchiveMode
  destinationCampaignId: CampaignId
  actions: ReadonlyArray<WizardArchiveTransferAction>
  unknownDecisions: ReadonlyArray<WizardArchiveUnknownDecisionGroup>
  resourceMap: ReadonlyArray<ResourceCopyMapEntry>
  targetMap: ReadonlyArray<CanonicalTargetMapEntry>
  resourceWrites: ReadonlyArray<WizardArchiveResourceWrite>
  contentPlans: ReadonlyArray<WizardArchiveContentPlan>
  aliases: ReadonlyArray<SourcePathAlias>
  assetsFolder:
    | Readonly<{ action: 'preserve_destination' }>
    | Readonly<{ action: 'replace_for_new_campaign'; value: ResourceId | null }>
  observations: ReadonlyArray<WizardArchiveVersionObservation>
  explanations: ReadonlyArray<string>
}>

export type WizardArchiveTransferResult =
  | Readonly<{ status: 'planned'; plan: WizardArchiveTransferPlan }>
  | Readonly<{
      status: 'rejected'
      reason:
        | 'foreign_campaign_destination_unsupported'
        | 'invalid_destination_state'
        | 'invalid_package_scope'
        | 'invalid_policy'
        | 'ownership_mismatch'
        | 'resource_kind_mismatch'
        | 'restore_unauthorized'
        | 'unmapped_internal_target'
    }>

type SameCampaignState = {
  actions: Array<WizardArchiveTransferAction>
  unknownDecisions: Array<PendingUnknownDecision>
  observations: Array<WizardArchiveVersionObservation>
  recoveredIds: Map<ResourceId, ResourceId>
  metadataWriteIds: Set<ResourceId>
  contentWriteIds: Set<ResourceId>
}

type SameCampaignContext = Readonly<{
  manifest: WizardArchiveManifest
  destination: Extract<WizardArchiveDestination, { state: 'existing' }>
  policyByComponent: ReadonlyMap<string, SameCampaignPolicy>
  liveById: ReadonlyMap<ResourceId, DestinationResourceVersion>
  tombstoneById: ReadonlyMap<ResourceId, WizardArchiveManifest['tombstones'][number]>
  state: SameCampaignState
  allocateResourceId: () => ResourceId
}>

export async function planWizardArchiveTransfer(
  manifest: WizardArchiveManifest,
  destination: WizardArchiveDestination,
  contentDomains: WizardArchiveContentDomainPlanners,
  allocateResourceId: () => ResourceId,
  policies: ReadonlyArray<WizardArchivePolicyDecision> = [],
): Promise<WizardArchiveTransferResult> {
  if (manifest.scope !== 'full_campaign') return rejected('invalid_package_scope')
  if (destination.state === 'existing' && destination.campaignId !== manifest.sourceCampaignId) {
    return rejected('foreign_campaign_destination_unsupported')
  }
  if (destination.state === 'new' && destination.campaignId === manifest.sourceCampaignId) {
    return rejected('invalid_destination_state')
  }
  if (!packageOwnershipIsValid(manifest)) return rejected('ownership_mismatch')

  return destination.state === 'new'
    ? await planClone(manifest, destination.campaignId, contentDomains, allocateResourceId)
    : await planSameCampaignUpdate(
        manifest,
        destination,
        contentDomains,
        allocateResourceId,
        policies,
      )
}

async function planClone(
  manifest: WizardArchiveManifest,
  destinationCampaignId: CampaignId,
  contentDomains: WizardArchiveContentDomainPlanners,
  allocateResourceId: () => ResourceId,
): Promise<WizardArchiveTransferResult> {
  const resourceMap = manifest.resources.map((resource) => ({
    sourceId: resource.id,
    destinationId: allocateResourceId(),
  }))
  if (!hasUniqueResourceMap(resourceMap)) return rejected('invalid_destination_state')
  const destinationIdBySourceId = new Map(
    resourceMap.map(({ sourceId, destinationId }) => [sourceId, destinationId]),
  )
  const resourceWrites = await Promise.all(
    manifest.resources.map(async (resource) => {
      const destinationResourceId = destinationIdBySourceId.get(resource.id)!
      const parentId = resource.parentId
        ? (destinationIdBySourceId.get(resource.parentId) ?? null)
        : null
      const metadata = {
        parentId,
        kind: resource.kind,
        title: resource.title,
        icon: resource.icon,
        color: resource.color,
        lifecycle: resource.lifecycle,
      }
      return {
        sourceResourceId: resource.id,
        destinationResourceId,
        writeMetadata: true,
        writeContent: resource.contentVersion !== null,
        ...metadata,
        metadataVersion: await initialResourceMetadataVersion(metadata),
      }
    }),
  )
  const content = finalizeContentPlans(
    manifest,
    'new_campaign_clone',
    destinationCampaignId,
    resourceMap,
    contentDomains,
  )
  if (content === null) return rejected('unmapped_internal_target')

  return {
    status: 'planned',
    plan: {
      mode: 'new_campaign_clone',
      destinationCampaignId,
      actions: resourceWrites.flatMap((resource) => [
        action(resource.sourceResourceId, 'metadata', 'create', 'automatic', null),
        ...(resource.writeContent
          ? [action(resource.sourceResourceId, 'content', 'create', 'automatic', null)]
          : []),
      ]),
      unknownDecisions: [],
      resourceMap,
      targetMap: content.targetMap,
      resourceWrites,
      contentPlans: content.plans,
      aliases: manifest.aliases.map((alias) => ({
        ...alias,
        campaignId: destinationCampaignId,
        resourceId: destinationIdBySourceId.get(alias.resourceId)!,
      })),
      assetsFolder: {
        action: 'replace_for_new_campaign',
        value:
          manifest.assetsFolderId === null
            ? null
            : destinationIdBySourceId.get(manifest.assetsFolderId)!,
      },
      observations: [],
      explanations: [
        'Allocated fresh resource identities and revision-1 metadata/content for every live resource.',
        'Ignored source tombstones and excluded destination-owned runtime state.',
      ],
    },
  }
}

async function planSameCampaignUpdate(
  manifest: WizardArchiveManifest,
  destination: Extract<WizardArchiveDestination, { state: 'existing' }>,
  contentDomains: WizardArchiveContentDomainPlanners,
  allocateResourceId: () => ResourceId,
  policies: ReadonlyArray<WizardArchivePolicyDecision>,
): Promise<WizardArchiveTransferResult> {
  if (!destinationOwnershipIsValid(destination)) return rejected('ownership_mismatch')
  const policyByComponent = new Map(
    policies.map((policy) => [`${policy.resourceId}:${policy.component}`, policy.action]),
  )
  if (policyByComponent.size !== policies.length) return rejected('invalid_policy')

  const liveById = new Map(destination.resources.map((resource) => [resource.resourceId, resource]))
  const tombstoneById = new Map(
    destination.tombstones.map((tombstone) => [tombstone.resourceId, tombstone]),
  )
  if (Array.from(liveById.keys()).some((resourceId) => tombstoneById.has(resourceId))) {
    return rejected('invalid_destination_state')
  }

  const state = createSameCampaignState()
  const context: SameCampaignContext = {
    manifest,
    destination,
    policyByComponent,
    liveById,
    tombstoneById,
    state,
    allocateResourceId,
  }
  for (const imported of manifest.resources) {
    const reason = evaluateImportedResource(imported, context)
    if (reason) return rejected(reason)
  }
  for (const imported of manifest.tombstones) evaluateImportedTombstone(imported, context)

  const supportedActionsByComponent = new Map(
    state.unknownDecisions.map((decision) => [
      `${decision.resourceId}:${decision.component}`,
      new Set(decision.supportedActions),
    ]),
  )
  if (
    policies.some((policy) => {
      const supportedActions = supportedActionsByComponent.get(
        `${policy.resourceId}:${policy.component}`,
      )
      return !supportedActions || !supportedActions.has(policy.action)
    })
  ) {
    return rejected('invalid_policy')
  }
  if (
    !hasUniqueResourceMap(
      Array.from(state.recoveredIds, ([sourceId, destinationId]) => ({ sourceId, destinationId })),
    )
  ) {
    return rejected('invalid_destination_state')
  }
  finalizeRecoveredResources(context)

  const resourceMap = Array.from(state.recoveredIds, ([sourceId, destinationId]) => ({
    sourceId,
    destinationId,
  }))
  const resourceWrites = await createSameCampaignResourceWrites(context)
  const writeResourceMap = resourceWrites.map(({ sourceResourceId, destinationResourceId }) => ({
    sourceId: sourceResourceId,
    destinationId: destinationResourceId,
  }))
  const content = finalizeContentPlans(
    manifest,
    'same_campaign_update',
    destination.campaignId,
    writeResourceMap,
    contentDomains,
    state.contentWriteIds,
  )
  if (content === null) return rejected('unmapped_internal_target')
  const aliasDestinationBySourceId = new Map(
    resourceMap.map((entry) => [entry.sourceId, entry.destinationId]),
  )

  return {
    status: 'planned',
    plan: {
      mode: 'same_campaign_update',
      destinationCampaignId: destination.campaignId,
      actions: state.actions,
      unknownDecisions: groupUnknownDecisions(state.unknownDecisions),
      resourceMap,
      targetMap: content.targetMap,
      resourceWrites,
      contentPlans: content.plans,
      aliases: manifest.aliases.map((alias) => ({
        ...alias,
        resourceId: aliasDestinationBySourceId.get(alias.resourceId) ?? alias.resourceId,
      })),
      assetsFolder: { action: 'preserve_destination' },
      observations: state.observations,
      explanations: [
        'Compared metadata and owning-domain content independently using authoritative-revision-v1.',
        'Preserved the destination Assets folder and destination-owned access, history, preview, and session state.',
      ],
    },
  }
}

function createSameCampaignState(): SameCampaignState {
  return {
    actions: [],
    unknownDecisions: [],
    observations: [],
    recoveredIds: new Map(),
    metadataWriteIds: new Set(),
    contentWriteIds: new Set(),
  }
}

function evaluateImportedResource(
  imported: WizardArchiveResource,
  context: SameCampaignContext,
): Extract<WizardArchiveTransferResult, { status: 'rejected' }>['reason'] | null {
  const destinationLive = context.liveById.get(imported.id)
  const destinationTombstone = context.tombstoneById.get(imported.id)
  if (destinationLive && destinationLive.kind !== imported.kind) return 'resource_kind_mismatch'
  if (!destinationLive && !destinationTombstone) {
    planNewSameCampaignResource(imported, context.state)
    return null
  }
  if (destinationTombstone) return planTombstonedResource(imported, destinationTombstone, context)
  return planLiveResource(imported, destinationLive!, context)
}

function planNewSameCampaignResource(
  imported: WizardArchiveResource,
  state: SameCampaignState,
): void {
  state.actions.push(action(imported.id, 'metadata', 'create', 'automatic', null))
  state.metadataWriteIds.add(imported.id)
  if (!imported.contentVersion) return
  state.actions.push(action(imported.id, 'content', 'create', 'automatic', null))
  state.contentWriteIds.add(imported.id)
}

function planTombstonedResource(
  imported: WizardArchiveResource,
  destinationTombstone: WizardArchiveManifest['tombstones'][number],
  context: SameCampaignContext,
): Extract<WizardArchiveTransferResult, { status: 'rejected' }>['reason'] | null {
  const result = compareSameCampaignComponent(
    imported.id,
    'deletion',
    imported.metadataVersion,
    destinationTombstone.deletionVersion,
    context,
    'keep_deletion',
  )
  if (result === 'recover_as_new') {
    context.state.recoveredIds.set(imported.id, context.allocateResourceId())
    return null
  }
  if (result !== 'use_package') return null
  if (!context.destination.authorizedRestoreResourceIds.includes(imported.id)) {
    return 'restore_unauthorized'
  }
  context.state.metadataWriteIds.add(imported.id)
  if (imported.contentVersion) context.state.contentWriteIds.add(imported.id)
  return null
}

function planLiveResource(
  imported: WizardArchiveResource,
  destination: DestinationResourceVersion,
  context: SameCampaignContext,
): Extract<WizardArchiveTransferResult, { status: 'rejected' }>['reason'] | null {
  const metadata = compareSameCampaignComponent(
    imported.id,
    'metadata',
    imported.metadataVersion,
    destination.metadataVersion,
    context,
    'keep_destination',
  )
  const content = compareLiveContent(imported, destination, context)
  if (content === 'resource_kind_mismatch') return content
  if (metadata === 'recover_as_new' || content === 'recover_as_new') {
    context.state.recoveredIds.set(imported.id, context.allocateResourceId())
    return null
  }
  if (metadata === 'use_package') context.state.metadataWriteIds.add(imported.id)
  if (content === 'use_package') context.state.contentWriteIds.add(imported.id)
  return null
}

function compareLiveContent(
  imported: WizardArchiveResource,
  destination: DestinationResourceVersion,
  context: SameCampaignContext,
): SameCampaignPolicy | 'equal' | 'resource_kind_mismatch' | null {
  if (imported.contentVersion && destination.contentVersion) {
    return compareSameCampaignComponent(
      imported.id,
      'content',
      imported.contentVersion,
      destination.contentVersion,
      context,
      'keep_destination',
    )
  }
  return imported.contentVersion === destination.contentVersion ? null : 'resource_kind_mismatch'
}

function evaluateImportedTombstone(
  imported: WizardArchiveManifest['tombstones'][number],
  context: SameCampaignContext,
): void {
  const destinationTombstone = context.tombstoneById.get(imported.resourceId)
  if (destinationTombstone) {
    compareSameCampaignComponent(
      imported.resourceId,
      'deletion',
      imported.deletionVersion,
      destinationTombstone.deletionVersion,
      context,
      'keep_deletion',
      false,
    )
    return
  }
  const destinationLive = context.liveById.get(imported.resourceId)
  if (destinationLive) {
    compareSameCampaignComponent(
      imported.resourceId,
      'deletion',
      imported.deletionVersion,
      destinationLive.metadataVersion,
      context,
      'keep_destination',
      false,
      'delete',
    )
    return
  }
  context.state.actions.push(
    action(imported.resourceId, 'deletion', 'keep_deletion', 'automatic', null),
  )
}

function compareSameCampaignComponent(
  resourceId: ResourceId,
  component: ComparedComponent,
  imported: VersionStamp,
  destination: VersionStamp,
  context: SameCampaignContext,
  destinationAction: 'keep_destination' | 'keep_deletion',
  allowRecover = true,
  importedAction: WizardArchiveTransferAction['action'] = 'use_package',
): SameCampaignPolicy | 'equal' {
  return resolveComparison(
    resourceId,
    component,
    imported,
    destination,
    context.policyByComponent,
    context.state.actions,
    context.state.unknownDecisions,
    context.state.observations,
    destinationAction,
    allowRecover,
    importedAction,
  )
}

function finalizeRecoveredResources(context: SameCampaignContext): void {
  for (const resourceId of context.state.recoveredIds.keys()) {
    context.state.metadataWriteIds.add(resourceId)
    const resource = context.manifest.resources.find((candidate) => candidate.id === resourceId)!
    if (resource.contentVersion) context.state.contentWriteIds.add(resourceId)
    const retained = context.state.actions.filter(
      (candidate) =>
        candidate.resourceId !== resourceId ||
        (candidate.source === 'policy' && candidate.action === 'recover_as_new'),
    )
    context.state.actions.length = 0
    context.state.actions.push(...retained)
  }
}

async function createSameCampaignResourceWrites(
  context: SameCampaignContext,
): Promise<ReadonlyArray<WizardArchiveResourceWrite>> {
  const writeIdBySourceId = new Map(
    context.manifest.resources.map((resource) => [
      resource.id,
      context.state.recoveredIds.get(resource.id) ?? resource.id,
    ]),
  )
  const resourcesToWrite = context.manifest.resources.filter(
    (resource) =>
      context.state.metadataWriteIds.has(resource.id) ||
      context.state.contentWriteIds.has(resource.id),
  )
  return await Promise.all(
    resourcesToWrite.map(async (resource) => {
      const destinationResourceId = writeIdBySourceId.get(resource.id)!
      const parentId = resource.parentId
        ? (writeIdBySourceId.get(resource.parentId) ?? resource.parentId)
        : null
      const metadata = {
        parentId,
        kind: resource.kind,
        title: resource.title,
        icon: resource.icon,
        color: resource.color,
        lifecycle: resource.lifecycle,
      }
      return {
        sourceResourceId: resource.id,
        destinationResourceId,
        writeMetadata: context.state.metadataWriteIds.has(resource.id),
        writeContent: context.state.contentWriteIds.has(resource.id),
        ...metadata,
        metadataVersion:
          destinationResourceId === resource.id
            ? resource.metadataVersion
            : await initialResourceMetadataVersion(metadata),
      }
    }),
  )
}

function resolveComparison(
  resourceId: ResourceId,
  component: ComparedComponent,
  imported: VersionStamp,
  destination: VersionStamp,
  policyByComponent: ReadonlyMap<string, SameCampaignPolicy>,
  actions: Array<WizardArchiveTransferAction>,
  unknownDecisions: Array<PendingUnknownDecision>,
  observations: Array<WizardArchiveVersionObservation>,
  destinationAction: 'keep_destination' | 'keep_deletion',
  allowRecover = true,
  importedAction: WizardArchiveTransferAction['action'] = 'use_package',
): SameCampaignPolicy | 'equal' {
  const observation = observe(imported, destination)
  observations.push(observation)
  switch (observation.comparison.relation) {
    case 'equal':
      actions.push(action(resourceId, component, 'retain_equal_frontier', 'automatic', observation))
      return 'equal'
    case 'import_newer':
      actions.push(action(resourceId, component, importedAction, 'automatic', observation))
      return 'use_package'
    case 'destination_newer':
      actions.push(action(resourceId, component, destinationAction, 'automatic', observation))
      return 'keep_destination'
    case 'unknown': {
      const supportedActions: ReadonlyArray<SameCampaignPolicy> = allowRecover
        ? ['keep_destination', 'use_package', 'recover_as_new']
        : ['keep_destination', 'use_package']
      const decision = { resourceId, component, supportedActions, observation }
      unknownDecisions.push(decision)
      const policy = policyByComponent.get(`${resourceId}:${component}`)
      if (!policy) return 'keep_destination'
      if (!supportedActions.includes(policy)) return 'keep_destination'
      actions.push(
        action(
          resourceId,
          component,
          policy === 'keep_destination'
            ? destinationAction
            : policy === 'use_package'
              ? importedAction
              : policy,
          'policy',
          observation,
        ),
      )
      return policy
    }
  }
}

function finalizeContentPlans(
  manifest: WizardArchiveManifest,
  mode: WizardArchiveMode,
  destinationCampaignId: CampaignId,
  resourceMap: ReadonlyArray<ResourceCopyMapEntry>,
  planners: WizardArchiveContentDomainPlanners,
  includedContentIds: ReadonlySet<ResourceId> = new Set(resourceMap.map((entry) => entry.sourceId)),
): Readonly<{
  plans: ReadonlyArray<WizardArchiveContentPlan>
  targetMap: ReadonlyArray<CanonicalTargetMapEntry>
}> | null {
  const requests = [
    [
      'note',
      planners.notes,
      manifest.sections.notes.entries.filter((entry) => includedContentIds.has(entry.resourceId)),
    ],
    [
      'file',
      planners.files,
      manifest.sections.files.entries.filter((entry) => includedContentIds.has(entry.resourceId)),
    ],
    [
      'map',
      planners.maps,
      manifest.sections.maps.entries.filter((entry) => includedContentIds.has(entry.resourceId)),
    ],
    [
      'canvas',
      planners.canvases,
      manifest.sections.canvases.entries.filter((entry) =>
        includedContentIds.has(entry.resourceId),
      ),
    ],
  ] as const
  const freshDestinationResourceIds = resourceMap.flatMap((entry) =>
    entry.sourceId === entry.destinationId ? [] : [entry.destinationId],
  )
  const prepared = requests.map(([domain, planner, entries]) => ({
    domain,
    planner: planner as WizardArchiveContentDomainPlanner<never>,
    prepared: (planner as WizardArchiveContentDomainPlanner<(typeof entries)[number]>).prepare({
      mode,
      sourceCampaignId: manifest.sourceCampaignId,
      destinationCampaignId,
      entries,
      resourceMap,
      freshDestinationResourceIds,
      initialContentRevision: 1,
    }),
  }))
  const resourceTargets: Array<CanonicalTargetMapEntry> = resourceMap.map((entry) => ({
    source: { kind: 'resource', resourceId: entry.sourceId },
    destination: { kind: 'resource', resourceId: entry.destinationId },
  }))
  const targetMap = [
    ...resourceTargets,
    ...prepared.flatMap(({ prepared: value }) => value.referenceableTargets),
  ]
  if (!hasUniqueTargets(targetMap)) return null
  if (mode === 'new_campaign_clone' && !allCloneTargetsMapped(manifest, targetMap)) return null

  return {
    targetMap,
    plans: prepared.map(({ domain, planner, prepared: value }) => ({
      domain,
      plan: planner.finalize(value.opaque, targetMap),
    })),
  }
}

function observe(
  imported: VersionStamp,
  destination: VersionStamp,
): WizardArchiveVersionObservation {
  return { imported, destination, comparison: compareVersionStamps(imported, destination) }
}

function action(
  resourceId: ResourceId,
  component: ComparedComponent,
  value: WizardArchiveTransferAction['action'],
  source: WizardArchiveTransferAction['source'],
  observation: WizardArchiveVersionObservation | null,
): WizardArchiveTransferAction {
  return {
    resourceId,
    component,
    action: value,
    source,
    observation,
    explanation: `${component}:${value}`,
  }
}

function packageOwnershipIsValid(manifest: WizardArchiveManifest): boolean {
  return (
    manifest.tombstones.every((value) => value.campaignId === manifest.sourceCampaignId) &&
    manifest.aliases.every((value) => value.campaignId === manifest.sourceCampaignId)
  )
}

function destinationOwnershipIsValid(
  destination: Extract<WizardArchiveDestination, { state: 'existing' }>,
): boolean {
  return (
    destination.resources.every((value) => value.campaignId === destination.campaignId) &&
    destination.tombstones.every((value) => value.campaignId === destination.campaignId)
  )
}

function hasUniqueResourceMap(resourceMap: ReadonlyArray<ResourceCopyMapEntry>): boolean {
  const sourceIds = new Set(resourceMap.map((entry) => entry.sourceId))
  return (
    sourceIds.size === resourceMap.length &&
    new Set(resourceMap.map((entry) => entry.destinationId)).size === resourceMap.length &&
    resourceMap.every((entry) => !sourceIds.has(entry.destinationId))
  )
}

function hasUniqueTargets(targetMap: ReadonlyArray<CanonicalTargetMapEntry>): boolean {
  const sourceKeys = targetMap.map((entry) => JSON.stringify(entry.source))
  return new Set(sourceKeys).size === sourceKeys.length
}

type PendingUnknownDecision = Readonly<{
  resourceId: ResourceId
  component: ComparedComponent
  supportedActions: ReadonlyArray<SameCampaignPolicy>
  observation: WizardArchiveVersionObservation
}>

function groupUnknownDecisions(
  decisions: ReadonlyArray<PendingUnknownDecision>,
): ReadonlyArray<WizardArchiveUnknownDecisionGroup> {
  const byResource = new Map<ResourceId, Array<WizardArchiveUnknownComponentDecision>>()
  for (const { resourceId, ...component } of decisions) {
    const components = byResource.get(resourceId) ?? []
    components.push(component)
    byResource.set(resourceId, components)
  }
  return Array.from(byResource, ([resourceId, components]) => ({ resourceId, components }))
}

function allCloneTargetsMapped(
  manifest: WizardArchiveManifest,
  targetMap: ReadonlyArray<CanonicalTargetMapEntry>,
): boolean {
  const mapped = new Set(targetMap.map((entry) => JSON.stringify(entry.source)))
  const expected = [
    ...manifest.resources.map((resource) => ({ kind: 'resource', resourceId: resource.id })),
    ...manifest.sections.notes.entries.flatMap((entry) =>
      entry.blockIds.flatMap((blockId) => [
        { kind: 'noteBlock', resourceId: entry.resourceId, blockId, presentation: 'block' },
        { kind: 'noteBlock', resourceId: entry.resourceId, blockId, presentation: 'heading' },
      ]),
    ),
    ...manifest.sections.maps.entries.flatMap((entry) =>
      entry.pinIds.map((pinId) => ({ kind: 'mapPin', resourceId: entry.resourceId, pinId })),
    ),
    ...manifest.sections.canvases.entries.flatMap((entry) =>
      entry.nodeIds.map((nodeId) => ({ kind: 'canvasNode', resourceId: entry.resourceId, nodeId })),
    ),
  ]
  return expected.every((target) => mapped.has(JSON.stringify(target)))
}

function rejected(
  reason: Extract<WizardArchiveTransferResult, { status: 'rejected' }>['reason'],
): WizardArchiveTransferResult {
  return { status: 'rejected', reason }
}
