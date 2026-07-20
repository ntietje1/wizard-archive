import type { CampaignId, ImportJobId, ResourceId } from './domain-id'
import type { ResourceKind } from './resource-record'

export const PLAIN_TRANSFER_MANIFEST_VERSION = 'plain-transfer-manifest-v1' as const

export type PlainTransferSourceDescriptor = Readonly<{
  id: string
  kind: 'directory' | 'file' | 'zip'
  name: string
}>

export type PlainTransferTextFileHandling = 'files' | 'notes'

export type PlainTransferManifest = Readonly<{
  version: typeof PLAIN_TRANSFER_MANIFEST_VERSION
  jobId: ImportJobId
  destinationCampaignId: CampaignId
  destinationParentId: ResourceId | null
  textFileHandling: PlainTransferTextFileHandling
  sources: ReadonlyArray<PlainTransferSourceDescriptor>
  entries: ReadonlyArray<PlainTransferManifestEntry>
}>

export type PlainTransferIntent = Readonly<{
  campaignId: CampaignId
  jobId: ImportJobId
  destinationParentId: ResourceId | null
  textFileHandling: PlainTransferTextFileHandling
}>

export type PlainTransferInputEntry =
  | Readonly<{ sourceId: string; path: string; type: 'directory' }>
  | Readonly<{
      sourceId: string
      path: string
      type: 'file'
      bytes: Uint8Array
    }>

export type PlainTransferManifestEntry =
  | Readonly<{ sourceId: string; path: string; type: 'directory' }>
  | Readonly<{ sourceId: string; path: string; type: 'file'; byteSize: number }>

export type PlainTransferProgress = Readonly<{
  completedEntries: number
  totalEntries: number
  uploadedBytes: number
  totalBytes: number
  currentPath: string | null
}>

export type PlainTransferEntryOutcome =
  | Readonly<{
      status: 'pending'
      sourceId: string
      sourcePath: string
    }>
  | Readonly<{
      status: 'completed'
      sourceId: string
      sourcePath: string
      resourceId: ResourceId
      kind: Extract<ResourceKind, 'file' | 'folder' | 'note'>
    }>
  | Readonly<{
      status: 'rejected'
      sourceId: string
      sourcePath: string
      reason: string
    }>
  | Readonly<{
      status: 'cancelled'
      sourceId: string
      sourcePath: string
    }>

export type PlainTransferReceipt = Readonly<{
  jobId: ImportJobId
  status: 'reserved' | 'running' | 'settled'
  entries: Array<PlainTransferEntryOutcome>
}>

export type PlainTransferExecutionResult =
  | PlainTransferReceipt
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
