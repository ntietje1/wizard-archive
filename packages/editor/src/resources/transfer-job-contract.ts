import type { Sha256Digest } from './component-version'
import type {
  CampaignId,
  CampaignMemberId,
  ImportJobId,
  OperationId,
  ResourceId,
} from './domain-id'
import type { ResourceKind } from './resource-record'

export const TRANSFER_JOB_REQUEST_VERSION = 'transfer-job-request-v1' as const

export type TransferSourceKind = 'directory' | 'file' | 'wizard_archive' | 'zip'

export type TransferSourceDescriptor = Readonly<{
  id: string
  kind: TransferSourceKind
  name: string
}>

export type PlainTransferSourceDescriptor = Readonly<{
  id: string
  kind: Exclude<TransferSourceKind, 'wizard_archive'>
  name: string
}>

type TransferJobRequestBase<TSource extends TransferSourceDescriptor> = Readonly<{
  version: typeof TRANSFER_JOB_REQUEST_VERSION
  jobId: ImportJobId
  operationId: OperationId
  actorId: CampaignMemberId
  destinationCampaignId: CampaignId
  sourceDigest: Sha256Digest
  sources: ReadonlyArray<TSource>
}>

export type PlainTransferJobRequest = TransferJobRequestBase<PlainTransferSourceDescriptor> &
  (
    | Readonly<{
        mode: 'plain_workspace'
        destinationParentId: null
        manifestHandling: 'continue_plain' | 'reject'
      }>
    | Readonly<{
        mode: 'plain_resources'
        destinationParentId: ResourceId | null
        manifestHandling: 'continue_plain' | 'reject'
      }>
  )

export type PlainTransferIntent = Readonly<{
  campaignId: CampaignId
  jobId: ImportJobId
  operationId: OperationId
  destinationParentId: ResourceId | null
}>

export type PlainTransferInputEntry =
  | Readonly<{ sourceId: string; path: string; type: 'directory' }>
  | Readonly<{
      sourceId: string
      path: string
      type: 'file'
      bytes: Uint8Array
    }>

export type PlainTransferEntryIdentity = Readonly<{
  sourceRootId: string
  rawPath: string
  normalizedPath: string
  plannedResourceId: ResourceId
  plannedOperationId: OperationId
  resourceKind: Extract<ResourceKind, 'file' | 'folder' | 'note'>
}>

export type PlainTransferProgress = Readonly<{
  completedEntries: number
  totalEntries: number
  uploadedBytes: number
  totalBytes: number
  currentPath: string | null
}>

export type PlainTransferEntryOutcome =
  | Readonly<{
      status: 'completed'
      sourceId: string
      sourcePath: string
      resourceId: ResourceId
      kind: ResourceKind
    }>
  | Readonly<{
      status: 'rejected'
      sourceId: string
      sourcePath: string
      reason: string
    }>

export type PlainTransferExecutionResult =
  | Readonly<{
      status: 'completed'
      entries: ReadonlyArray<PlainTransferEntryOutcome>
    }>
  | Readonly<{ status: 'cancelled' }>
  | Readonly<{
      status: 'indeterminate'
      reason: 'response_lost' | 'transport_unavailable'
    }>
  | Readonly<{
      status: 'rejected'
      reason: string
    }>

export interface PlainTransferGateway {
  execute(
    intent: PlainTransferIntent,
    sources: ReadonlyArray<PlainTransferSourceDescriptor>,
    entries: ReadonlyArray<PlainTransferInputEntry>,
    options?: Readonly<{
      signal?: AbortSignal
      onProgress?: (progress: PlainTransferProgress) => void
    }>,
  ): Promise<PlainTransferExecutionResult>
}

export type WizardArchiveTransferJobRequest = TransferJobRequestBase<TransferSourceDescriptor> &
  (
    | Readonly<{
        mode: 'same_campaign_update'
        destinationParentId: null
      }>
    | Readonly<{
        mode: 'new_campaign_clone'
        destinationParentId: null
      }>
  )

export type TransferJobRequest = PlainTransferJobRequest | WizardArchiveTransferJobRequest
