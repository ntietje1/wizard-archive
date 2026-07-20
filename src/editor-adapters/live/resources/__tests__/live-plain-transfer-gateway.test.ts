import { describe, expect, it, vi } from 'vite-plus/test'
import type { Id } from 'convex/_generated/dataModel'
import { DOMAIN_ID_KIND, generateDomainId } from '@wizard-archive/editor/resources/domain-id'
import type { CampaignId, ResourceId } from '@wizard-archive/editor/resources/domain-id'
import type {
  PlainTransferIntent,
  PlainTransferReceipt,
} from '@wizard-archive/editor/resources/transfer-job-contract'
import { createLivePlainTransferGateway } from '../live-plain-transfer-gateway'

const encoder = new TextEncoder()

describe('live plain transfer gateway', () => {
  it('reserves the bounded manifest before uploading and commits only the server-owned job', async () => {
    const campaignId = generateDomainId(DOMAIN_ID_KIND.campaign)
    const intent = transferIntent(campaignId)
    const resourceId = generateDomainId(DOMAIN_ID_KIND.resource)
    const events: Array<string> = []
    const reserve = vi.fn(() => {
      events.push('reserve')
      return Promise.resolve({
        status: 'reserved' as const,
        receipt: pendingReceipt(intent),
        uploadTargets: [
          {
            sourceId: 'upload',
            sourcePath: 'Session.md',
            sessionId: 'session' as Id<'fileStorage'>,
            uploadUrl: 'https://upload.test',
          },
        ],
      })
    })
    const bind = vi.fn(() => {
      events.push('bind')
      return Promise.resolve()
    })
    const commit = vi.fn(() => {
      events.push('commit')
      return Promise.resolve(settledReceipt(intent, resourceId))
    })
    const refresh = vi.fn(() => Promise.resolve())
    const gateway = createLivePlainTransferGateway(campaignId, {
      reserve,
      bind,
      commit,
      cancel: vi.fn(),
      load: vi.fn(),
      refresh,
    })

    const result = await gateway.execute(
      intent,
      [{ id: 'upload', kind: 'file', name: 'Session.md' }],
      [
        {
          sourceId: 'upload',
          path: 'Session.md',
          type: 'file',
          bytes: encoder.encode('# Session'),
        },
      ],
    )

    expect(events).toEqual(['reserve', 'bind', 'commit'])
    expect(reserve).toHaveBeenCalledWith({
      campaignId,
      jobId: intent.jobId,
      destinationParentId: null,
      textFileHandling: 'notes',
      sources: [{ id: 'upload', kind: 'file', name: 'Session.md' }],
      entries: [{ sourceId: 'upload', path: 'Session.md', type: 'file', byteSize: 9 }],
    })
    expect(commit).toHaveBeenCalledWith({ campaignId, jobId: intent.jobId })
    expect(result).toEqual(settledReceipt(intent, resourceId))
    expect(refresh).toHaveBeenCalledWith(resourceId, null)
  })

  it('does not upload again when an exact reservation replay has no pending targets', async () => {
    const campaignId = generateDomainId(DOMAIN_ID_KIND.campaign)
    const intent = transferIntent(campaignId)
    const resourceId = generateDomainId(DOMAIN_ID_KIND.resource)
    const receipt = settledReceipt(intent, resourceId)
    const bind = vi.fn()
    const gateway = createLivePlainTransferGateway(campaignId, {
      reserve: vi.fn(() =>
        Promise.resolve({
          status: 'reserved' as const,
          receipt,
          uploadTargets: [],
        }),
      ),
      bind,
      commit: vi.fn(() => Promise.resolve(receipt)),
      cancel: vi.fn(),
      load: vi.fn(),
      refresh: vi.fn(),
    })

    await gateway.execute(
      intent,
      [{ id: 'upload', kind: 'file', name: 'Session.md' }],
      [
        {
          sourceId: 'upload',
          path: 'Session.md',
          type: 'file',
          bytes: encoder.encode('# Session'),
        },
      ],
    )

    expect(bind).not.toHaveBeenCalled()
  })

  it('cancels by job identity alone and returns the truthful settled receipt', async () => {
    const campaignId = generateDomainId(DOMAIN_ID_KIND.campaign)
    const intent = transferIntent(campaignId)
    const controller = new AbortController()
    controller.abort()
    const cancelled: PlainTransferReceipt = {
      jobId: intent.jobId,
      status: 'settled',
      entries: [
        {
          status: 'cancelled',
          sourceId: 'upload',
          sourcePath: 'Session.md',
        },
      ],
    }
    const cancel = vi.fn(() => Promise.resolve(cancelled))
    const bind = vi.fn()
    const commit = vi.fn()
    const gateway = createLivePlainTransferGateway(campaignId, {
      reserve: vi.fn(() =>
        Promise.resolve({
          status: 'reserved' as const,
          receipt: pendingReceipt(intent),
          uploadTargets: [],
        }),
      ),
      bind,
      commit,
      cancel,
      load: vi.fn(),
      refresh: vi.fn(),
    })

    const result = await gateway.execute(
      intent,
      [{ id: 'upload', kind: 'file', name: 'Session.md' }],
      [
        {
          sourceId: 'upload',
          path: 'Session.md',
          type: 'file',
          bytes: encoder.encode('# Session'),
        },
      ],
      { signal: controller.signal },
    )

    expect(cancel).toHaveBeenCalledWith({ campaignId, jobId: intent.jobId })
    expect(bind).not.toHaveBeenCalled()
    expect(commit).not.toHaveBeenCalled()
    expect(result).toEqual(cancelled)
  })

  it('recovers a lost commit response from the authoritative job receipt', async () => {
    const campaignId = generateDomainId(DOMAIN_ID_KIND.campaign)
    const intent = transferIntent(campaignId)
    const receipt = settledReceipt(intent, generateDomainId(DOMAIN_ID_KIND.resource))
    const load = vi.fn(() => Promise.resolve(receipt))
    const gateway = createLivePlainTransferGateway(campaignId, {
      reserve: vi.fn(() =>
        Promise.resolve({
          status: 'reserved' as const,
          receipt: pendingReceipt(intent),
          uploadTargets: [],
        }),
      ),
      bind: vi.fn(),
      commit: vi.fn(() =>
        Promise.resolve({
          status: 'indeterminate' as const,
          reason: 'response_lost' as const,
        }),
      ),
      cancel: vi.fn(),
      load,
      refresh: vi.fn(),
    })

    await expect(
      gateway.execute(
        intent,
        [{ id: 'directory', kind: 'directory', name: 'Campaign' }],
        [{ sourceId: 'directory', path: 'Notes', type: 'directory' }],
      ),
    ).resolves.toEqual(receipt)
    expect(load).toHaveBeenCalledWith({ campaignId, jobId: intent.jobId })
  })
})

function transferIntent(campaignId: CampaignId): PlainTransferIntent {
  return {
    campaignId,
    jobId: generateDomainId(DOMAIN_ID_KIND.importJob),
    destinationParentId: null,
    textFileHandling: 'notes',
  }
}

function pendingReceipt(intent: PlainTransferIntent): PlainTransferReceipt {
  return {
    jobId: intent.jobId,
    status: 'reserved',
    entries: [{ status: 'pending', sourceId: 'upload', sourcePath: 'Session.md' }],
  }
}

function settledReceipt(intent: PlainTransferIntent, resourceId: ResourceId): PlainTransferReceipt {
  return {
    jobId: intent.jobId,
    status: 'settled',
    entries: [
      {
        status: 'completed',
        sourceId: 'upload',
        sourcePath: 'Session.md',
        resourceId,
        kind: 'note',
      },
    ],
  }
}
