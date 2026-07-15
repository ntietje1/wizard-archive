import { describe, expect, it, vi } from 'vite-plus/test'
import { testDomainId } from '../../../../../shared/test/domain-id'
import { canonicalizeResourceTitle } from '@wizard-archive/editor/resources/resource-record'
import { assertVersionStamp } from '@wizard-archive/editor/resources/component-version'
import {
  createLiveResourceCompensationGateway,
  createLiveResourceStructureGateway,
} from '../live-resource-structure-gateway'

const campaignId = testDomainId('campaign', 'live-gateway')
const operationId = testDomainId('operation', 'live-gateway')
const resourceId = testDomainId('resource', 'live-gateway')
const command = {
  type: 'create' as const,
  resourceId,
  kind: 'note' as const,
  parentId: null,
  title: canonicalizeResourceTitle('Session Notes'),
  icon: null,
  color: null,
}

describe('createLiveResourceStructureGateway', () => {
  it('delivers canonical commands and validates completed receipts', async () => {
    const execute = vi.fn(() =>
      Promise.resolve({
        status: 'completed' as const,
        receipt: {
          campaignId,
          operationId,
          result: { type: 'created' as const, resourceId },
          postconditions: [
            {
              state: 'present' as const,
              resourceId,
              metadataVersion: {
                scheme: 'authoritative-revision-v1' as const,
                revision: 1,
                digest: '0'.repeat(64),
              },
            },
          ],
        },
      }),
    )
    const gateway = createLiveResourceStructureGateway(campaignId, execute)

    await expect(gateway.execute({ campaignId, operationId, command })).resolves.toMatchObject({
      status: 'received',
      result: {
        status: 'completed',
        receipt: { campaignId, operationId, result: { type: 'created', resourceId } },
      },
    })
    expect(execute).toHaveBeenCalledWith({ campaignId, operationId, command })
  })

  it('rejects invalid input before invoking Convex', async () => {
    const execute = vi.fn()
    const gateway = createLiveResourceStructureGateway(campaignId, execute)

    await expect(
      gateway.execute({
        campaignId,
        operationId,
        command: { ...command, resourceId: 'invalid' as typeof resourceId },
      }),
    ).resolves.toEqual({
      status: 'received',
      result: { status: 'rejected', reason: 'invalid_uuid' },
    })
    expect(execute).not.toHaveBeenCalled()
  })

  it('does not send an envelope for another campaign scope', async () => {
    const execute = vi.fn()
    const gateway = createLiveResourceStructureGateway(campaignId, execute)

    await expect(
      gateway.execute({
        campaignId: testDomainId('campaign', 'other'),
        operationId,
        command,
      }),
    ).resolves.toEqual({
      status: 'received',
      result: { status: 'unavailable', reason: 'scope_unavailable' },
    })
    expect(execute).not.toHaveBeenCalled()
  })

  it('keeps delivery indeterminate when the mutation response is lost', async () => {
    const gateway = createLiveResourceStructureGateway(
      campaignId,
      vi.fn(() => Promise.reject(new Error('connection lost'))),
    )

    await expect(gateway.execute({ campaignId, operationId, command })).resolves.toEqual({
      status: 'indeterminate',
      retryable: true,
      reason: 'response_lost',
    })
  })
})

describe('createLiveResourceCompensationGateway', () => {
  it('sends exact expected postconditions and preserves stale rejection', async () => {
    const expectedPostconditions = [
      {
        state: 'present' as const,
        resourceId,
        metadataVersion: assertVersionStamp({
          scheme: 'authoritative-revision-v1' as const,
          revision: 1,
          digest: '0'.repeat(64),
        }),
      },
    ]
    const execute = vi.fn(() =>
      Promise.resolve({ status: 'rejected' as const, reason: 'stale_history' as const }),
    )
    const gateway = createLiveResourceCompensationGateway(campaignId, execute)

    await expect(
      gateway.executeCompensation({
        campaignId,
        operationId,
        command: { type: 'trash', resourceIds: [resourceId] },
        expectedPostconditions,
      }),
    ).resolves.toEqual({
      status: 'received',
      result: { status: 'rejected', reason: 'stale_history' },
    })
    expect(execute).toHaveBeenCalledWith({
      campaignId,
      operationId,
      command: { type: 'trash', resourceIds: [resourceId] },
      expectedPostconditions,
    })
  })
})
