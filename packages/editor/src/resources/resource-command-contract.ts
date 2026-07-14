import type { VersionStamp } from './component-version'
import type {
  CampaignId,
  CampaignMemberId,
  NoteBlockId,
  OperationId,
  ResourceId,
} from './domain-id'
import type { ResourceColor, ResourceIcon, ResourceKind, ResourceTitle } from './resource-record'

export type CreateResourceCommand = Readonly<{
  type: 'create'
  resourceId: ResourceId
  kind: ResourceKind
  parentId: ResourceId | null
  title: ResourceTitle
  icon: ResourceIcon | null
  color: ResourceColor | null
}>

export type UpdateResourceMetadataCommand = Readonly<{
  type: 'updateMetadata'
  resourceId: ResourceId
  changes: Readonly<{
    title?: ResourceTitle
    icon?: ResourceIcon | null
    color?: ResourceColor | null
  }>
}>

export type MoveResourcesCommand = Readonly<{
  type: 'move'
  resourceIds: ReadonlyArray<ResourceId>
  destinationParentId: ResourceId | null
}>

export type TrashResourcesCommand = Readonly<{
  type: 'trash'
  resourceIds: ReadonlyArray<ResourceId>
}>

export type RestoreResourcesCommand = Readonly<{
  type: 'restore'
  resourceIds: ReadonlyArray<ResourceId>
}>

export type PermanentlyDeleteResourcesCommand = Readonly<{
  type: 'permanentlyDelete'
  resourceIds: ReadonlyArray<ResourceId>
}>

export type DeepCopyResourcesCommand = Readonly<{
  type: 'deepCopy'
  sourceRootIds: ReadonlyArray<ResourceId>
  destinationParentId: ResourceId | null
}>

export type ResourceStructureCommand =
  | CreateResourceCommand
  | UpdateResourceMetadataCommand
  | MoveResourcesCommand
  | TrashResourcesCommand
  | RestoreResourcesCommand
  | PermanentlyDeleteResourcesCommand
  | DeepCopyResourcesCommand

export type ResourcePermission = 'none' | 'view' | 'edit'

export type ResourceAccessCommand =
  | Readonly<{
      type: 'setAudienceAccess'
      resourceIds: ReadonlyArray<ResourceId>
      permission: ResourcePermission
    }>
  | Readonly<{
      type: 'setMemberAccess'
      resourceIds: ReadonlyArray<ResourceId>
      memberId: CampaignMemberId
      permission: ResourcePermission
    }>
  | Readonly<{
      type: 'clearMemberAccess'
      resourceIds: ReadonlyArray<ResourceId>
      memberId: CampaignMemberId
    }>
  | Readonly<{
      type: 'setFolderAccessInheritance'
      folderId: ResourceId
      inherited: boolean
    }>

export type ResourceBookmarkCommand = Readonly<{
  type: 'setBookmarkState'
  resourceIds: ReadonlyArray<ResourceId>
  bookmarked: boolean
}>

export type NoteBlockAccessCommand =
  | Readonly<{
      type: 'setNoteBlockAudienceAccess'
      noteId: ResourceId
      blockIds: ReadonlyArray<NoteBlockId>
      shared: boolean
    }>
  | Readonly<{
      type: 'setNoteBlockMemberAccess'
      noteId: ResourceId
      blockIds: ReadonlyArray<NoteBlockId>
      memberId: CampaignMemberId
      permission: Extract<ResourcePermission, 'none' | 'view'>
    }>
  | Readonly<{
      type: 'clearNoteBlockMemberAccess'
      noteId: ResourceId
      blockIds: ReadonlyArray<NoteBlockId>
      memberId: CampaignMemberId
    }>

export type CommandEnvelope<TCommand> = Readonly<{
  campaignId: CampaignId
  operationId: OperationId
  command: TCommand
}>

export type CapabilityUnavailableReason =
  | 'capability_not_supported'
  | 'dependency_unavailable'
  | 'scope_unavailable'

export type ResourceStructureRejection =
  | 'invalid_command'
  | 'invalid_uuid'
  | 'invalid_title'
  | 'ownership_mismatch'
  | 'unauthorized'
  | 'resource_missing'
  | 'invalid_parent'
  | 'invalid_parent_kind'
  | 'hierarchy_cycle'
  | 'invalid_lifecycle'
  | 'invalid_root_selection'
  | 'closure_too_large'
  | 'content_unavailable'
  | 'content_integrity_failure'
  | 'version_exhausted'
  | 'operation_id_reused'

export type ResourcePostcondition =
  | {
      readonly state: 'present'
      readonly resourceId: ResourceId
      readonly metadataVersion: VersionStamp
    }
  | { readonly state: 'missing'; readonly resourceId: ResourceId }

export type DeepCopyRoot = Readonly<{
  sourceRootId: ResourceId
  destinationRootId: ResourceId
}>

export type ResourceStructureResult =
  | { readonly type: 'created'; readonly resourceId: ResourceId }
  | { readonly type: 'metadataUpdated'; readonly resourceId: ResourceId }
  | { readonly type: 'moved'; readonly resourceIds: ReadonlyArray<ResourceId> }
  | { readonly type: 'trashed'; readonly resourceIds: ReadonlyArray<ResourceId> }
  | { readonly type: 'restored'; readonly resourceIds: ReadonlyArray<ResourceId> }
  | { readonly type: 'permanentlyDeleted'; readonly resourceIds: ReadonlyArray<ResourceId> }
  | { readonly type: 'deepCopied'; readonly roots: ReadonlyArray<DeepCopyRoot> }

export type ResourceCommandReceipt<TResult = ResourceStructureResult> = Readonly<{
  campaignId: CampaignId
  operationId: OperationId
  result: TResult
  postconditions: ReadonlyArray<ResourcePostcondition>
}>

export type CommandResult<TReceipt, TRejection> =
  | { readonly status: 'completed'; readonly receipt: TReceipt }
  | { readonly status: 'rejected'; readonly reason: TRejection }
  | { readonly status: 'unavailable'; readonly reason: CapabilityUnavailableReason }

export type CommandDelivery<TDomainResult> =
  | { readonly status: 'received'; readonly result: TDomainResult }
  | {
      readonly status: 'indeterminate'
      readonly retryable: true
      readonly reason: 'timeout' | 'connection_lost' | 'response_lost'
    }
  | {
      readonly status: 'not_committed'
      readonly retryable: boolean
      readonly reason: 'invalid_response' | 'transport_unavailable' | 'request_rejected'
    }

export type ResourceStructureCommandResult = CommandResult<
  ResourceCommandReceipt,
  ResourceStructureRejection
>

export type ResourceAccessReceipt = Readonly<{
  campaignId: CampaignId
  operationId: OperationId
  resourceIds: ReadonlyArray<ResourceId>
}>

export type ResourceBookmarkReceipt = Readonly<{
  campaignId: CampaignId
  operationId: OperationId
  resourceIds: ReadonlyArray<ResourceId>
  bookmarked: boolean
}>

export type NoteBlockAccessReceipt = Readonly<{
  campaignId: CampaignId
  operationId: OperationId
  noteId: ResourceId
  blockIds: ReadonlyArray<NoteBlockId>
}>

export type ResourceAccessRejection =
  | 'invalid_command'
  | 'ownership_mismatch'
  | 'unauthorized'
  | 'resource_missing'
  | 'invalid_resource_kind'
  | 'invalid_permission'
  | 'operation_id_reused'

export type ResourceBookmarkRejection =
  | 'invalid_command'
  | 'ownership_mismatch'
  | 'unauthorized'
  | 'resource_missing'
  | 'operation_id_reused'

export type NoteBlockAccessRejection =
  | 'invalid_command'
  | 'ownership_mismatch'
  | 'unauthorized'
  | 'note_missing'
  | 'block_missing'
  | 'invalid_permission'
  | 'operation_id_reused'

export type ResourceAccessCommandResult = CommandResult<
  ResourceAccessReceipt,
  ResourceAccessRejection
>

export type ResourceBookmarkCommandResult = CommandResult<
  ResourceBookmarkReceipt,
  ResourceBookmarkRejection
>

export type NoteBlockAccessCommandResult = CommandResult<
  NoteBlockAccessReceipt,
  NoteBlockAccessRejection
>

export interface ResourceStructureCommandGateway {
  execute(
    envelope: CommandEnvelope<ResourceStructureCommand>,
  ): Promise<CommandDelivery<ResourceStructureCommandResult>>
}

export interface ResourceAccessCommandGateway {
  execute(
    envelope: CommandEnvelope<ResourceAccessCommand>,
  ): Promise<CommandDelivery<ResourceAccessCommandResult>>
}

export interface ResourceBookmarkCommandGateway {
  execute(
    envelope: CommandEnvelope<ResourceBookmarkCommand>,
  ): Promise<CommandDelivery<ResourceBookmarkCommandResult>>
}

export interface NoteBlockAccessCommandGateway {
  execute(
    envelope: CommandEnvelope<NoteBlockAccessCommand>,
  ): Promise<CommandDelivery<NoteBlockAccessCommandResult>>
}

export interface AuthoritativeResourceOperationExecutor {
  execute(
    actorId: CampaignMemberId,
    envelope: CommandEnvelope<ResourceStructureCommand>,
  ): Promise<ResourceStructureCommandResult>
}

export type StoredResourceOperation<TReceipt = unknown> = Readonly<{
  campaignId: CampaignId
  actorId: CampaignMemberId
  operationId: OperationId
  protocolVersion: 'resource-command-v1'
  fingerprint: VersionStamp['digest']
  receipt: TReceipt
}>
