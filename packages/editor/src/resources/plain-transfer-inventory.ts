import type { VersionStamp } from './component-version'
import { sha256Digest } from './component-version'
import { DOMAIN_ID_KIND, assertDomainId, isUuidV7 } from './domain-id'
import type { DomainIdByKind, DomainIdKind, OperationId, ResourceId } from './domain-id'
import type { FileOwnedMetadata } from './file-content-contract'
import { initialResourceMetadataVersion } from './resource-metadata-version'
import type { ResourceKind, ResourceTitle } from './resource-record'
import { MAX_SYNCHRONOUS_RESOURCE_CLOSURE, canonicalizeResourceTitle } from './resource-record'
import { classifyFileResourceSource, classifyResourceSource } from './resource-source-classifier'
import type { ResourceSourceClassification } from './resource-source-classifier'
import { createSourcePathAlias, normalizeSourcePath } from './source-path-alias'
import type { SourcePathAlias } from './resource-catalog-contract'
import { PLAIN_TRANSFER_MANIFEST_VERSION } from './transfer-job-contract'
import type {
  PlainTransferInputEntry,
  PlainTransferIntent,
  PlainTransferManifest,
  PlainTransferManifestEntry,
  PlainTransferSourceDescriptor,
} from './transfer-job-contract'

export const PLAIN_TRANSFER_INVENTORY_VERSION = 'plain-transfer-inventory-v3' as const
export const PLAIN_TRANSFER_LIMITS = {
  maxEntries: MAX_SYNCHRONOUS_RESOURCE_CLOSURE,
  maxPathDepth: 64,
  maxPathUtf8Bytes: 1_024,
  maxSourceStringUtf8Bytes: 1_024,
  maxSources: 32,
  maxTotalBytes: 500 * 1024 * 1024,
} as const

export type PlainTransferSourceEntry = PlainTransferInputEntry

export function createPlainTransferManifest({
  entries,
  intent,
  sources,
}: Readonly<{
  entries: ReadonlyArray<PlainTransferInputEntry>
  intent: PlainTransferIntent
  sources: ReadonlyArray<PlainTransferSourceDescriptor>
}>): PlainTransferManifest {
  return {
    version: PLAIN_TRANSFER_MANIFEST_VERSION,
    jobId: intent.jobId,
    destinationCampaignId: intent.campaignId,
    destinationParentId: intent.destinationParentId,
    textFileHandling: intent.textFileHandling,
    sources,
    entries: entries.map(
      (entry): PlainTransferManifestEntry =>
        entry.type === 'directory'
          ? entry
          : {
              sourceId: entry.sourceId,
              path: entry.path,
              type: 'file',
              byteSize: entry.bytes.byteLength,
            },
    ),
  }
}

export async function planPlainTransfer({
  campaignId,
  entries,
  intent,
  sources,
}: Readonly<{
  campaignId: PlainTransferIntent['campaignId']
  entries: ReadonlyArray<PlainTransferInputEntry>
  intent: PlainTransferIntent
  sources: ReadonlyArray<PlainTransferSourceDescriptor>
}>): Promise<
  PlainTransferInventoryResult | Readonly<{ status: 'rejected'; reason: 'invalid_campaign' }>
> {
  if (intent.campaignId !== campaignId) {
    return { status: 'rejected', reason: 'invalid_campaign' }
  }
  const manifest = createPlainTransferManifest({ entries, intent, sources })
  return await buildPlainTransferInventory({ manifest, entries })
}

export type PlainTransferInventoryContent =
  | Readonly<{
      kind: 'note'
      source: Readonly<{
        bytes: Uint8Array
        removedUtf8Bom: boolean
        text: string
      }>
    }>
  | Readonly<{
      kind: 'file'
      source: Readonly<{ bytes: Uint8Array; metadata: FileOwnedMetadata }>
    }>

type PlainTransferInventoryResourceBase = Readonly<{
  id: ResourceId
  operationId: OperationId
  parentId: ResourceId | null
  title: ResourceTitle
  sourceEntryPath: string
  sourcePath: string
  entryType: 'directory' | 'file'
  declaredByteSize: number
  metadataVersion: VersionStamp
  alias: SourcePathAlias
}>

export type PlainTransferPlannedResource = Readonly<{
  id: ResourceId
  operationId: OperationId
  parentId: ResourceId | null
  title: ResourceTitle
  sourceEntryPath: string
  sourcePath: string
  alias: SourcePathAlias
  entryType: 'directory' | 'file'
  declaredByteSize: number
}>

export type PlainTransferPlan = Readonly<{
  manifest: PlainTransferManifest
  resources: ReadonlyArray<PlainTransferPlannedResource>
}>

export type PlainTransferInventoryResource = PlainTransferInventoryResourceBase &
  (
    | Readonly<{ kind: 'folder'; content: null }>
    | Readonly<{
        kind: 'note'
        content: Extract<PlainTransferInventoryContent, { kind: 'note' }>
      }>
    | Readonly<{
        kind: 'file'
        content: Extract<PlainTransferInventoryContent, { kind: 'file' }>
      }>
  )

export type PlainTransferInventory = Readonly<{
  version: typeof PLAIN_TRANSFER_INVENTORY_VERSION
  manifest: PlainTransferManifest
  resources: ReadonlyArray<PlainTransferInventoryResource>
}>

export type PlainTransferInventoryResult =
  | Readonly<{ status: 'ready'; inventory: PlainTransferInventory }>
  | Readonly<{
      status: 'rejected'
      reason:
        | 'duplicate_source_path'
        | 'entry_limit_exceeded'
        | 'invalid_request'
        | 'invalid_source'
        | 'path_limit_exceeded'
        | 'source_changed'
        | 'source_limit_exceeded'
    }>
  | Readonly<{
      status: 'rejected'
      reason: 'entry_too_large'
      sourceId: string
      sourcePath: string
    }>

export type PlainTransferPlanResult =
  | Readonly<{ status: 'ready'; plan: PlainTransferPlan }>
  | Extract<PlainTransferInventoryResult, { status: 'rejected' }>

type CanonicalManifestEntry = Readonly<{
  source: PlainTransferSourceDescriptor
  path: string
  type: PlainTransferManifestEntry['type']
  byteSize: number
}>

type PlacedManifestEntry = CanonicalManifestEntry & Readonly<{ placedPath: string }>

type AcceptedResourceSourceClassification = Exclude<
  ResourceSourceClassification,
  { classification: 'rejected' }
>

type RejectedInventory = Extract<PlainTransferInventoryResult, { status: 'rejected' }>

export async function digestPlainTransferPlan(
  plan: Pick<PlainTransferPlan, 'manifest' | 'resources'>,
): Promise<string> {
  const { manifest } = plan
  const encoder = new TextEncoder()
  const canonical = {
    version: manifest.version,
    jobId: manifest.jobId,
    destinationCampaignId: manifest.destinationCampaignId,
    destinationParentId: manifest.destinationParentId,
    textFileHandling: manifest.textFileHandling,
    sources: [...manifest.sources]
      .sort((left, right) => compareText(left.id, right.id))
      .map((source) => ({
        id: source.id,
        kind: source.kind,
        name: source.name.normalize('NFC'),
      })),
    entries: plan.resources.map((resource) => ({
      sourceRootId: resource.alias.sourceRootId,
      sourceEntryPath: resource.sourceEntryPath,
      sourcePath: resource.sourcePath,
      entryType: resource.entryType,
      declaredByteSize: resource.declaredByteSize,
      resourceId: resource.id,
      operationId: resource.operationId,
      parentId: resource.parentId,
      title: resource.title,
    })),
  }
  return await sha256Digest(encoder.encode(JSON.stringify(canonical)))
}

export async function buildPlainTransferInventory({
  manifest,
  entries,
}: Readonly<{
  manifest: PlainTransferManifest
  entries: ReadonlyArray<PlainTransferSourceEntry>
}>): Promise<PlainTransferInventoryResult> {
  const planned = await planPlainTransferManifest(manifest)
  if (planned.status === 'rejected') return planned
  return await materializePlainTransferInventory(planned.plan, entries)
}

export async function planPlainTransferManifest(
  manifest: PlainTransferManifest,
): Promise<PlainTransferPlanResult> {
  if (!validManifest(manifest)) return { status: 'rejected', reason: 'invalid_request' }
  const canonical = canonicalManifestEntries(manifest.sources, manifest.entries)
  if (canonical.status === 'rejected') return canonical
  if (hasFileAncestor(canonical.entries, (entry) => entry.path)) {
    return { status: 'rejected', reason: 'invalid_source' }
  }
  const ordinary = ordinaryCanonicalEntries(canonical.entries)
  if ('status' in ordinary) return ordinary
  const placed = preparePlacedEntries(manifest, ordinary.entries)
  if ('status' in placed) return placed
  return {
    status: 'ready',
    plan: {
      manifest,
      resources: await materializePlannedResources(manifest, placed),
    },
  }
}

export async function materializePlainTransferInventory(
  plan: PlainTransferPlan,
  entries: ReadonlyArray<PlainTransferSourceEntry>,
): Promise<PlainTransferInventoryResult> {
  const canonical = canonicalSourceEntries(plan.manifest.sources, entries)
  if (canonical.status === 'rejected') return canonical
  if (!manifestMatchesEntries(plan.manifest.entries, canonical.entries)) {
    return { status: 'rejected', reason: 'source_changed' }
  }
  const sourceByEntry = new Map(
    canonical.entries.map((entry) => [
      sourcePathKey(entry, entry.path),
      entry.type === 'file' ? entry.bytes : null,
    ]),
  )
  const resources: Array<PlainTransferInventoryResource> = []
  for (const resource of plan.resources) {
    if (resource.entryType === 'directory') {
      resources.push({
        ...resource,
        kind: 'folder',
        metadataVersion: await transferMetadataVersion(resource.parentId, 'folder', resource.title),
        content: null,
      })
      continue
    }
    const bytes = sourceByEntry.get(
      `${resource.alias.sourceRootId}\0${normalizeSourcePath(resource.sourceEntryPath)}`,
    )
    if (!bytes) return { status: 'rejected', reason: 'source_changed' }
    const classification = classifyEntry(
      resource.sourceEntryPath,
      bytes,
      plan.manifest.textFileHandling,
    )
    if (classification.classification === 'rejected') {
      return {
        status: 'rejected',
        reason: classification.reason,
        sourceId: resource.alias.sourceRootId,
        sourcePath: resource.sourcePath,
      }
    }
    if (classification.classification === 'note') {
      resources.push({
        ...resource,
        kind: 'note',
        metadataVersion: await transferMetadataVersion(resource.parentId, 'note', resource.title),
        content: {
          kind: 'note',
          source: {
            bytes,
            removedUtf8Bom: classification.removedUtf8Bom,
            text: classification.text,
          },
        },
      })
    } else {
      resources.push({
        ...resource,
        kind: 'file',
        metadataVersion: await transferMetadataVersion(resource.parentId, 'file', resource.title),
        content: { kind: 'file', source: { bytes, metadata: classification } },
      })
    }
  }
  return {
    status: 'ready',
    inventory: {
      version: PLAIN_TRANSFER_INVENTORY_VERSION,
      manifest: plan.manifest,
      resources,
    },
  }
}

function preparePlacedEntries(
  manifest: PlainTransferManifest,
  entries: ReadonlyArray<CanonicalManifestEntry>,
): ReadonlyArray<PlacedManifestEntry> | RejectedInventory {
  let placed: ReadonlyArray<PlacedManifestEntry>
  try {
    placed = placeEntries(manifest, entries)
  } catch {
    return { status: 'rejected', reason: 'invalid_source' }
  }
  if (placed.length > PLAIN_TRANSFER_LIMITS.maxEntries) {
    return { status: 'rejected', reason: 'entry_limit_exceeded' }
  }
  const resourcePaths = addImplicitDirectories(placed)
  if (resourcePaths.length > PLAIN_TRANSFER_LIMITS.maxEntries) {
    return { status: 'rejected', reason: 'entry_limit_exceeded' }
  }
  if (hasFileAncestor(resourcePaths, (entry) => entry.placedPath)) {
    return { status: 'rejected', reason: 'invalid_source' }
  }
  return resourcePaths
}

async function materializePlannedResources(
  manifest: PlainTransferManifest,
  entries: ReadonlyArray<PlacedManifestEntry>,
): Promise<ReadonlyArray<PlainTransferPlannedResource>> {
  const ids = await derivePlannedResourceIds(manifest, entries)
  return await Promise.all(entries.map((entry) => materializePlannedResource(manifest, entry, ids)))
}

async function derivePlannedResourceIds(
  manifest: PlainTransferManifest,
  entries: ReadonlyArray<PlacedManifestEntry>,
): Promise<ReadonlyMap<string, ResourceId>> {
  const ids = new Map<string, ResourceId>()
  const allocated = new Set<ResourceId>()
  for (const entry of entries) {
    const id = await derivePlannedResourceId(manifest, entry)
    if (allocated.has(id)) throw new TypeError('Plain transfer identity collision')
    allocated.add(id)
    ids.set(resourceKey(entry), id)
  }
  return ids
}

async function materializePlannedResource(
  manifest: PlainTransferManifest,
  entry: PlacedManifestEntry,
  ids: ReadonlyMap<string, ResourceId>,
): Promise<PlainTransferPlannedResource> {
  const id = ids.get(resourceKey(entry))!
  const parentPath = pathParent(entry.placedPath)
  const parentId = parentPath
    ? (ids.get(resourceKey(entry, parentPath)) ?? manifest.destinationParentId)
    : manifest.destinationParentId
  const title = canonicalizeResourceTitle(pathBasename(entry.placedPath))
  return {
    id,
    operationId: await derivePlannedOperationId(manifest, entry),
    parentId,
    title,
    sourceEntryPath: entry.path,
    sourcePath: entry.placedPath,
    alias: createSourcePathAlias({
      campaignId: manifest.destinationCampaignId,
      importJobId: manifest.jobId,
      rawPath: entry.placedPath,
      resourceId: id,
      sourceRootId: entry.source.id,
    }),
    entryType: entry.type,
    declaredByteSize: entry.byteSize,
  }
}

async function transferMetadataVersion(
  parentId: ResourceId | null,
  kind: Extract<ResourceKind, 'file' | 'folder' | 'note'>,
  title: ResourceTitle,
): Promise<VersionStamp> {
  return await initialResourceMetadataVersion({
    parentId,
    kind,
    title,
    icon: null,
    color: null,
    lifecycle: 'active',
  })
}

function validManifest(manifest: PlainTransferManifest): boolean {
  const encoder = new TextEncoder()
  return (
    manifest.version === PLAIN_TRANSFER_MANIFEST_VERSION &&
    isUuidV7(manifest.jobId) &&
    isUuidV7(manifest.destinationCampaignId) &&
    (manifest.destinationParentId === null || isUuidV7(manifest.destinationParentId)) &&
    (manifest.textFileHandling === 'notes' || manifest.textFileHandling === 'files') &&
    manifest.sources.length > 0 &&
    manifest.sources.length <= PLAIN_TRANSFER_LIMITS.maxSources &&
    manifest.entries.length > 0 &&
    manifest.entries.length <= PLAIN_TRANSFER_LIMITS.maxEntries &&
    new Set(manifest.sources.map((source) => source.id)).size === manifest.sources.length &&
    manifest.sources.every((source) => validPlainSourceDescriptor(source, encoder)) &&
    manifest.entries.every(
      (entry) =>
        entry.type === 'directory' || (Number.isSafeInteger(entry.byteSize) && entry.byteSize >= 0),
    ) &&
    manifest.entries.reduce(
      (total, entry) => total + (entry.type === 'file' ? entry.byteSize : 0),
      0,
    ) <= PLAIN_TRANSFER_LIMITS.maxTotalBytes
  )
}

function validPlainSourceDescriptor(
  source: PlainTransferSourceDescriptor,
  encoder: TextEncoder,
): boolean {
  if (
    source.id.length === 0 ||
    source.name.length === 0 ||
    encoder.encode(source.id).byteLength > PLAIN_TRANSFER_LIMITS.maxSourceStringUtf8Bytes ||
    encoder.encode(source.name).byteLength > PLAIN_TRANSFER_LIMITS.maxSourceStringUtf8Bytes
  ) {
    return false
  }
  try {
    return !normalizeSourcePath(source.name).includes('/')
  } catch {
    return false
  }
}

function canonicalManifestEntries(
  sources: ReadonlyArray<PlainTransferSourceDescriptor>,
  entries: ReadonlyArray<PlainTransferManifestEntry>,
):
  | Readonly<{ status: 'ready'; entries: ReadonlyArray<CanonicalManifestEntry> }>
  | Extract<PlainTransferInventoryResult, { status: 'rejected' }> {
  return canonicalizeSourceEntries(sources, entries, (source, path, entry) => ({
    source,
    path,
    type: entry.type,
    byteSize: entry.type === 'file' ? entry.byteSize : 0,
  }))
}

function canonicalSourceEntries(
  sources: ReadonlyArray<PlainTransferSourceDescriptor>,
  entries: ReadonlyArray<PlainTransferSourceEntry>,
):
  | Readonly<{
      status: 'ready'
      entries: ReadonlyArray<CanonicalManifestEntry & Readonly<{ bytes: Uint8Array | null }>>
    }>
  | Extract<PlainTransferInventoryResult, { status: 'rejected' }> {
  return canonicalizeSourceEntries(sources, entries, (source, path, entry) => ({
    source,
    path,
    type: entry.type,
    byteSize: entry.type === 'file' ? entry.bytes.byteLength : 0,
    bytes: entry.type === 'file' ? entry.bytes : null,
  }))
}

function canonicalizeSourceEntries<
  TEntry extends Readonly<{ sourceId: string; path: string; type: 'directory' | 'file' }>,
  TCanonical extends CanonicalManifestEntry,
>(
  sources: ReadonlyArray<PlainTransferSourceDescriptor>,
  entries: ReadonlyArray<TEntry>,
  canonicalize: (source: PlainTransferSourceDescriptor, path: string, entry: TEntry) => TCanonical,
):
  | Readonly<{ status: 'ready'; entries: ReadonlyArray<TCanonical> }>
  | Extract<PlainTransferInventoryResult, { status: 'rejected' }> {
  const sourceById = new Map(sources.map((source) => [source.id, source]))
  const canonical: Array<TCanonical> = []
  const identities = new Set<string>()
  try {
    for (const entry of entries) {
      const source = sourceById.get(entry.sourceId)
      if (!source) return { status: 'rejected', reason: 'invalid_source' }
      const path = normalizeSourcePath(entry.path)
      if (
        new TextEncoder().encode(path).byteLength > PLAIN_TRANSFER_LIMITS.maxPathUtf8Bytes ||
        path.split('/').length > PLAIN_TRANSFER_LIMITS.maxPathDepth
      ) {
        return { status: 'rejected', reason: 'path_limit_exceeded' }
      }
      const identity = `${source.id}\0${path}`
      if (identities.has(identity)) {
        return { status: 'rejected', reason: 'duplicate_source_path' }
      }
      identities.add(identity)
      canonical.push(canonicalize(source, path, entry))
    }
  } catch {
    return { status: 'rejected', reason: 'invalid_source' }
  }
  canonical.sort(
    (left, right) =>
      compareText(left.source.id, right.source.id) || compareText(left.path, right.path),
  )
  return { status: 'ready', entries: canonical }
}

function manifestMatchesEntries(
  manifestEntries: ReadonlyArray<PlainTransferManifestEntry>,
  entries: ReadonlyArray<CanonicalManifestEntry & Readonly<{ bytes: Uint8Array | null }>>,
): boolean {
  if (manifestEntries.length !== entries.length) return false
  const manifestBySourcePath = new Map(
    manifestEntries.map((entry) => [
      `${entry.sourceId}\0${normalizeSourcePath(entry.path)}`,
      entry,
    ]),
  )
  return entries.every((entry) => {
    const manifest = manifestBySourcePath.get(`${entry.source.id}\0${entry.path}`)
    return (
      manifest?.type === entry.type &&
      (manifest.type === 'directory' || manifest.byteSize === entry.byteSize)
    )
  })
}

function placeEntries(
  manifest: PlainTransferManifest,
  entries: ReadonlyArray<CanonicalManifestEntry>,
): ReadonlyArray<PlacedManifestEntry> {
  const sourceContainers = manifest.sources.flatMap(
    (source): ReadonlyArray<PlacedManifestEntry> => {
      if (source.kind === 'file') return []
      const path = plainTransferSourceContainer(source)
      return [{ source, path, placedPath: path, type: 'directory', byteSize: 0 }]
    },
  )
  return [
    ...sourceContainers,
    ...entries.map((entry) =>
      entry.source.kind === 'file'
        ? { ...entry, placedPath: entry.path }
        : {
            ...entry,
            placedPath: `${plainTransferSourceContainer(entry.source)}/${entry.path}`,
          },
    ),
  ]
}

function plainTransferSourceContainer(source: PlainTransferSourceDescriptor): string {
  const name =
    source.kind === 'zip' ? source.name.replace(/\.zip$/i, '') || source.name : source.name
  return normalizeSourcePath(name)
}

function ordinaryCanonicalEntries(
  entries: ReadonlyArray<CanonicalManifestEntry>,
): Readonly<{ entries: ReadonlyArray<CanonicalManifestEntry> }> | RejectedInventory {
  const logical = canonicalLogicalEntries(entries)
  if (logical.some(({ control }) => control !== 'ordinary')) {
    return { status: 'rejected', reason: 'invalid_source' }
  }
  return { entries: logical.map(({ entry }) => entry) }
}

function canonicalLogicalEntries(entries: ReadonlyArray<CanonicalManifestEntry>) {
  const wrappers = new Map<string, string | null>()
  return entries.map((entry) => {
    if (!wrappers.has(entry.source.id)) {
      wrappers.set(
        entry.source.id,
        entry.source.kind === 'zip' ? soleTopLevelDirectory(entries, entry.source) : null,
      )
    }
    const logicalPath = sourceLogicalPath(entry.path, wrappers.get(entry.source.id) ?? null)
    return { entry, control: controlPathKind(logicalPath) }
  })
}

function controlPathKind(path: string): 'control' | 'invalid' | 'manifest' | 'ordinary' {
  const segments = path.split('/')
  const controlSegment = segments.indexOf('.wizardarchive')
  if (controlSegment === -1) return 'ordinary'
  if (controlSegment !== 0 || segments.lastIndexOf('.wizardarchive') !== 0) return 'invalid'
  return path === '.wizardarchive/manifest.json' ? 'manifest' : 'control'
}

function sourceLogicalPath(path: string, wrapper: string | null): string {
  if (!wrapper) return path
  if (path === wrapper) return ''
  return path.startsWith(`${wrapper}/`) ? path.slice(wrapper.length + 1) : path
}

function soleTopLevelDirectory(
  entries: ReadonlyArray<CanonicalManifestEntry>,
  source: PlainTransferSourceDescriptor,
): string | null {
  const candidates = entries.filter((entry) => entry.source.id === source.id)
  const segments = new Set(candidates.map((entry) => entry.path.split('/')[0]!))
  if (segments.size !== 1) return null
  const segment = [...segments][0]!
  if (segment === '.wizardarchive') return null
  return candidates.some((entry) => entry.path === segment && entry.type === 'file')
    ? null
    : segment
}

function addImplicitDirectories(
  entries: ReadonlyArray<PlacedManifestEntry>,
): ReadonlyArray<PlacedManifestEntry> {
  const byPath = new Map(entries.map((entry) => [resourceKey(entry), entry]))
  for (const entry of entries) {
    for (const parent of ancestorPaths(entry.placedPath)) {
      const key = resourceKey(entry, parent)
      if (!byPath.has(key)) {
        byPath.set(key, {
          source: entry.source,
          path: parent,
          placedPath: parent,
          type: 'directory',
          byteSize: 0,
        })
      }
    }
  }
  return [...byPath.values()].sort(
    (left, right) =>
      compareText(left.source.id, right.source.id) ||
      left.placedPath.split('/').length - right.placedPath.split('/').length ||
      compareText(left.placedPath, right.placedPath),
  )
}

function hasFileAncestor<TEntry extends CanonicalManifestEntry>(
  entries: ReadonlyArray<TEntry>,
  pathOf: (entry: TEntry) => string,
): boolean {
  const byPath = new Map(
    entries.map((entry) => [sourcePathKey(entry, pathOf(entry)), entry] as const),
  )
  for (const entry of entries) {
    for (const parent of ancestorPaths(pathOf(entry))) {
      const ancestor = byPath.get(sourcePathKey(entry, parent))
      if (ancestor?.type === 'file') return true
    }
  }
  return false
}

function ancestorPaths(path: string): ReadonlyArray<string> {
  const ancestors: Array<string> = []
  let parent = pathParent(path)
  while (parent) {
    ancestors.push(parent)
    parent = pathParent(parent)
  }
  return ancestors
}

async function derivePlannedResourceId(
  manifest: PlainTransferManifest,
  entry: PlacedManifestEntry,
): Promise<ResourceId> {
  return await derivePlannedUuid(manifest, entry, DOMAIN_ID_KIND.resource, 'resource')
}

async function derivePlannedOperationId(
  manifest: PlainTransferManifest,
  entry: PlacedManifestEntry,
): Promise<OperationId> {
  return await derivePlannedUuid(manifest, entry, DOMAIN_ID_KIND.operation, 'operation')
}

async function derivePlannedUuid<TKind extends DomainIdKind>(
  manifest: PlainTransferManifest,
  entry: PlacedManifestEntry,
  kind: TKind,
  purpose: string,
): Promise<DomainIdByKind[TKind]> {
  const digest = await sha256Digest(
    new TextEncoder().encode(
      [
        PLAIN_TRANSFER_INVENTORY_VERSION,
        purpose,
        manifest.jobId,
        manifest.destinationCampaignId,
        manifest.destinationParentId ?? '',
        resourceKey(entry),
      ].join('\0'),
    ),
  )
  const timestamp = manifest.jobId.replaceAll('-', '').slice(0, 12)
  return assertDomainId(
    kind,
    `${timestamp.slice(0, 8)}-${timestamp.slice(8)}-7${digest.slice(0, 3)}-8${digest.slice(3, 6)}-${digest.slice(6, 18)}`,
  )
}

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0
}

function resourceKey(
  entry: Pick<PlacedManifestEntry, 'source' | 'placedPath'>,
  path = entry.placedPath,
) {
  return sourcePathKey(entry, path)
}

function sourcePathKey(entry: Pick<CanonicalManifestEntry, 'source'>, path: string) {
  return `${entry.source.id}\0${path}`
}

function classifyEntry(
  sourcePath: string,
  bytes: Uint8Array,
  textFileHandling: PlainTransferManifest['textFileHandling'],
):
  | AcceptedResourceSourceClassification
  | Extract<ResourceSourceClassification, { classification: 'rejected' }> {
  const source = {
    bytes,
    fileName: pathBasename(sourcePath),
  }
  return textFileHandling === 'files'
    ? classifyFileResourceSource(source)
    : classifyResourceSource(source)
}

function pathParent(path: string): string | null {
  const separator = path.lastIndexOf('/')
  return separator === -1 ? null : path.slice(0, separator)
}

function pathBasename(path: string): string {
  return path.slice(path.lastIndexOf('/') + 1)
}
