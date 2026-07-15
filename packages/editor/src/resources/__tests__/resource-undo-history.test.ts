import { describe, expect, it } from 'vite-plus/test'
import { DOMAIN_ID_KIND, generateDomainId } from '../domain-id'
import { createResourceUndoHistory } from '../resource-undo-history'
import type { ResourceCompensationEnvelope } from '../resource-command-contract'
import { canonicalizeResourceTitle } from '../resource-record'

describe('resource undo history', () => {
  it('stores only operation identity and requests server-issued compensation', async () => {
    const campaignId = generateDomainId(DOMAIN_ID_KIND.campaign)
    const resourceId = generateDomainId(DOMAIN_ID_KIND.resource)
    const operationId = generateDomainId(DOMAIN_ID_KIND.operation)
    let attempts = 0
    const structure = {
      execute: () => {
        attempts += 1
        if (attempts === 1) {
          return Promise.resolve({
            status: 'indeterminate' as const,
            retryable: true as const,
            reason: 'response_lost' as const,
          })
        }
        return Promise.resolve({
          status: 'received' as const,
          result: {
            status: 'completed' as const,
            receipt: {
              campaignId,
              operationId,
              result: { type: 'metadataUpdated' as const, resourceId },
              postconditions: [],
            },
          },
        })
      },
    }
    const requests: Array<ResourceCompensationEnvelope> = []
    const compensation = {
      compensate: (envelope: ResourceCompensationEnvelope) => {
        requests.push(envelope)
        return Promise.resolve({
          status: 'received' as const,
          result: {
            status: 'completed' as const,
            receipt: {
              campaignId,
              operationId: envelope.operationId,
              result: { type: 'metadataUpdated' as const, resourceId },
              postconditions: [],
            },
          },
        })
      },
    }
    const undo = createResourceUndoHistory(campaignId, structure, compensation)
    const envelope = {
      campaignId,
      operationId,
      command: {
        type: 'updateMetadata' as const,
        resourceId,
        changes: { title: canonicalizeResourceTitle('Renamed') },
      },
    }

    await undo.structure.execute(envelope)
    await undo.structure.execute(envelope)
    await undo.history.undo()

    expect(requests).toHaveLength(1)
    expect(requests[0]).toEqual({
      campaignId,
      operationId: expect.any(String),
      originalOperationId: operationId,
    })
    expect(Object.keys(requests[0]!)).toEqual(['campaignId', 'operationId', 'originalOperationId'])
  })

  it('retries an indeterminate compensation with the same operation identity', async () => {
    const campaignId = generateDomainId(DOMAIN_ID_KIND.campaign)
    const resourceId = generateDomainId(DOMAIN_ID_KIND.resource)
    const originalOperationId = generateDomainId(DOMAIN_ID_KIND.operation)
    const requests: Array<ResourceCompensationEnvelope> = []
    const undo = createResourceUndoHistory(
      campaignId,
      {
        execute: () =>
          Promise.resolve({
            status: 'received' as const,
            result: {
              status: 'completed' as const,
              receipt: {
                campaignId,
                operationId: originalOperationId,
                result: { type: 'metadataUpdated' as const, resourceId },
                postconditions: [],
              },
            },
          }),
      },
      {
        compensate: (request) => {
          requests.push(request)
          if (requests.length === 1) {
            return Promise.resolve({
              status: 'indeterminate' as const,
              retryable: true as const,
              reason: 'response_lost' as const,
            })
          }
          return Promise.resolve({
            status: 'received' as const,
            result: {
              status: 'completed' as const,
              receipt: {
                campaignId,
                operationId: request.operationId,
                result: { type: 'metadataUpdated' as const, resourceId },
                postconditions: [],
              },
            },
          })
        },
      },
    )

    await undo.structure.execute({
      campaignId,
      operationId: originalOperationId,
      command: {
        type: 'updateMetadata',
        resourceId,
        changes: { title: canonicalizeResourceTitle('Renamed') },
      },
    })
    await undo.history.undo()
    await undo.history.undo()

    expect(requests).toHaveLength(2)
    expect(requests[1]).toEqual(requests[0])
    expect(undo.history.getSnapshot()).toEqual({
      status: 'ready',
      undo: null,
      redo: { label: 'Edit resource' },
    })
  })
})
