import type { Sha256Digest, VersionStamp } from './component-version'
import { sha256Digest } from './component-version'
import { DOMAIN_ID_KIND, assertDomainId, isUuidV7 } from './domain-id'
import type {
  CampaignMemberId,
  DomainIdByKind,
  DomainIdKind,
  OperationId,
  ResourceId,
} from './domain-id'
import type { FileOwnedMetadata } from './file-content-contract'
import { initialResourceMetadataVersion } from './resource-metadata-version'
import type { ResourceKind, ResourceTitle } from './resource-record'
import { MAX_SYNCHRONOUS_RESOURCE_CLOSURE, canonicalizeResourceTitle } from './resource-record'
import { classifyFileResourceSource, classifyResourceSource } from './resource-source-classifier'
import type { ResourceSourceClassification } from './resource-source-classifier'
import { createSourcePathAlias, normalizeSourcePath } from './source-path-alias'
import type { SourcePathAlias } from './resource-catalog-contract'
import { TRANSFER_JOB_REQUEST_VERSION } from './transfer-job-contract'
import type {
  PlainTransferInputEntry,
  PlainTransferEntryIdentity,
  PlainTransferIntent,
  PlainTransferJobRequest,
  PlainTransferSourceDescriptor,
  TransferSourceDescriptor,
} from './transfer-job-contract'

export const PLAIN_TRANSFER_INVENTORY_VERSION = 'plain-transfer-inventory-v3' as const
export const PLAIN_TRANSFER_LIMITS = {
  maxEntries: MAX_SYNCHRONOUS_RESOURCE_CLOSURE,
  maxPathDepth: 64,
  maxPathUtf8Bytes: 1_024,
  maxTotalBytes: 500 * 1024 * 1024,
} as const

export type PlainTransferSourceEntry = PlainTransferInputEntry

export function plainTransferEntryIdentities(
  resources: ReadonlyArray<PlainTransferInventoryResource>,
): ReadonlyArray<PlainTransferEntryIdentity> {
  return resources.map((resource) => ({
    sourceRootId: resource.alias.sourceRootId,
    rawPath: resource.alias.rawPath,
    normalizedPath: resource.alias.normalizedPath,
    plannedResourceId: resource.id,
    plannedOperationId: resource.operationId,
    resourceKind: resource.kind,
  }))
}

async function createPlainTransferRequest({
  actorId,
  entries,
  intent,
  sources,
}: Readonly<{
  actorId: CampaignMemberId
  entries: ReadonlyArray<PlainTransferInputEntry>
  intent: PlainTransferIntent
  sources: ReadonlyArray<PlainTransferSourceDescriptor>
}>): Promise<PlainTransferJobRequest> {
  return {
    version: TRANSFER_JOB_REQUEST_VERSION,
    jobId: intent.jobId,
    operationId: intent.operationId,
    actorId,
    destinationCampaignId: intent.campaignId,
    destinationParentId: intent.destinationParentId,
    textFileHandling: intent.textFileHandling,
    manifestHandling: 'reject',
    mode: 'plain_resources',
    sourceDigest: await digestPlainTransferSources(sources, entries),
    sources,
  }
}

export async function planPlainTransfer({
  actorId,
  campaignId,
  entries,
  intent,
  sources,
}: Readonly<{
  actorId: CampaignMemberId
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
  const request = await createPlainTransferRequest({ actorId, entries, intent, sources })
  return await buildPlainTransferInventory({ request, entries })
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
  sourceDigest: Sha256Digest | null
  metadataVersion: VersionStamp
  alias: SourcePathAlias
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
  request: PlainTransferJobRequest
  sourceDigest: Sha256Digest
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
        | 'manifest_requires_explicit_choice'
        | 'path_limit_exceeded'
        | 'source_changed'
        | 'source_limit_exceeded'
        | 'workspace_source_required'
    }>
  | Readonly<{
      status: 'rejected'
      reason: 'entry_too_large'
      sourceId: string
      sourcePath: string
    }>

type CanonicalEntry = Readonly<{
  source: TransferSourceDescriptor
  path: string
  type: PlainTransferSourceEntry['type']
  bytes: Uint8Array | null
}>

type PlacedEntry = CanonicalEntry & Readonly<{ placedPath: string }>

type AcceptedResourceSourceClassification = Exclude<
  ResourceSourceClassification,
  { classification: 'rejected' }
>

type PreparedEntry = PlacedEntry &
  Readonly<{ classification: AcceptedResourceSourceClassification | null }>

type RejectedInventory = Extract<PlainTransferInventoryResult, { status: 'rejected' }>

type PreparedInventory = Readonly<{
  entries: ReadonlyArray<PreparedEntry>
  sourceDigest: Sha256Digest
}>

export async function digestPlainTransferSources(
  sources: ReadonlyArray<TransferSourceDescriptor>,
  entries: ReadonlyArray<PlainTransferSourceEntry>,
): Promise<Sha256Digest> {
  const canonical = canonicalEntries(sources, entries)
  if (canonical.status === 'rejected') throw new TypeError(canonical.reason)
  return await digestCanonicalEntries(sources, canonical.entries)
}

async function digestCanonicalEntries(
  sources: ReadonlyArray<TransferSourceDescriptor>,
  entries: ReadonlyArray<CanonicalEntry>,
): Promise<Sha256Digest> {
  const parts: Array<Uint8Array> = []
  const encoder = new TextEncoder()
  for (const source of [...sources].sort((left, right) => compareText(left.id, right.id))) {
    parts.push(
      encoder.encode(`source\0${source.id}\0${source.kind}\0${source.name.normalize('NFC')}`),
    )
  }
  for (const entry of entries) {
    const bytesDigest = entry.bytes ? await sha256Digest(entry.bytes) : ''
    parts.push(
      encoder.encode(
        `entry\0${entry.source.id}\0${entry.path}\0${entry.type}\0${entry.bytes?.byteLength ?? 0}\0${bytesDigest}`,
      ),
    )
  }
  const length = parts.reduce((total, part) => total + 8 + part.byteLength, 0)
  const encoded = new Uint8Array(length)
  const view = new DataView(encoded.buffer)
  let offset = 0
  for (const part of parts) {
    view.setBigUint64(offset, BigInt(part.byteLength))
    offset += 8
    encoded.set(part, offset)
    offset += part.byteLength
  }
  return await sha256Digest(encoded)
}

export async function buildPlainTransferInventory({
  request,
  entries,
}: Readonly<{
  request: PlainTransferJobRequest
  entries: ReadonlyArray<PlainTransferSourceEntry>
}>): Promise<PlainTransferInventoryResult> {
  const prepared = await preparePlainTransferInventory(request, entries)
  if ('status' in prepared) return prepared
  const resources = await materializePlainTransferResources(request, prepared.entries)
  return {
    status: 'ready',
    inventory: {
      version: PLAIN_TRANSFER_INVENTORY_VERSION,
      request,
      sourceDigest: prepared.sourceDigest,
      resources,
    },
  }
}

async function preparePlainTransferInventory(
  request: PlainTransferJobRequest,
  entries: ReadonlyArray<PlainTransferSourceEntry>,
): Promise<PreparedInventory | RejectedInventory> {
  if (!validRequest(request)) return { status: 'rejected', reason: 'invalid_request' }
  if (request.mode === 'plain_workspace' && request.sources.length !== 1) {
    return { status: 'rejected', reason: 'workspace_source_required' }
  }
  const canonical = canonicalEntries(request.sources, entries)
  if (canonical.status === 'rejected') return canonical
  if (hasFileAncestor(canonical.entries, (entry) => entry.path)) {
    return { status: 'rejected', reason: 'invalid_source' }
  }
  if (canonical.entries.length > PLAIN_TRANSFER_LIMITS.maxEntries) {
    return { status: 'rejected', reason: 'entry_limit_exceeded' }
  }
  const totalBytes = canonical.entries.reduce(
    (total, entry) => total + (entry.bytes?.byteLength ?? 0),
    0,
  )
  if (totalBytes > PLAIN_TRANSFER_LIMITS.maxTotalBytes) {
    return { status: 'rejected', reason: 'source_limit_exceeded' }
  }
  const ordinary = ordinaryCanonicalEntries(canonical.entries, request.manifestHandling)
  if ('status' in ordinary) return ordinary
  const sourceDigest = await digestCanonicalEntries(request.sources, canonical.entries)
  if (sourceDigest !== request.sourceDigest) {
    return { status: 'rejected', reason: 'source_changed' }
  }
  const preparedEntries = preparePlacedEntries(request, ordinary.entries)
  if ('status' in preparedEntries) return preparedEntries
  return classifyPreparedEntries(preparedEntries, sourceDigest, request.textFileHandling)
}

function preparePlacedEntries(
  request: PlainTransferJobRequest,
  entries: ReadonlyArray<CanonicalEntry>,
): ReadonlyArray<PlacedEntry> | RejectedInventory {
  let placed: ReadonlyArray<PlacedEntry>
  try {
    placed = placeEntries(request, entries).filter((entry) => entry.placedPath.length > 0)
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

function classifyPreparedEntries(
  entries: ReadonlyArray<PlacedEntry>,
  sourceDigest: Sha256Digest,
  textFileHandling: PlainTransferJobRequest['textFileHandling'],
): PreparedInventory | RejectedInventory {
  const preparedEntries: Array<PreparedEntry> = []
  for (const entry of entries) {
    const classification = classifyEntry(entry, textFileHandling)
    if (classification?.classification === 'rejected') {
      return {
        status: 'rejected',
        reason: classification.reason,
        sourceId: entry.source.id,
        sourcePath: entry.placedPath,
      }
    }
    preparedEntries.push({ ...entry, classification })
  }
  return { entries: preparedEntries, sourceDigest }
}

async function materializePlainTransferResources(
  request: PlainTransferJobRequest,
  entries: ReadonlyArray<PreparedEntry>,
): Promise<ReadonlyArray<PlainTransferInventoryResource>> {
  const ids = await derivePlannedResourceIds(request, entries)
  return await Promise.all(
    entries.map((entry) => materializePlainTransferResource(request, entry, ids)),
  )
}

async function derivePlannedResourceIds(
  request: PlainTransferJobRequest,
  entries: ReadonlyArray<PreparedEntry>,
): Promise<ReadonlyMap<string, ResourceId>> {
  const ids = new Map<string, ResourceId>()
  const allocated = new Set<ResourceId>()
  for (const entry of entries) {
    const id = await derivePlannedResourceId(request, entry)
    if (allocated.has(id)) throw new TypeError('Plain transfer identity collision')
    allocated.add(id)
    ids.set(resourceKey(entry), id)
  }
  return ids
}

async function materializePlainTransferResource(
  request: PlainTransferJobRequest,
  entry: PreparedEntry,
  ids: ReadonlyMap<string, ResourceId>,
): Promise<PlainTransferInventoryResource> {
  const id = ids.get(resourceKey(entry))!
  const parentPath = pathParent(entry.placedPath)
  const parentId = parentPath
    ? (ids.get(resourceKey(entry, parentPath)) ?? request.destinationParentId)
    : request.destinationParentId
  const title = canonicalizeResourceTitle(pathBasename(entry.placedPath))
  const bytes = entry.bytes
  const base = {
    id,
    operationId: await derivePlannedOperationId(request, entry),
    parentId,
    title,
    sourceEntryPath: entry.path,
    sourcePath: entry.placedPath,
    sourceDigest: bytes ? await sha256Digest(bytes) : null,
    alias: createSourcePathAlias({
      campaignId: request.destinationCampaignId,
      importJobId: request.jobId,
      rawPath: entry.placedPath,
      resourceId: id,
      sourceRootId: entry.source.id,
    }),
  }
  if (entry.classification === null) {
    return {
      ...base,
      kind: 'folder',
      metadataVersion: await transferMetadataVersion(parentId, 'folder', title),
      content: null,
    }
  }
  if (!bytes) throw new TypeError('Classified plain transfer entry has no bytes')
  if (entry.classification.classification === 'note') {
    return {
      ...base,
      kind: 'note',
      metadataVersion: await transferMetadataVersion(parentId, 'note', title),
      content: {
        kind: 'note',
        source: {
          bytes,
          removedUtf8Bom: entry.classification.removedUtf8Bom,
          text: entry.classification.text,
        },
      },
    }
  }
  return {
    ...base,
    kind: 'file',
    metadataVersion: await transferMetadataVersion(parentId, 'file', title),
    content: { kind: 'file', source: { bytes, metadata: entry.classification } },
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

function validRequest(request: PlainTransferJobRequest): boolean {
  return (
    request.version === TRANSFER_JOB_REQUEST_VERSION &&
    isUuidV7(request.jobId) &&
    isUuidV7(request.operationId) &&
    isUuidV7(request.actorId) &&
    isUuidV7(request.destinationCampaignId) &&
    (request.destinationParentId === null || isUuidV7(request.destinationParentId)) &&
    (request.textFileHandling === 'notes' || request.textFileHandling === 'files') &&
    request.sources.length > 0 &&
    new Set(request.sources.map((source) => source.id)).size === request.sources.length &&
    request.sources.every(validPlainSourceDescriptor)
  )
}

function validPlainSourceDescriptor(source: TransferSourceDescriptor): boolean {
  if (source.id.length === 0 || source.name.length === 0 || source.kind === 'wizard_archive') {
    return false
  }
  try {
    return !normalizeSourcePath(source.name).includes('/')
  } catch {
    return false
  }
}

function canonicalEntries(
  sources: ReadonlyArray<TransferSourceDescriptor>,
  entries: ReadonlyArray<PlainTransferSourceEntry>,
):
  | Readonly<{ status: 'ready'; entries: ReadonlyArray<CanonicalEntry> }>
  | Extract<PlainTransferInventoryResult, { status: 'rejected' }> {
  const sourceById = new Map(sources.map((source) => [source.id, source]))
  const canonical: Array<CanonicalEntry> = []
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
      canonical.push({
        source,
        path,
        type: entry.type,
        bytes: entry.type === 'file' ? entry.bytes : null,
      })
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

function placeEntries(
  request: PlainTransferJobRequest,
  entries: ReadonlyArray<CanonicalEntry>,
): ReadonlyArray<PlacedEntry> {
  if (request.mode === 'plain_workspace') {
    return entries.map((entry) => {
      const wrapper =
        entry.source.kind === 'zip' ? soleTopLevelDirectory(entries, entry.source) : null
      return {
        ...entry,
        placedPath:
          wrapper && entry.path === wrapper
            ? ''
            : wrapper && entry.path.startsWith(`${wrapper}/`)
              ? entry.path.slice(wrapper.length + 1)
              : entry.path,
      }
    })
  }
  const sourceContainers = request.sources.flatMap((source): ReadonlyArray<PlacedEntry> => {
    if (source.kind === 'file') return []
    const path = plainTransferSourceContainer(source)
    return [{ source, path, placedPath: path, type: 'directory', bytes: null }]
  })
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

function plainTransferSourceContainer(source: TransferSourceDescriptor): string {
  const name =
    source.kind === 'zip' ? source.name.replace(/\.zip$/i, '') || source.name : source.name
  return normalizeSourcePath(name)
}

function ordinaryCanonicalEntries(
  entries: ReadonlyArray<CanonicalEntry>,
  manifestHandling: PlainTransferJobRequest['manifestHandling'],
): Readonly<{ entries: ReadonlyArray<CanonicalEntry> }> | RejectedInventory {
  const logical = canonicalLogicalEntries(entries)
  if (logical.some(({ control }) => control === 'invalid')) {
    return { status: 'rejected', reason: 'invalid_source' }
  }
  const manifests = logical.filter(({ control }) => control === 'manifest')
  if (manifests.length > 1 || manifests.some(({ entry }) => !validPlainManifest(entry))) {
    return { status: 'rejected', reason: 'invalid_source' }
  }
  if (manifests.length === 1 && manifestHandling === 'reject') {
    return { status: 'rejected', reason: 'manifest_requires_explicit_choice' }
  }
  return {
    entries: logical.filter(({ control }) => control === 'ordinary').map(({ entry }) => entry),
  }
}

function canonicalLogicalEntries(entries: ReadonlyArray<CanonicalEntry>) {
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

function validPlainManifest(entry: CanonicalEntry): boolean {
  if (entry.type !== 'file' || entry.bytes === null) return false
  try {
    const value: unknown = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(entry.bytes))
    return typeof value === 'object' && value !== null && !Array.isArray(value)
  } catch {
    return false
  }
}

function soleTopLevelDirectory(
  entries: ReadonlyArray<CanonicalEntry>,
  source: TransferSourceDescriptor,
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

function addImplicitDirectories(entries: ReadonlyArray<PlacedEntry>): ReadonlyArray<PlacedEntry> {
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
          bytes: null,
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

function hasFileAncestor<TEntry extends CanonicalEntry>(
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
  request: PlainTransferJobRequest,
  entry: PreparedEntry,
): Promise<ResourceId> {
  return await derivePlannedUuid(request, entry, DOMAIN_ID_KIND.resource, 'resource')
}

async function derivePlannedOperationId(
  request: PlainTransferJobRequest,
  entry: PreparedEntry,
): Promise<OperationId> {
  return await derivePlannedUuid(request, entry, DOMAIN_ID_KIND.operation, 'operation')
}

async function derivePlannedUuid<TKind extends DomainIdKind>(
  request: PlainTransferJobRequest,
  entry: PreparedEntry,
  kind: TKind,
  purpose: string,
): Promise<DomainIdByKind[TKind]> {
  const digest = await sha256Digest(
    new TextEncoder().encode(
      [
        PLAIN_TRANSFER_INVENTORY_VERSION,
        purpose,
        request.jobId,
        request.operationId,
        request.sourceDigest,
        request.destinationCampaignId,
        request.destinationParentId ?? '',
        request.mode,
        resourceKey(entry),
      ].join('\0'),
    ),
  )
  const timestamp = request.jobId.replaceAll('-', '').slice(0, 12)
  return assertDomainId(
    kind,
    `${timestamp.slice(0, 8)}-${timestamp.slice(8)}-7${digest.slice(0, 3)}-8${digest.slice(3, 6)}-${digest.slice(6, 18)}`,
  )
}

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0
}

function resourceKey(entry: Pick<PlacedEntry, 'source' | 'placedPath'>, path = entry.placedPath) {
  return sourcePathKey(entry, path)
}

function sourcePathKey(entry: Pick<CanonicalEntry, 'source'>, path: string) {
  return `${entry.source.id}\0${path}`
}

function classifyEntry(
  entry: PlacedEntry,
  textFileHandling: PlainTransferJobRequest['textFileHandling'],
): ResourceSourceClassification | null {
  if (entry.type === 'directory') return null
  const source = {
    bytes: entry.bytes!,
    fileName: pathBasename(entry.path),
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
