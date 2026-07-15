import { describe, expect, it } from 'vite-plus/test'
import { assertSha256Digest, initialVersion } from '../component-version'
import { DOMAIN_ID_KIND, assertDomainId } from '../domain-id'
import { InMemoryResourceOperationLedger } from '../resource-operation-ledger'

const campaignId = assertDomainId(DOMAIN_ID_KIND.campaign, '01890f47-f6c8-7a5b-8c9d-0123456789b1')
const actorId = assertDomainId(
  DOMAIN_ID_KIND.campaignMember,
  '01890f47-f6c8-7a5b-8c9d-0123456789b2',
)
const otherActorId = assertDomainId(
  DOMAIN_ID_KIND.campaignMember,
  '01890f47-f6c8-7a5b-8c9d-0123456789b3',
)
const operationId = assertDomainId(DOMAIN_ID_KIND.operation, '01890f47-f6c8-7a5b-8c9d-0123456789b4')
const resourceId = assertDomainId(DOMAIN_ID_KIND.resource, '01890f47-f6c8-7a5b-8c9d-0123456789b5')
const fingerprint = assertSha256Digest('a'.repeat(64))
const receipt = {
  campaignId,
  operationId,
  result: { type: 'created', resourceId } as const,
  postconditions: [
    { state: 'present', resourceId, metadataVersion: initialVersion(fingerprint) } as const,
  ],
}

describe('actor-bound resource operation ledger', () => {
  it('replays only the same actor and fingerprint', () => {
    const ledger = new InMemoryResourceOperationLedger()

    expect(ledger.lookup(campaignId, actorId, operationId, fingerprint)).toEqual({
      status: 'new',
    })
    ledger.record({
      campaignId,
      actorId,
      operationId,
      protocolVersion: 'resource-command-v1',
      fingerprint,
      receipt,
      compensation: null,
    })

    expect(ledger.lookup(campaignId, actorId, operationId, fingerprint)).toEqual({
      status: 'replay',
      receipt,
    })
    expect(
      ledger.lookup(campaignId, actorId, operationId, assertSha256Digest('b'.repeat(64))),
    ).toEqual({ status: 'rejected', reason: 'operation_id_reused' })
    expect(ledger.lookup(campaignId, otherActorId, operationId, fingerprint)).toEqual({
      status: 'rejected',
      reason: 'operation_id_reused',
    })
  })

  it('retains a single record for the campaign lifetime', () => {
    const ledger = new InMemoryResourceOperationLedger()
    const operation = {
      campaignId,
      actorId,
      operationId,
      protocolVersion: 'resource-command-v1',
      fingerprint,
      receipt,
      compensation: null,
    } as const

    ledger.record(operation)
    expect(() => ledger.record(operation)).toThrow('operation_id_reused')
  })
})
