import type { VersionStamp } from './component-version'
import type { CampaignId, CampaignMemberId, OperationId, ResourceId } from './domain-id'
import type { ResourceColor, ResourceIcon, ResourceKind, ResourceTitle } from './resource-contract'

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

export type CommandEnvelope<TCommand> = Readonly<{
  campaignId: CampaignId
  operationId: OperationId
  command: TCommand
}>

export type CapabilityUnavailableReason = 'capability_not_supported' | 'scope_unavailable'

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

export interface ResourceStructureCommandGateway {
  execute(
    envelope: CommandEnvelope<ResourceStructureCommand>,
  ): Promise<CommandDelivery<ResourceStructureCommandResult>>
}

export interface AuthoritativeResourceOperationExecutor {
  execute(
    actorId: CampaignMemberId,
    envelope: CommandEnvelope<ResourceStructureCommand>,
  ): Promise<ResourceStructureCommandResult>
}

export type StoredResourceOperation = Readonly<{
  campaignId: CampaignId
  actorId: CampaignMemberId
  operationId: OperationId
  protocolVersion: 'resource-command-v1'
  fingerprint: VersionStamp['digest']
  receipt: ResourceCommandReceipt<unknown>
}>
