import type { AuthoredDestination } from './authored-destination-contract'
import type { Sha256Digest, VersionStamp } from './component-version'
import type {
  AssetId,
  CampaignId,
  CanvasNodeId,
  MapPinId,
  NoteBlockId,
  ResourceId,
  SnapshotId,
} from './domain-id'
import type { PORTABLE_PATH_VERSION, PortableRelativePath } from './portable-path-contract'
import type { ResourceColor, ResourceIcon, ResourceKind, ResourceTitle } from './resource-record'
import type { SourcePathAlias } from './resource-catalog-contract'
import type { ResourceTombstone } from './resource-metadata-version'
import type { FileOwnedMetadata } from './file-content-contract'

export const WIZARD_ARCHIVE_VERSION = 'wizard-archive-v1' as const
export const WIZARD_ARCHIVE_SCHEMA_VERSION = 'wizard-archive-manifest-v1' as const
export const WIZARD_ARCHIVE_NOTE_SECTION_VERSION = 'note-transfer-v1' as const
export const WIZARD_ARCHIVE_FILE_SECTION_VERSION = 'file-transfer-v1' as const
export const WIZARD_ARCHIVE_MAP_SECTION_VERSION = 'map-transfer-v1' as const
export const WIZARD_ARCHIVE_CANVAS_SECTION_VERSION = 'canvas-transfer-v1' as const
export const WIZARD_ARCHIVE_MANIFEST_PATH = '.wizardarchive/manifest.json' as const

export type WizardArchiveArtifact =
  | { readonly kind: 'directory'; readonly path: PortableRelativePath }
  | {
      readonly kind: 'file'
      readonly path: PortableRelativePath
      readonly mediaType: string
      readonly byteSize: number
      readonly digest: Sha256Digest
    }

export type WizardArchiveResource = Readonly<{
  id: ResourceId
  parentId: ResourceId | null
  kind: ResourceKind
  title: ResourceTitle
  icon: ResourceIcon | null
  color: ResourceColor | null
  lifecycle: 'active' | 'trashed'
  metadataVersion: VersionStamp
  contentVersion: VersionStamp | null
  artifact: WizardArchiveArtifact
}>

export type WizardArchiveNoteSection = Readonly<{
  resourceId: ResourceId
  blockIds: ReadonlyArray<NoteBlockId>
  destinations: ReadonlyArray<AuthoredDestination>
}>

export type WizardArchiveFileSection = FileOwnedMetadata &
  Readonly<{
    resourceId: ResourceId
    assetId: AssetId
    destinations: ReadonlyArray<AuthoredDestination>
  }>

export type WizardArchiveMapSection = Readonly<{
  resourceId: ResourceId
  pinIds: ReadonlyArray<MapPinId>
  destinations: ReadonlyArray<AuthoredDestination>
}>

export type WizardArchiveCanvasSection = Readonly<{
  resourceId: ResourceId
  nodeIds: ReadonlyArray<CanvasNodeId>
  destinations: ReadonlyArray<AuthoredDestination>
}>

export type WizardArchiveSection<TEntry, TVersion extends string> = Readonly<{
  version: TVersion
  entries: ReadonlyArray<TEntry>
}>

export type WizardArchiveManifest = Readonly<{
  version: typeof WIZARD_ARCHIVE_VERSION
  schemaVersion: typeof WIZARD_ARCHIVE_SCHEMA_VERSION
  scope: 'full_campaign'
  sourceCampaignId: CampaignId
  transferSnapshotId: SnapshotId
  portablePathVersion: typeof PORTABLE_PATH_VERSION
  resources: ReadonlyArray<WizardArchiveResource>
  tombstones: ReadonlyArray<ResourceTombstone>
  aliases: ReadonlyArray<SourcePathAlias>
  assetsFolderId: ResourceId | null
  sections: Readonly<{
    notes: WizardArchiveSection<
      WizardArchiveNoteSection,
      typeof WIZARD_ARCHIVE_NOTE_SECTION_VERSION
    >
    files: WizardArchiveSection<
      WizardArchiveFileSection,
      typeof WIZARD_ARCHIVE_FILE_SECTION_VERSION
    >
    maps: WizardArchiveSection<WizardArchiveMapSection, typeof WIZARD_ARCHIVE_MAP_SECTION_VERSION>
    canvases: WizardArchiveSection<
      WizardArchiveCanvasSection,
      typeof WIZARD_ARCHIVE_CANVAS_SECTION_VERSION
    >
  }>
}>

export type WizardArchiveMode = 'same_campaign_update' | 'new_campaign_clone'

export type SameCampaignPolicy = 'keep_destination' | 'use_package' | 'recover_as_new'
