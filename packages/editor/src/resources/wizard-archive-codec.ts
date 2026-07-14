import { parseAuthoredDestination } from './authored-destination'
import type { AuthoredDestination } from './authored-destination-contract'
import { isVersionStamp, parseSha256Digest, sha256Digest } from './component-version'
import type { VersionStamp } from './component-version'
import { DOMAIN_ID_KIND, parseDomainId } from './domain-id'
import type { AssetId, DomainIdByKind, DomainIdKind, ResourceId } from './domain-id'
import {
  MAX_RELATIVE_PATH_UTF8_BYTES,
  MAX_SEGMENT_UTF8_BYTES,
  PORTABLE_PATH_VERSION,
} from './portable-path-contract'
import type { PortableRelativePath } from './portable-path-contract'
import { assertSourcePathAlias } from './source-path-alias'
import { hasUnpairedUtf16 } from './well-formed-unicode'
import type { ApplicationResourceRole, SourcePathAlias } from './resource-catalog-contract'
import { RESOURCE_KIND, canonicalizeResourceTitle } from './resource-contract'
import type { ResourceColor, ResourceIcon, ResourceKind, ResourceTitle } from './resource-contract'
import type { ResourceTombstone } from './resource-metadata-version'
import { FILE_CLASSIFICATION, FILE_VIEWER_UNAVAILABLE_REASON } from './file-content-contract'
import type { FileViewerUnavailableReason } from './file-content-contract'
import {
  WIZARD_ARCHIVE_CANVAS_SECTION_VERSION,
  WIZARD_ARCHIVE_FILE_SECTION_VERSION,
  WIZARD_ARCHIVE_MANIFEST_PATH,
  WIZARD_ARCHIVE_MAP_SECTION_VERSION,
  WIZARD_ARCHIVE_NOTE_SECTION_VERSION,
  WIZARD_ARCHIVE_SCHEMA_VERSION,
  WIZARD_ARCHIVE_VERSION,
} from './wizard-archive-contract'
import type {
  WizardArchiveArtifact,
  WizardArchiveCanvasSection,
  WizardArchiveFileSection,
  WizardArchiveManifest,
  WizardArchiveMapSection,
  WizardArchiveNoteSection,
  WizardArchiveResource,
} from './wizard-archive-contract'

export const MAX_WIZARD_ARCHIVE_MANIFEST_BYTES = 10 * 1024 * 1024
export const MAX_WIZARD_ARCHIVE_RESOURCES = 100_000
export const MAX_WIZARD_ARCHIVE_PACKAGE_ENTRIES = 100_001
export const MAX_WIZARD_ARCHIVE_ENTRY_BYTES = 100 * 1024 * 1024
export const MAX_WIZARD_ARCHIVE_TOTAL_BYTES = 10 * 1024 * 1024 * 1024
export const MAX_WIZARD_ARCHIVE_JSON_DEPTH = 100

export type WizardArchiveManifestParseResult =
  | Readonly<{ status: 'valid'; manifest: WizardArchiveManifest }>
  | Readonly<{
      status: 'invalid'
      reason:
        | 'manifest_too_large'
        | 'invalid_encoding'
        | 'invalid_json'
        | 'unsupported_version'
        | 'invalid_manifest'
    }>

export type WizardArchivePackageEntry =
  | Readonly<{ kind: 'directory'; path: string }>
  | Readonly<{ kind: 'file'; path: string; bytes: Uint8Array }>

export type WizardArchivePackageValidationResult =
  | Readonly<{ status: 'valid' }>
  | Readonly<{
      status: 'invalid'
      reason:
        | 'package_limit_exceeded'
        | 'invalid_entry_path'
        | 'duplicate_entry'
        | 'missing_artifact'
        | 'undeclared_artifact'
        | 'artifact_mismatch'
    }>

const textEncoder = new TextEncoder()
const textDecoder = new TextDecoder('utf-8', { fatal: true })
const FILE_CLASSIFICATIONS = new Set<WizardArchiveFileSection['classification']>(
  Object.values(FILE_CLASSIFICATION),
)
const FILE_VIEWER_UNAVAILABLE_REASONS: ReadonlySet<string> = new Set(
  Object.values(FILE_VIEWER_UNAVAILABLE_REASON),
)

export function encodeWizardArchiveManifest(manifest: WizardArchiveManifest): Uint8Array {
  if (!validateManifest(manifest)) throw new TypeError('Invalid Wizard Archive manifest')
  const normalized = normalizeManifest(manifest)
  return textEncoder.encode(`${JSON.stringify(normalized, null, 2)}\n`)
}

export function parseWizardArchiveManifest(bytes: Uint8Array): WizardArchiveManifestParseResult {
  if (bytes.byteLength > MAX_WIZARD_ARCHIVE_MANIFEST_BYTES) {
    return { status: 'invalid', reason: 'manifest_too_large' }
  }
  if (bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) {
    return { status: 'invalid', reason: 'invalid_encoding' }
  }
  let text: string
  try {
    text = textDecoder.decode(bytes)
  } catch {
    return { status: 'invalid', reason: 'invalid_encoding' }
  }
  let value: unknown
  try {
    value = JSON.parse(text)
  } catch {
    return { status: 'invalid', reason: 'invalid_json' }
  }
  if (!withinJsonDepth(value, MAX_WIZARD_ARCHIVE_JSON_DEPTH)) {
    return { status: 'invalid', reason: 'invalid_manifest' }
  }
  if (
    !isRecord(value) ||
    value.version !== WIZARD_ARCHIVE_VERSION ||
    value.schemaVersion !== WIZARD_ARCHIVE_SCHEMA_VERSION
  ) {
    return { status: 'invalid', reason: 'unsupported_version' }
  }
  if (
    'optionalSections' in value &&
    (!Array.isArray(value.optionalSections) ||
      value.optionalSections.some((section) => !isRecord(section) || section.required !== false))
  ) {
    return { status: 'invalid', reason: 'unsupported_version' }
  }
  const manifest = readManifest(value)
  return manifest !== null && validateManifest(manifest)
    ? { status: 'valid', manifest }
    : { status: 'invalid', reason: 'invalid_manifest' }
}

// Package validation is one ordered rejection pipeline so callers receive the first stable reason.
// fallow-ignore-next-line complexity
export async function validateWizardArchivePackage(
  manifest: WizardArchiveManifest,
  entries: ReadonlyArray<WizardArchivePackageEntry>,
): Promise<WizardArchivePackageValidationResult> {
  if (entries.length > MAX_WIZARD_ARCHIVE_PACKAGE_ENTRIES) {
    return { status: 'invalid', reason: 'package_limit_exceeded' }
  }
  let totalBytes = 0
  const entriesByPath = new Map<string, WizardArchivePackageEntry>()
  for (const entry of entries) {
    if (!isSafePackagePath(entry.path)) return { status: 'invalid', reason: 'invalid_entry_path' }
    if (entriesByPath.has(entry.path)) return { status: 'invalid', reason: 'duplicate_entry' }
    entriesByPath.set(entry.path, entry)
    if (entry.kind === 'file') {
      if (entry.bytes.byteLength > MAX_WIZARD_ARCHIVE_ENTRY_BYTES) {
        return { status: 'invalid', reason: 'package_limit_exceeded' }
      }
      totalBytes += entry.bytes.byteLength
      if (totalBytes > MAX_WIZARD_ARCHIVE_TOTAL_BYTES) {
        return { status: 'invalid', reason: 'package_limit_exceeded' }
      }
    }
  }

  const manifestEntry = entriesByPath.get(WIZARD_ARCHIVE_MANIFEST_PATH)
  if (!manifestEntry || manifestEntry.kind !== 'file') {
    return { status: 'invalid', reason: 'missing_artifact' }
  }
  const parsedManifest = parseWizardArchiveManifest(manifestEntry.bytes)
  if (
    parsedManifest.status !== 'valid' ||
    !equalBytes(
      encodeWizardArchiveManifest(parsedManifest.manifest),
      encodeWizardArchiveManifest(manifest),
    )
  ) {
    return { status: 'invalid', reason: 'artifact_mismatch' }
  }

  const declaredFiles = new Set<string>([WIZARD_ARCHIVE_MANIFEST_PATH])
  for (const resource of manifest.resources) {
    const entry = entriesByPath.get(resource.artifact.path)
    if (!entry || entry.kind !== resource.artifact.kind) {
      return { status: 'invalid', reason: 'missing_artifact' }
    }
    if (resource.artifact.kind === 'directory') continue
    declaredFiles.add(resource.artifact.path)
    if (
      entry.kind !== 'file' ||
      entry.bytes.byteLength !== resource.artifact.byteSize ||
      (await sha256Digest(entry.bytes)) !== resource.artifact.digest
    ) {
      return { status: 'invalid', reason: 'artifact_mismatch' }
    }
  }
  for (const entry of entries) {
    if (entry.kind === 'file' && !declaredFiles.has(entry.path)) {
      return { status: 'invalid', reason: 'undeclared_artifact' }
    }
  }
  return { status: 'valid' }
}

function readManifest(value: Record<string, unknown>): WizardArchiveManifest | null {
  if (
    !hasRequiredKeysAndOptionalSection(value, [
      'version',
      'schemaVersion',
      'scope',
      'sourceCampaignId',
      'transferSnapshotId',
      'portablePathVersion',
      'resources',
      'tombstones',
      'aliases',
      'roles',
      'sections',
    ]) ||
    value.scope !== 'full_campaign' ||
    value.portablePathVersion !== PORTABLE_PATH_VERSION ||
    !Array.isArray(value.resources) ||
    !Array.isArray(value.tombstones) ||
    !Array.isArray(value.aliases) ||
    !Array.isArray(value.roles) ||
    !isRecord(value.sections) ||
    value.resources.length > MAX_WIZARD_ARCHIVE_RESOURCES ||
    value.tombstones.length > MAX_WIZARD_ARCHIVE_RESOURCES ||
    value.aliases.length > MAX_WIZARD_ARCHIVE_RESOURCES ||
    value.roles.length > MAX_WIZARD_ARCHIVE_RESOURCES
  ) {
    return null
  }
  const sourceCampaignId = domainId(DOMAIN_ID_KIND.campaign, value.sourceCampaignId)
  const transferSnapshotId = domainId(DOMAIN_ID_KIND.snapshot, value.transferSnapshotId)
  const resources = readArray(value.resources, readResource)
  const tombstones = readArray(value.tombstones, readTombstone)
  const aliases = readArray(value.aliases, readAlias)
  const roles = readArray(value.roles, readRole)
  const sections = readSections(value.sections)
  if (
    sourceCampaignId === null ||
    transferSnapshotId === null ||
    resources === null ||
    tombstones === null ||
    aliases === null ||
    roles === null ||
    sections === null
  ) {
    return null
  }
  return {
    version: WIZARD_ARCHIVE_VERSION,
    schemaVersion: WIZARD_ARCHIVE_SCHEMA_VERSION,
    scope: 'full_campaign',
    sourceCampaignId,
    transferSnapshotId,
    portablePathVersion: PORTABLE_PATH_VERSION,
    resources,
    tombstones,
    aliases,
    roles,
    sections,
  }
}

function hasRequiredKeysAndOptionalSection(
  value: Record<string, unknown>,
  requiredKeys: ReadonlyArray<string>,
): boolean {
  const allowedKeys = new Set([...requiredKeys, 'optionalSections'])
  if (
    !requiredKeys.every((key) => key in value) ||
    !Object.keys(value).every((key) => allowedKeys.has(key))
  ) {
    return false
  }
  if (!('optionalSections' in value)) return true
  if (!Array.isArray(value.optionalSections) || value.optionalSections.length > 100) return false
  return value.optionalSections.every(
    (section) =>
      isRecord(section) &&
      hasExactKeys(section, ['name', 'version', 'required', 'data']) &&
      typeof section.name === 'string' &&
      section.name.length > 0 &&
      typeof section.version === 'string' &&
      section.version.length > 0 &&
      section.required === false,
  )
}

function readResource(value: unknown): WizardArchiveResource | null {
  if (
    !isRecord(value) ||
    !hasExactKeys(value, [
      'id',
      'parentId',
      'kind',
      'title',
      'icon',
      'color',
      'lifecycle',
      'metadataVersion',
      'contentVersion',
      'artifact',
    ]) ||
    !isResourceKind(value.kind) ||
    typeof value.title !== 'string' ||
    !isNullableString(value.icon) ||
    !isNullableString(value.color) ||
    (value.lifecycle !== 'active' && value.lifecycle !== 'trashed') ||
    !isVersionStamp(value.metadataVersion) ||
    (value.contentVersion !== null && !isVersionStamp(value.contentVersion))
  ) {
    return null
  }
  const id = domainId(DOMAIN_ID_KIND.resource, value.id)
  const parentId =
    value.parentId === null ? null : domainId(DOMAIN_ID_KIND.resource, value.parentId)
  const artifact = readArtifact(value.artifact)
  let title: ResourceTitle
  try {
    title = canonicalizeResourceTitle(value.title)
  } catch {
    return null
  }
  if (
    title !== value.title ||
    id === null ||
    (value.parentId !== null && parentId === null) ||
    !artifact
  ) {
    return null
  }
  return {
    id,
    parentId,
    kind: value.kind,
    title,
    icon: value.icon as ResourceIcon | null,
    color: value.color as ResourceColor | null,
    lifecycle: value.lifecycle,
    metadataVersion: value.metadataVersion,
    contentVersion: value.contentVersion as VersionStamp | null,
    artifact,
  }
}

function readArtifact(value: unknown): WizardArchiveArtifact | null {
  if (!isRecord(value) || typeof value.path !== 'string' || !isSafePackagePath(value.path)) {
    return null
  }
  if (value.kind === 'directory' && hasExactKeys(value, ['kind', 'path'])) {
    return { kind: 'directory', path: value.path as PortableRelativePath }
  }
  if (
    value.kind !== 'file' ||
    !hasExactKeys(value, ['kind', 'path', 'mediaType', 'byteSize', 'digest']) ||
    typeof value.mediaType !== 'string' ||
    value.mediaType.length === 0 ||
    !Number.isSafeInteger(value.byteSize) ||
    (value.byteSize as number) < 0 ||
    (value.byteSize as number) > MAX_WIZARD_ARCHIVE_ENTRY_BYTES ||
    typeof value.digest !== 'string'
  ) {
    return null
  }
  const digest = parseSha256Digest(value.digest)
  return digest === null
    ? null
    : {
        kind: 'file',
        path: value.path as PortableRelativePath,
        mediaType: value.mediaType,
        byteSize: value.byteSize as number,
        digest,
      }
}

function readTombstone(value: unknown): ResourceTombstone | null {
  if (
    !isRecord(value) ||
    !hasExactKeys(value, ['resourceId', 'campaignId', 'deletionVersion', 'deletedAt']) ||
    !isVersionStamp(value.deletionVersion) ||
    typeof value.deletedAt !== 'number' ||
    !Number.isFinite(value.deletedAt)
  ) {
    return null
  }
  const resourceId = domainId(DOMAIN_ID_KIND.resource, value.resourceId)
  const campaignId = domainId(DOMAIN_ID_KIND.campaign, value.campaignId)
  return resourceId && campaignId
    ? { resourceId, campaignId, deletionVersion: value.deletionVersion, deletedAt: value.deletedAt }
    : null
}

function readAlias(value: unknown): SourcePathAlias | null {
  if (
    !isRecord(value) ||
    !hasExactKeys(value, [
      'campaignId',
      'resourceId',
      'importJobId',
      'sourceRootId',
      'rawPath',
      'normalizedPath',
    ]) ||
    typeof value.sourceRootId !== 'string' ||
    typeof value.rawPath !== 'string' ||
    typeof value.normalizedPath !== 'string'
  ) {
    return null
  }
  const campaignId = domainId(DOMAIN_ID_KIND.campaign, value.campaignId)
  const resourceId = domainId(DOMAIN_ID_KIND.resource, value.resourceId)
  const importJobId = domainId(DOMAIN_ID_KIND.importJob, value.importJobId)
  if (!campaignId || !resourceId || !importJobId) return null
  const alias = {
    campaignId,
    resourceId,
    importJobId,
    sourceRootId: value.sourceRootId,
    rawPath: value.rawPath,
    normalizedPath: value.normalizedPath,
  }
  try {
    assertSourcePathAlias(alias)
    return alias
  } catch {
    return null
  }
}

function readRole(value: unknown): ApplicationResourceRole | null {
  if (
    !isRecord(value) ||
    !hasExactKeys(value, ['role', 'resourceId']) ||
    typeof value.role !== 'string' ||
    value.role.length === 0
  ) {
    return null
  }
  const resourceId = domainId(DOMAIN_ID_KIND.resource, value.resourceId)
  return resourceId ? { role: value.role, resourceId } : null
}

function readSections(value: Record<string, unknown>): WizardArchiveManifest['sections'] | null {
  if (!hasExactKeys(value, ['notes', 'files', 'maps', 'canvases'])) return null
  const notes = readSection(value.notes, WIZARD_ARCHIVE_NOTE_SECTION_VERSION, readNoteSection)
  const files = readSection(value.files, WIZARD_ARCHIVE_FILE_SECTION_VERSION, readFileSection)
  const maps = readSection(value.maps, WIZARD_ARCHIVE_MAP_SECTION_VERSION, readMapSection)
  const canvases = readSection(
    value.canvases,
    WIZARD_ARCHIVE_CANVAS_SECTION_VERSION,
    readCanvasSection,
  )
  return notes && files && maps && canvases ? { notes, files, maps, canvases } : null
}

function readSection<T, V extends string>(
  value: unknown,
  version: V,
  readEntry: (value: unknown) => T | null,
): Readonly<{ version: V; entries: ReadonlyArray<T> }> | null {
  if (
    !isRecord(value) ||
    !hasExactKeys(value, ['version', 'entries']) ||
    value.version !== version ||
    !Array.isArray(value.entries)
  ) {
    return null
  }
  const entries = readArray(value.entries, readEntry)
  return entries === null ? null : { version, entries }
}

function readNoteSection(value: unknown): WizardArchiveNoteSection | null {
  if (!isDomainSection(value, ['resourceId', 'blockIds', 'destinations'])) return null
  const resourceId = domainId(DOMAIN_ID_KIND.resource, value.resourceId)
  const blockIds = readIds(DOMAIN_ID_KIND.noteBlock, value.blockIds)
  const destinations = readDestinations(value.destinations)
  return resourceId && blockIds && destinations ? { resourceId, blockIds, destinations } : null
}

function readFileSection(value: unknown): WizardArchiveFileSection | null {
  if (
    !isDomainSection(value, [
      'resourceId',
      'assetId',
      'classification',
      'byteSize',
      'detectedFormat',
      'extension',
      'mediaType',
      'viewerUnavailableReason',
      'destinations',
    ]) ||
    !FILE_CLASSIFICATIONS.has(value.classification as WizardArchiveFileSection['classification']) ||
    !isByteSize(value.byteSize) ||
    !isNullableString(value.detectedFormat) ||
    !isNullableString(value.extension) ||
    typeof value.mediaType !== 'string' ||
    !isFileViewerUnavailableReason(value.viewerUnavailableReason)
  ) {
    return null
  }
  const resourceId = domainId(DOMAIN_ID_KIND.resource, value.resourceId)
  const assetId = domainId(DOMAIN_ID_KIND.asset, value.assetId)
  const destinations = readDestinations(value.destinations)
  return resourceId && assetId && destinations
    ? {
        resourceId,
        assetId,
        classification: value.classification as WizardArchiveFileSection['classification'],
        byteSize: value.byteSize,
        detectedFormat: value.detectedFormat as string | null,
        extension: value.extension as string | null,
        mediaType: value.mediaType,
        viewerUnavailableReason: value.viewerUnavailableReason,
        destinations,
      }
    : null
}

function readMapSection(value: unknown): WizardArchiveMapSection | null {
  if (!isDomainSection(value, ['resourceId', 'pinIds', 'destinations'])) return null
  const resourceId = domainId(DOMAIN_ID_KIND.resource, value.resourceId)
  const pinIds = readIds(DOMAIN_ID_KIND.mapPin, value.pinIds)
  const destinations = readDestinations(value.destinations)
  return resourceId && pinIds && destinations ? { resourceId, pinIds, destinations } : null
}

function readCanvasSection(value: unknown): WizardArchiveCanvasSection | null {
  if (!isDomainSection(value, ['resourceId', 'nodeIds', 'destinations'])) return null
  const resourceId = domainId(DOMAIN_ID_KIND.resource, value.resourceId)
  const nodeIds = readIds(DOMAIN_ID_KIND.canvasNode, value.nodeIds)
  const destinations = readDestinations(value.destinations)
  return resourceId && nodeIds && destinations ? { resourceId, nodeIds, destinations } : null
}

// Manifest validation is one ordered invariant pass over the decoded archive contract.
// fallow-ignore-next-line complexity
function validateManifest(manifest: WizardArchiveManifest): boolean {
  if (
    manifest.version !== WIZARD_ARCHIVE_VERSION ||
    manifest.schemaVersion !== WIZARD_ARCHIVE_SCHEMA_VERSION ||
    manifest.scope !== 'full_campaign' ||
    manifest.portablePathVersion !== PORTABLE_PATH_VERSION ||
    manifest.resources.length > MAX_WIZARD_ARCHIVE_RESOURCES ||
    manifest.sections.notes.version !== WIZARD_ARCHIVE_NOTE_SECTION_VERSION ||
    manifest.sections.files.version !== WIZARD_ARCHIVE_FILE_SECTION_VERSION ||
    manifest.sections.maps.version !== WIZARD_ARCHIVE_MAP_SECTION_VERSION ||
    manifest.sections.canvases.version !== WIZARD_ARCHIVE_CANVAS_SECTION_VERSION
  ) {
    return false
  }
  const resources = new Map<ResourceId, WizardArchiveResource>()
  const pathKeys = new Set<string>()
  let artifactBytes = 0
  for (const resource of manifest.resources) {
    if (resources.has(resource.id) || !validateResourceArtifact(resource)) return false
    const pathKey = portableCollisionKey(resource.artifact.path)
    if (pathKeys.has(pathKey)) return false
    pathKeys.add(pathKey)
    resources.set(resource.id, resource)
    if (resource.artifact.kind === 'file') {
      artifactBytes += resource.artifact.byteSize
      if (artifactBytes > MAX_WIZARD_ARCHIVE_TOTAL_BYTES) return false
    }
  }
  for (const resource of resources.values()) {
    if (
      !validateHierarchy(resource, resources) ||
      !validateArtifactPlacement(resource, resources)
    ) {
      return false
    }
  }

  const tombstoneIds = new Set<ResourceId>()
  for (const tombstone of manifest.tombstones) {
    if (
      tombstone.campaignId !== manifest.sourceCampaignId ||
      resources.has(tombstone.resourceId) ||
      tombstoneIds.has(tombstone.resourceId)
    ) {
      return false
    }
    tombstoneIds.add(tombstone.resourceId)
  }
  const aliasKeys = new Set<string>()
  for (const alias of manifest.aliases) {
    try {
      assertSourcePathAlias(alias)
    } catch {
      return false
    }
    const key = `${alias.resourceId}:${alias.importJobId}:${alias.sourceRootId}:${alias.normalizedPath}`
    if (
      alias.campaignId !== manifest.sourceCampaignId ||
      !resources.has(alias.resourceId) ||
      aliasKeys.has(key)
    ) {
      return false
    }
    aliasKeys.add(key)
  }
  const roleNames = new Set<string>()
  for (const role of manifest.roles) {
    if (!resources.has(role.resourceId) || roleNames.has(role.role)) return false
    roleNames.add(role.role)
  }

  const noteIds = validateDomainEntries(manifest.sections.notes.entries, 'note', resources)
  const fileIds = validateDomainEntries(manifest.sections.files.entries, 'file', resources)
  const mapIds = validateDomainEntries(manifest.sections.maps.entries, 'map', resources)
  const canvasIds = validateDomainEntries(manifest.sections.canvases.entries, 'canvas', resources)
  if (!noteIds || !fileIds || !mapIds || !canvasIds) return false
  const contentIds = new Set([...noteIds, ...fileIds, ...mapIds, ...canvasIds])
  for (const resource of resources.values()) {
    if (resource.kind !== 'folder' && !contentIds.has(resource.id)) {
      return false
    }
  }
  const assetIds = new Set<AssetId>()
  for (const file of manifest.sections.files.entries) {
    const resource = resources.get(file.resourceId)!
    if (
      assetIds.has(file.assetId) ||
      file.mediaType.length === 0 ||
      resource.artifact.kind !== 'file' ||
      resource.artifact.byteSize !== file.byteSize ||
      resource.artifact.mediaType !== file.mediaType ||
      !validFileViewerState(file) ||
      !isCanonicalExtension(file.extension) ||
      (file.extension !== null && !resource.artifact.path.endsWith(`.${file.extension}`))
    ) {
      return false
    }
    assetIds.add(file.assetId)
  }
  return validateDestinations(manifest, resources)
}

function validFileViewerState(file: WizardArchiveFileSection): boolean {
  return file.classification === FILE_CLASSIFICATION.inert
    ? file.viewerUnavailableReason !== null
    : file.viewerUnavailableReason === null
}

function isFileViewerUnavailableReason(
  value: unknown,
): value is FileViewerUnavailableReason | null {
  return value === null || (typeof value === 'string' && FILE_VIEWER_UNAVAILABLE_REASONS.has(value))
}

function isByteSize(value: unknown): value is number {
  return (
    Number.isSafeInteger(value) &&
    (value as number) >= 0 &&
    (value as number) <= MAX_WIZARD_ARCHIVE_ENTRY_BYTES
  )
}

function validateResourceArtifact(resource: WizardArchiveResource): boolean {
  if (resource.kind === 'folder') {
    return resource.contentVersion === null && resource.artifact.kind === 'directory'
  }
  if (resource.contentVersion === null || resource.artifact.kind !== 'file') return false
  switch (resource.kind) {
    case 'note':
      return resource.artifact.path.endsWith('.md')
    case 'map':
      return resource.artifact.path.endsWith('.wizardmap')
    case 'canvas':
      return resource.artifact.path.endsWith('.wizardcanvas')
    case 'file':
      return true
  }
}

function validateHierarchy(
  resource: WizardArchiveResource,
  resources: ReadonlyMap<ResourceId, WizardArchiveResource>,
): boolean {
  const visited = new Set<ResourceId>([resource.id])
  let parentId = resource.parentId
  while (parentId !== null) {
    if (visited.has(parentId)) return false
    const parent = resources.get(parentId)
    if (!parent || parent.kind !== 'folder') return false
    visited.add(parentId)
    if (resource.lifecycle === 'active' && parent.lifecycle === 'trashed') return false
    parentId = parent.parentId
  }
  return true
}

function validateArtifactPlacement(
  resource: WizardArchiveResource,
  resources: ReadonlyMap<ResourceId, WizardArchiveResource>,
): boolean {
  const path = resource.artifact.path
  if (resource.lifecycle === 'active') {
    if (path.startsWith('.wizardarchive/')) return false
  } else if (!path.startsWith('.wizardarchive/trashed/')) {
    return false
  }
  if (resource.parentId === null) return true
  const parent = resources.get(resource.parentId)!
  if (parent.lifecycle !== resource.lifecycle) return resource.lifecycle === 'trashed'
  return path.startsWith(`${parent.artifact.path}/`)
}

function validateDomainEntries<T extends { resourceId: ResourceId }>(
  entries: ReadonlyArray<T>,
  kind: ResourceKind,
  resources: ReadonlyMap<ResourceId, WizardArchiveResource>,
): Set<ResourceId> | null {
  const ids = new Set<ResourceId>()
  for (const entry of entries) {
    if (ids.has(entry.resourceId) || resources.get(entry.resourceId)?.kind !== kind) return null
    ids.add(entry.resourceId)
  }
  return ids
}

function validateDestinations(
  manifest: WizardArchiveManifest,
  resources: ReadonlyMap<ResourceId, WizardArchiveResource>,
): boolean {
  const noteBlocks = localIdOwners(manifest.sections.notes.entries, 'blockIds')
  const mapPins = localIdOwners(manifest.sections.maps.entries, 'pinIds')
  const canvasNodes = localIdOwners(manifest.sections.canvases.entries, 'nodeIds')
  if (!noteBlocks || !mapPins || !canvasNodes) return false
  const destinations = [
    ...manifest.sections.notes.entries,
    ...manifest.sections.files.entries,
    ...manifest.sections.maps.entries,
    ...manifest.sections.canvases.entries,
  ].flatMap((entry) => entry.destinations)
  return destinations.every((destination) => {
    if (destination.kind !== 'internal') return true
    if (!resources.has(destination.target.resourceId)) return false
    switch (destination.target.kind) {
      case 'resource':
        return true
      case 'noteBlock':
        return noteBlocks.get(destination.target.blockId) === destination.target.resourceId
      case 'mapPin':
        return mapPins.get(destination.target.pinId) === destination.target.resourceId
      case 'canvasNode':
        return canvasNodes.get(destination.target.nodeId) === destination.target.resourceId
    }
  })
}

function localIdOwners<T extends { resourceId: ResourceId }, K extends keyof T>(
  entries: ReadonlyArray<T>,
  field: K,
): Map<T[K] extends ReadonlyArray<infer TId> ? TId : never, ResourceId> | null {
  type LocalId = T[K] extends ReadonlyArray<infer TId> ? TId : never
  const owners = new Map<LocalId, ResourceId>()
  for (const entry of entries) {
    for (const id of entry[field] as ReadonlyArray<LocalId>) {
      if (owners.has(id)) return null
      owners.set(id, entry.resourceId)
    }
  }
  return owners
}

function normalizeManifest(manifest: WizardArchiveManifest): WizardArchiveManifest {
  return {
    version: WIZARD_ARCHIVE_VERSION,
    schemaVersion: WIZARD_ARCHIVE_SCHEMA_VERSION,
    scope: 'full_campaign',
    sourceCampaignId: manifest.sourceCampaignId,
    transferSnapshotId: manifest.transferSnapshotId,
    portablePathVersion: PORTABLE_PATH_VERSION,
    resources: [...manifest.resources].sort(byId),
    tombstones: [...manifest.tombstones].sort((left, right) =>
      left.resourceId.localeCompare(right.resourceId),
    ),
    aliases: [...manifest.aliases].sort((left, right) =>
      `${left.resourceId}:${left.normalizedPath}`.localeCompare(
        `${right.resourceId}:${right.normalizedPath}`,
      ),
    ),
    roles: [...manifest.roles].sort((left, right) => left.role.localeCompare(right.role)),
    sections: {
      notes: {
        version: WIZARD_ARCHIVE_NOTE_SECTION_VERSION,
        entries: [...manifest.sections.notes.entries].sort(byResourceId),
      },
      files: {
        version: WIZARD_ARCHIVE_FILE_SECTION_VERSION,
        entries: [...manifest.sections.files.entries].sort(byResourceId),
      },
      maps: {
        version: WIZARD_ARCHIVE_MAP_SECTION_VERSION,
        entries: [...manifest.sections.maps.entries].sort(byResourceId),
      },
      canvases: {
        version: WIZARD_ARCHIVE_CANVAS_SECTION_VERSION,
        entries: [...manifest.sections.canvases.entries].sort(byResourceId),
      },
    },
  }
}

function readDestinations(value: unknown): ReadonlyArray<AuthoredDestination> | null {
  return Array.isArray(value) ? readArray(value, parseAuthoredDestination) : null
}

function readIds<TKind extends DomainIdKind>(
  kind: TKind,
  value: unknown,
): Array<DomainIdByKind[TKind]> | null {
  if (!Array.isArray(value)) return null
  const ids: Array<DomainIdByKind[TKind]> = []
  for (const candidate of value) {
    const parsed = domainId(kind, candidate)
    if (parsed === null) return null
    ids.push(parsed)
  }
  return ids
}

function domainId<TKind extends DomainIdKind>(
  kind: TKind,
  value: unknown,
): DomainIdByKind[TKind] | null {
  return typeof value === 'string' ? parseDomainId(kind, value) : null
}

function isDomainSection(
  value: unknown,
  keys: ReadonlyArray<string>,
): value is Record<string, unknown> {
  return isRecord(value) && hasExactKeys(value, keys)
}

function readArray<T>(
  values: ReadonlyArray<unknown>,
  read: (value: unknown) => T | null,
): Array<T> | null {
  const result: Array<T> = []
  for (const value of values) {
    const parsed = read(value)
    if (parsed === null) return null
    result.push(parsed)
  }
  return result
}

function isResourceKind(value: unknown): value is ResourceKind {
  return typeof value === 'string' && Object.values(RESOURCE_KIND).includes(value as ResourceKind)
}

function isNullableString(value: unknown): value is string | null {
  return value === null || typeof value === 'string'
}

function isCanonicalExtension(value: string | null): boolean {
  return value === null || /^[a-z0-9][a-z0-9._-]*$/.test(value)
}

function isSafePackagePath(path: string): boolean {
  if (
    path.length === 0 ||
    path.startsWith('/') ||
    path.includes('\\') ||
    /^[a-z]:/i.test(path) ||
    hasUnpairedUtf16(path) ||
    textEncoder.encode(path).byteLength > MAX_RELATIVE_PATH_UTF8_BYTES
  ) {
    return false
  }
  return path
    .split('/')
    .every(
      (segment) =>
        segment.length > 0 &&
        segment !== '.' &&
        segment !== '..' &&
        segment.normalize('NFC') === segment &&
        !/[\p{Cc}<>:"/\\|?*]/u.test(segment) &&
        !/[ .]$/u.test(segment) &&
        textEncoder.encode(segment).byteLength <= MAX_SEGMENT_UTF8_BYTES,
    )
}

function portableCollisionKey(path: string): string {
  return path
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[ .]+$/gu, '')
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function withinJsonDepth(value: unknown, maximumDepth: number): boolean {
  const pending: Array<Readonly<{ value: unknown; depth: number }>> = [{ value, depth: 1 }]
  while (pending.length > 0) {
    const current = pending.pop()!
    if (current.depth > maximumDepth) return false
    if (Array.isArray(current.value)) {
      for (const child of current.value) pending.push({ value: child, depth: current.depth + 1 })
    } else if (isRecord(current.value)) {
      for (const child of Object.values(current.value)) {
        pending.push({ value: child, depth: current.depth + 1 })
      }
    }
  }
  return true
}

function hasExactKeys(value: Record<string, unknown>, keys: ReadonlyArray<string>): boolean {
  const actual = Object.keys(value)
  return actual.length === keys.length && actual.every((key) => keys.includes(key))
}

function equalBytes(left: Uint8Array, right: Uint8Array): boolean {
  return left.byteLength === right.byteLength && left.every((byte, index) => byte === right[index])
}

function byId(left: WizardArchiveResource, right: WizardArchiveResource): number {
  return left.id.localeCompare(right.id)
}

function byResourceId<T extends { resourceId: ResourceId }>(left: T, right: T): number {
  return left.resourceId.localeCompare(right.resourceId)
}
