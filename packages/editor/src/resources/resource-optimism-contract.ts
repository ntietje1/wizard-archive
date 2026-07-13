import type { OperationId } from './domain-id'
import type {
  CreateResourceCommand,
  MoveResourcesCommand,
  ResourcePostcondition,
  RestoreResourcesCommand,
  TrashResourcesCommand,
  UpdateResourceMetadataCommand,
} from './resource-command-contract'

export type OptimisticResourceCommand =
  | CreateResourceCommand
  | UpdateResourceMetadataCommand
  | MoveResourcesCommand
  | TrashResourcesCommand
  | RestoreResourcesCommand

export type ResourceOptimisticOverlay =
  | Readonly<{
      status: 'pending'
      operationId: OperationId
      command: OptimisticResourceCommand
    }>
  | Readonly<{
      status: 'confirmed'
      operationId: OperationId
      command: OptimisticResourceCommand
      postconditions: ReadonlyArray<ResourcePostcondition>
    }>
