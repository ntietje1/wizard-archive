// @vitest-environment node

import { describe, expect, it, vi } from 'vite-plus/test'
import { DOMAIN_ID_KIND, generateDomainId } from '@wizard-archive/editor/resources/domain-id'
import type { Id } from 'convex/_generated/dataModel'
import { createLiveResourcePreviewPublicationGateway } from '../live-resource-preview-publication'

describe('createLiveResourcePreviewPublicationGateway', () => {
  it('does not generate or upload when the canonical preview is current', async () => {
    const resourceId = generateDomainId(DOMAIN_ID_KIND.resource)
    const generate = vi.fn()
    const operations = {
      claim: vi.fn().mockResolvedValue({ status: 'unavailable', reason: 'current' }),
      discard: vi.fn(),
      publish: vi.fn(),
      upload: vi.fn(),
    }
    const gateway = createLiveResourcePreviewPublicationGateway(operations)

    await expect(gateway.publish(resourceId, generate)).resolves.toEqual({ status: 'current' })
    expect(generate).not.toHaveBeenCalled()
    expect(operations.upload).not.toHaveBeenCalled()
    expect(operations.publish).not.toHaveBeenCalled()
  })

  it('publishes one claimed image upload with its exact byte size', async () => {
    const resourceId = generateDomainId(DOMAIN_ID_KIND.resource)
    const sessionId = 'preview-session' as Id<'fileStorage'>
    const preview = new Blob(['preview'], { type: 'image/webp' })
    const operations = {
      claim: vi.fn().mockResolvedValue({ status: 'claimed', claimToken: 'claim-token' }),
      discard: vi.fn(),
      publish: vi.fn().mockResolvedValue({ status: 'published' }),
      upload: vi.fn().mockResolvedValue(sessionId),
    }
    const gateway = createLiveResourcePreviewPublicationGateway(operations)

    await expect(gateway.publish(resourceId, () => Promise.resolve(preview))).resolves.toEqual({
      status: 'published',
    })
    expect(operations.upload).toHaveBeenCalledWith({
      bytes: new Uint8Array(await preview.arrayBuffer()),
      fileName: 'resource-preview.webp',
      mediaType: 'image/webp',
    })
    expect(operations.publish).toHaveBeenCalledWith({
      resourceId,
      claimToken: 'claim-token',
      uploadSessionId: sessionId,
      byteSize: preview.size,
    })
    expect(operations.discard).not.toHaveBeenCalled()
  })

  it('discards an uploaded derivative when its source version became stale', async () => {
    const resourceId = generateDomainId(DOMAIN_ID_KIND.resource)
    const sessionId = 'stale-preview-session' as Id<'fileStorage'>
    const operations = {
      claim: vi.fn().mockResolvedValue({ status: 'claimed', claimToken: 'claim-token' }),
      discard: vi.fn().mockResolvedValue(undefined),
      publish: vi.fn().mockResolvedValue({ status: 'stale' }),
      upload: vi.fn().mockResolvedValue(sessionId),
    }
    const gateway = createLiveResourcePreviewPublicationGateway(operations)

    await expect(
      gateway.publish(resourceId, () =>
        Promise.resolve(new Blob(['preview'], { type: 'image/webp' })),
      ),
    ).resolves.toEqual({ status: 'stale' })
    expect(operations.discard).toHaveBeenCalledWith(sessionId)
  })

  it('rejects invalid generated output before allocating an upload', async () => {
    const resourceId = generateDomainId(DOMAIN_ID_KIND.resource)
    const operations = {
      claim: vi.fn().mockResolvedValue({ status: 'claimed', claimToken: 'claim-token' }),
      discard: vi.fn(),
      publish: vi.fn(),
      upload: vi.fn(),
    }
    const gateway = createLiveResourcePreviewPublicationGateway(operations)

    await expect(
      gateway.publish(resourceId, () =>
        Promise.resolve(new Blob(['not an image'], { type: 'text/plain' })),
      ),
    ).resolves.toEqual({ status: 'rejected', reason: 'integrity_error' })
    expect(operations.upload).not.toHaveBeenCalled()
  })
})
