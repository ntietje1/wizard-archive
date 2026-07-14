import { describe, expect, it, vi } from 'vite-plus/test'
import { testCampaignId } from '../../../../../shared/test/campaign-id'
import { testOperationId } from '../../../../../shared/test/operation-id'
import { testResourceId } from '../../../../../shared/test/resource-id'
import { canonicalizeResourceTitle } from '@wizard-archive/editor/resources/resource-record'
import { createLiveResourceStructureGateway } from '../live-resource-structure-gateway'

const campaignId = testCampaignId('live-gateway')
const operationId = testOperationId('live-gateway')
const resourceId = testResourceId('live-gateway')
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
      gateway.execute({ campaignId: testCampaignId('other'), operationId, command }),
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
