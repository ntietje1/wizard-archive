import type { AuthoredDestination } from './authored-destination-contract'
import type { Sha256Digest, VersionStamp } from './component-version'
import type {
  CampaignId,
  CanvasNodeId,
  MapPinId,
  NoteBlockId,
  ResourceId,
  SnapshotId,
} from './domain-id'
import type { PortableRelativePath } from './portable-path-contract'
import type { ResourceColor, ResourceIcon, ResourceKind, ResourceTitle } from './resource-contract'
import type { ApplicationResourceRole, SourcePathAlias } from './resource-catalog-contract'
import type { ResourceTombstone } from './resource-metadata-version'

export const WIZARD_ARCHIVE_VERSION = 'wizard-archive-v1' as const

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
  aliases: ReadonlyArray<SourcePathAlias>
}>

export type WizardArchiveNoteSection = Readonly<{
  resourceId: ResourceId
  blockIds: ReadonlyArray<NoteBlockId>
  destinations: ReadonlyArray<AuthoredDestination>
}>

export type WizardArchiveFileSection = Readonly<{
  resourceId: ResourceId
  extension: string | null
  mediaType: string
  originalName: string | null
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

export type WizardArchiveManifest = Readonly<{
  version: typeof WIZARD_ARCHIVE_VERSION
  sourceCampaignId: CampaignId
  transferSnapshotId: SnapshotId
  portablePathVersion: 'portable-path-v1'
  resources: ReadonlyArray<WizardArchiveResource>
  tombstones: ReadonlyArray<ResourceTombstone>
  roles: ReadonlyArray<ApplicationResourceRole>
  notes: ReadonlyArray<WizardArchiveNoteSection>
  files: ReadonlyArray<WizardArchiveFileSection>
  maps: ReadonlyArray<WizardArchiveMapSection>
  canvases: ReadonlyArray<WizardArchiveCanvasSection>
}>

export type WizardArchiveMode = 'same_campaign_update' | 'new_campaign_clone'

export type SameCampaignPolicy = 'keep_destination' | 'use_package' | 'recover_as_new'
