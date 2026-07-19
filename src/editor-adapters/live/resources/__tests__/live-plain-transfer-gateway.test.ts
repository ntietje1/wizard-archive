import { describe, expect, it, vi } from 'vite-plus/test'
import type { Id } from 'convex/_generated/dataModel'
import type { FunctionArgs } from 'convex/server'
import type { api } from 'convex/_generated/api'
import {
  buildPlainTransferInventory,
  digestPlainTransferSources,
} from '@wizard-archive/editor/resources/plain-transfer-inventory'
import { TRANSFER_JOB_REQUEST_VERSION } from '@wizard-archive/editor/resources/transfer-job-contract'
import {
  decodeNoteYjsUpdatesToBlocks,
  NOTE_YJS_FRAGMENT,
} from '@wizard-archive/editor/notes/document-yjs'
import { testDomainId } from '../../../../../shared/test/domain-id'
import { createLivePlainTransferGateway } from '../live-plain-transfer-gateway'

describe('live plain transfer gateway', () => {
  it('retains uploaded sessions across an indeterminate response and refreshes one canonical replay', async () => {
    const campaignId = testDomainId('campaign', 'plain-transfer')
    const actorId = testDomainId('campaignMember', 'plain-transfer')
    const intent = {
      campaignId,
      jobId: testDomainId('importJob', 'plain-transfer'),
      operationId: testDomainId('operation', 'plain-transfer'),
      destinationParentId: null,
    }
    const sources = [{ id: 'selected-file', kind: 'file' as const, name: 'evidence.bin' }]
    const entries = [
      {
        sourceId: 'selected-file',
        path: 'evidence.bin',
        type: 'file' as const,
        bytes: Uint8Array.from([1, 2, 3]),
      },
    ]
    const inventory = await plannedInventory(actorId, intent, sources, entries)
    const resource = inventory.resources[0]!
    const sessionId = 'plain-transfer-session' as Id<'fileStorage'>
    const execute = vi
      .fn()
      .mockResolvedValueOnce({ status: 'indeterminate' as const, reason: 'response_lost' as const })
      .mockResolvedValueOnce({
        status: 'completed' as const,
        entries: [
          {
            status: 'completed' as const,
            sourceId: resource.alias.sourceRootId,
            sourcePath: resource.sourcePath,
            resourceId: resource.id,
            kind: resource.kind,
          },
        ],
      })
    const discard = vi.fn(() => Promise.resolve())
    const refresh = vi.fn(() => Promise.resolve())
    const upload = vi.fn(() => Promise.resolve(sessionId))
    const gateway = createLivePlainTransferGateway(campaignId, actorId, {
      cancel: vi.fn(() => Promise.resolve()),
      discard,
      execute,
      refresh,
      upload,
    })

    await expect(gateway.execute(intent, sources, entries)).resolves.toEqual({
      status: 'indeterminate',
      reason: 'response_lost',
    })
    expect(upload).toHaveBeenCalledOnce()
    expect(discard).not.toHaveBeenCalled()

    await expect(gateway.execute(intent, sources, entries)).resolves.toEqual({
      status: 'completed',
      entries: [
        {
          status: 'completed',
          sourceId: 'selected-file',
          sourcePath: 'evidence.bin',
          resourceId: resource.id,
          kind: 'file',
        },
      ],
    })
    expect(upload).toHaveBeenCalledOnce()
    expect(execute).toHaveBeenCalledTimes(2)
    expect(execute.mock.calls[1]?.[0].entries).toEqual(execute.mock.calls[0]?.[0].entries)
    expect(refresh).toHaveBeenCalledWith(resource.id, null)
    expect(discard).toHaveBeenCalledWith(sessionId)
  })

  it('persists cancellation with the immutable planned entry identity', async () => {
    const campaignId = testDomainId('campaign', 'cancel-transfer')
    const actorId = testDomainId('campaignMember', 'cancel-transfer')
    const intent = {
      campaignId,
      jobId: testDomainId('importJob', 'cancel-transfer'),
      operationId: testDomainId('operation', 'cancel-transfer'),
      destinationParentId: null,
    }
    const sources = [{ id: 'selected-file', kind: 'file' as const, name: 'cancel.bin' }]
    const entries = [
      {
        sourceId: 'selected-file',
        path: 'cancel.bin',
        type: 'file' as const,
        bytes: Uint8Array.from([4, 5, 6]),
      },
    ]
    const inventory = await plannedInventory(actorId, intent, sources, entries)
    const resource = inventory.resources[0]!
    let settle!: (result: { status: 'cancelled' }) => void
    const execute = vi.fn(
      () =>
        new Promise<{ status: 'cancelled' }>((resolve) => {
          settle = resolve
        }),
    )
    const cancel = vi.fn(() => Promise.resolve())
    const discard = vi.fn(() => Promise.resolve())
    const controller = new AbortController()
    const gateway = createLivePlainTransferGateway(campaignId, actorId, {
      cancel,
      discard,
      execute,
      refresh: vi.fn(() => Promise.resolve()),
      upload: vi.fn(() => Promise.resolve('cancel-session' as Id<'fileStorage'>)),
    })

    const transfer = gateway.execute(intent, sources, entries, { signal: controller.signal })
    await vi.waitFor(() => expect(execute).toHaveBeenCalledOnce())
    controller.abort()
    await vi.waitFor(() =>
      expect(cancel).toHaveBeenCalledWith({
        campaignId,
        jobId: intent.jobId,
        operationId: intent.operationId,
        destinationParentId: null,
        sourceDigest: expect.any(String),
        entries: [
          {
            sourceRootId: 'selected-file',
            rawPath: 'cancel.bin',
            normalizedPath: 'cancel.bin',
            plannedResourceId: resource.id,
            plannedOperationId: resource.operationId,
            resourceKind: 'file',
          },
        ],
      }),
    )
    settle({ status: 'cancelled' })

    await expect(transfer).resolves.toEqual({ status: 'cancelled' })
    expect(discard).toHaveBeenCalledWith('cancel-session')
  })

  it('converts imported Markdown through the native note schema before delivery', async () => {
    const campaignId = testDomainId('campaign', 'markdown-transfer')
    const actorId = testDomainId('campaignMember', 'markdown-transfer')
    const intent = {
      campaignId,
      jobId: testDomainId('importJob', 'markdown-transfer'),
      operationId: testDomainId('operation', 'markdown-transfer'),
      destinationParentId: null,
    }
    const sources = [{ id: 'directory', kind: 'directory' as const, name: 'Notes' }]
    const entries = [
      {
        sourceId: 'directory',
        path: 'Session.md',
        type: 'file' as const,
        bytes: new TextEncoder().encode('# Session\n\nArrival notes'),
      },
    ]
    const inventory = await plannedInventory(actorId, intent, sources, entries)
    const execute = vi.fn((_: FunctionArgs<typeof api.resources.actions.executePlainTransfer>) =>
      Promise.resolve({
        status: 'completed' as const,
        entries: inventory.resources.map((resource) => ({
          status: 'rejected' as const,
          sourceId: resource.alias.sourceRootId,
          sourcePath: resource.sourcePath,
          reason: 'fixture',
        })),
      }),
    )
    const gateway = createLivePlainTransferGateway(campaignId, actorId, {
      cancel: vi.fn(() => Promise.resolve()),
      discard: vi.fn(() => Promise.resolve()),
      execute,
      refresh: vi.fn(() => Promise.resolve()),
      upload: vi.fn(() => Promise.resolve('markdown-session' as Id<'fileStorage'>)),
    })

    await gateway.execute(intent, sources, entries)

    const delivered = execute.mock.calls[0]
    if (!delivered) throw new TypeError('Expected transfer delivery')
    const deliveredFile = delivered[0].entries.find((entry) => entry.type === 'file')
    if (!deliveredFile?.noteUpdate) throw new TypeError('Expected a native note update')
    expect(
      decodeNoteYjsUpdatesToBlocks([{ update: deliveredFile.noteUpdate }], NOTE_YJS_FRAGMENT),
    ).toMatchObject([
      { type: 'heading', content: [{ type: 'text', text: 'Session' }] },
      { type: 'paragraph', content: [{ type: 'text', text: 'Arrival notes' }] },
    ])
  })
})

async function plannedInventory(
  actorId: ReturnType<typeof testDomainId<'campaignMember'>>,
  intent: {
    campaignId: ReturnType<typeof testDomainId<'campaign'>>
    jobId: ReturnType<typeof testDomainId<'importJob'>>
    operationId: ReturnType<typeof testDomainId<'operation'>>
    destinationParentId: null
  },
  sources: Parameters<ReturnType<typeof createLivePlainTransferGateway>['execute']>[1],
  entries: Parameters<ReturnType<typeof createLivePlainTransferGateway>['execute']>[2],
) {
  const sourceDigest = await digestPlainTransferSources(sources, entries)
  const planned = await buildPlainTransferInventory({
    request: {
      version: TRANSFER_JOB_REQUEST_VERSION,
      jobId: intent.jobId,
      operationId: intent.operationId,
      actorId,
      destinationCampaignId: intent.campaignId,
      destinationParentId: intent.destinationParentId,
      manifestHandling: 'reject',
      mode: 'plain_resources',
      sourceDigest,
      sources,
    },
    entries,
  })
  if (planned.status !== 'ready') throw new TypeError('Expected a valid transfer inventory')
  return planned.inventory
}
