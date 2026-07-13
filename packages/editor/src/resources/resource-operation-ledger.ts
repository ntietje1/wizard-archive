import type { Sha256Digest } from './component-version'
import type { CampaignId, CampaignMemberId, OperationId } from './domain-id'
import type { StoredResourceOperation } from './resource-command-contract'

export type ResourceOperationLookup<TReceipt> =
  | { readonly status: 'new' }
  | { readonly status: 'replay'; readonly receipt: TReceipt }
  | { readonly status: 'rejected'; readonly reason: 'operation_id_reused' }

export class InMemoryResourceOperationLedger<TReceipt = unknown> {
  readonly #operations = new Map<string, StoredResourceOperation<TReceipt>>()

  lookup(
    campaignId: CampaignId,
    actorId: CampaignMemberId,
    operationId: OperationId,
    fingerprint: Sha256Digest,
  ): ResourceOperationLookup<TReceipt> {
    const stored = this.#operations.get(this.#key(campaignId, operationId))
    if (!stored) return { status: 'new' }
    if (stored.actorId !== actorId || stored.fingerprint !== fingerprint) {
      return { status: 'rejected', reason: 'operation_id_reused' }
    }
    return { status: 'replay', receipt: stored.receipt }
  }

  record(operation: StoredResourceOperation<TReceipt>): void {
    const key = this.#key(operation.campaignId, operation.operationId)
    if (this.#operations.has(key)) throw new TypeError('operation_id_reused')
    this.#operations.set(key, operation)
  }

  #key(campaignId: CampaignId, operationId: OperationId): string {
    return `${campaignId}:${operationId}`
  }
}
