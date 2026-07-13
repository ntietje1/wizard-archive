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
      ordinal: number
      operationId: OperationId
      command: OptimisticResourceCommand
    }>
  | Readonly<{
      status: 'confirmed'
      ordinal: number
      operationId: OperationId
      command: OptimisticResourceCommand
      postconditions: ReadonlyArray<ResourcePostcondition>
    }>
