import type { Sha256Digest, VersionStamp } from './component-version'
import { sha256Digest } from './component-version'
import { DOMAIN_ID_KIND, assertDomainId, isUuidV7 } from './domain-id'
import type { ResourceId } from './domain-id'
import type { FileOwnedMetadata } from './file-content-contract'
import { initialResourceMetadataVersion } from './resource-metadata-version'
import type { ResourceKind, ResourceTitle } from './resource-record'
import { MAX_SYNCHRONOUS_RESOURCE_CLOSURE, canonicalizeResourceTitle } from './resource-record'
import { classifyResourceSource } from './resource-source-classifier'
import type {
  ResourceSourceClassification,
  ResourceSourceInspection,
} from './resource-source-classifier'
import { createSourcePathAlias, normalizeSourcePath } from './source-path-alias'
import type { SourcePathAlias } from './resource-catalog-contract'
import { TRANSFER_JOB_REQUEST_VERSION } from './transfer-job-contract'
import type { PlainTransferJobRequest, TransferSourceDescriptor } from './transfer-job-contract'

export const PLAIN_TRANSFER_INVENTORY_VERSION = 'plain-transfer-inventory-v2' as const
export const PLAIN_TRANSFER_LIMITS = {
  maxEntries: MAX_SYNCHRONOUS_RESOURCE_CLOSURE,
  maxPathDepth: 64,
  maxPathUtf8Bytes: 1_024,
  maxTotalBytes: 500 * 1024 * 1024,
} as const

export type PlainTransferSourceEntry =
  | Readonly<{ sourceId: string; path: string; type: 'directory' }>
  | Readonly<{
      sourceId: string
      path: string
      type: 'file'
      bytes: Uint8Array
      inspection?: ResourceSourceInspection
    }>

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

export type PlainTransferInventoryResource = Readonly<{
  id: ResourceId
  parentId: ResourceId | null
  kind: ResourceKind
  title: ResourceTitle
  sourcePath: string
  sourceDigest: Sha256Digest | null
  metadataVersion: VersionStamp
  alias: SourcePathAlias
  content: PlainTransferInventoryContent | null
}>

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
  inspection?: ResourceSourceInspection
}>

type PlacedEntry = CanonicalEntry & Readonly<{ placedPath: string }>

type PreparedEntry = PlacedEntry & Readonly<{ classification: ResourceSourceClassification | null }>

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
        `entry\0${entry.source.id}\0${entry.path}\0${entry.type}\0${entry.bytes?.byteLength ?? 0}\0${bytesDigest}\0${canonicalJson(entry.inspection ?? null)}`,
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
  return classifyPreparedEntries(preparedEntries, sourceDigest)
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
  if (hasFileAncestor(resourcePaths)) return { status: 'rejected', reason: 'invalid_source' }
  return resourcePaths
}

function classifyPreparedEntries(
  entries: ReadonlyArray<PlacedEntry>,
  sourceDigest: Sha256Digest,
): PreparedInventory | RejectedInventory {
  const preparedEntries: Array<PreparedEntry> = []
  for (const entry of entries) {
    const classification = classifyEntry(entry)
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
  const kind = preparedResourceKind(entry)
  const title = canonicalizeResourceTitle(pathBasename(entry.placedPath))
  const bytes = entry.bytes
  return {
    id,
    parentId,
    kind,
    title,
    sourcePath: entry.placedPath,
    sourceDigest: bytes ? await sha256Digest(bytes) : null,
    metadataVersion: await initialResourceMetadataVersion({
      parentId,
      kind,
      title,
      icon: null,
      color: null,
      lifecycle: 'active',
    }),
    alias: createSourcePathAlias({
      campaignId: request.destinationCampaignId,
      importJobId: request.jobId,
      rawPath: entry.placedPath,
      resourceId: id,
      sourceRootId: entry.source.id,
    }),
    content: entry.classification ? inventoryContent(entry.classification, bytes) : null,
  }
}

function preparedResourceKind(entry: PreparedEntry): ResourceKind {
  if (entry.classification === null) return 'folder'
  return entry.classification.classification === 'note' ? 'note' : 'file'
}

function validRequest(request: PlainTransferJobRequest): boolean {
  return (
    request.version === TRANSFER_JOB_REQUEST_VERSION &&
    isUuidV7(request.jobId) &&
    isUuidV7(request.operationId) &&
    isUuidV7(request.actorId) &&
    isUuidV7(request.destinationCampaignId) &&
    (request.destinationParentId === null || isUuidV7(request.destinationParentId)) &&
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
        ...(entry.type === 'file' && entry.inspection ? { inspection: entry.inspection } : {}),
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
  return entries.map((entry) => {
    if (request.mode === 'plain_workspace') {
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
    }
    if (entry.source.kind === 'file') return { ...entry, placedPath: entry.path }
    const container =
      entry.source.kind === 'zip'
        ? entry.source.name.replace(/\.zip$/i, '') || entry.source.name
        : entry.source.name
    return { ...entry, placedPath: `${normalizeSourcePath(container)}/${entry.path}` }
  })
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
  if (controlSegment !== 0) return 'invalid'
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

function hasFileAncestor(entries: ReadonlyArray<PlacedEntry>): boolean {
  const byPath = new Map(entries.map((entry) => [resourceKey(entry), entry]))
  for (const entry of entries) {
    for (const parent of ancestorPaths(entry.placedPath)) {
      const ancestor = byPath.get(resourceKey(entry, parent))
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
  const digest = await sha256Digest(
    new TextEncoder().encode(
      [
        PLAIN_TRANSFER_INVENTORY_VERSION,
        request.jobId,
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
    DOMAIN_ID_KIND.resource,
    `${timestamp.slice(0, 8)}-${timestamp.slice(8)}-7${digest.slice(0, 3)}-8${digest.slice(3, 6)}-${digest.slice(6, 18)}`,
  )
}

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0
}

function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value)
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`
  const entries = Object.entries(value as Readonly<Record<string, unknown>>).sort(
    ([left], [right]) => compareText(left, right),
  )
  return `{${entries.map(([key, entry]) => `${JSON.stringify(key)}:${canonicalJson(entry)}`).join(',')}}`
}

function resourceKey(entry: Pick<PlacedEntry, 'source' | 'placedPath'>, path = entry.placedPath) {
  return `${entry.source.id}\0${path}`
}

function classifyEntry(entry: PlacedEntry): ResourceSourceClassification | null {
  if (entry.type === 'directory') return null
  return classifyResourceSource({
    bytes: entry.bytes!,
    fileName: pathBasename(entry.path),
    ...(entry.inspection ? { inspection: entry.inspection } : {}),
  })
}

function inventoryContent(
  classified: ResourceSourceClassification,
  bytes: Uint8Array | null,
): PlainTransferInventoryContent | null {
  if (!bytes) return null
  if (classified.classification === 'note') {
    return {
      kind: 'note',
      source: {
        bytes,
        removedUtf8Bom: classified.removedUtf8Bom,
        text: classified.text,
      },
    }
  }
  if (classified.classification === 'rejected') return null
  return { kind: 'file', source: { bytes, metadata: classified } }
}

function pathParent(path: string): string | null {
  const separator = path.lastIndexOf('/')
  return separator === -1 ? null : path.slice(0, separator)
}

function pathBasename(path: string): string {
  return path.slice(path.lastIndexOf('/') + 1)
}
