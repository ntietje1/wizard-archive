import type { Sha256Digest } from './component-version'
import type {
  CampaignId,
  CampaignMemberId,
  ImportJobId,
  OperationId,
  ResourceId,
} from './domain-id'

export const TRANSFER_JOB_REQUEST_VERSION = 'transfer-job-request-v1' as const

export type TransferSourceKind = 'directory' | 'file' | 'wizard_archive' | 'zip'

export type TransferSourceDescriptor = Readonly<{
  id: string
  kind: TransferSourceKind
  name: string
}>

type TransferJobRequestBase = Readonly<{
  version: typeof TRANSFER_JOB_REQUEST_VERSION
  jobId: ImportJobId
  operationId: OperationId
  actorId: CampaignMemberId
  destinationCampaignId: CampaignId
  sourceDigest: Sha256Digest
  sources: ReadonlyArray<TransferSourceDescriptor>
}>

export type PlainTransferJobRequest = TransferJobRequestBase &
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

export type PlainFileTransferIntent = Readonly<{
  campaignId: CampaignId
  jobId: ImportJobId
  operationId: OperationId
  destinationParentId: ResourceId | null
}>

export type WizardArchiveTransferJobRequest = TransferJobRequestBase &
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
