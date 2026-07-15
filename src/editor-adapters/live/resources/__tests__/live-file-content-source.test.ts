import { afterEach, describe, expect, it, vi } from 'vite-plus/test'
import type { FunctionReturnType } from 'convex/server'
import type { api } from 'convex/_generated/api'
import { testDomainId } from '../../../../../shared/test/domain-id'
import { createLiveFileContentSource } from '../live-file-content-source'

type Snapshot = FunctionReturnType<typeof api.resources.queries.loadContent>

const version = {
  scheme: 'authoritative-revision-v1' as const,
  revision: 1,
  digest: 'a'.repeat(64),
}

afterEach(() => vi.unstubAllGlobals())

describe('LiveFileContentSource', () => {
  it('downloads the authorized exact bytes and verifies their owned metadata', async () => {
    const resourceId = testDomainId('resource', 'download-file')
    const campaignId = testDomainId('campaign', 'download-campaign')
    const bytes = new TextEncoder().encode('exact file bytes')
    const snapshot: Snapshot = {
      status: 'ready',
      kind: 'file',
      content: {
        assetId: testDomainId('asset', 'download-asset'),
        classification: 'inert_file',
        byteSize: bytes.byteLength,
        detectedFormat: null,
        extension: 'txt',
        mediaType: 'text/plain',
        viewerUnavailableReason: 'unsupported_format',
      },
      version,
    }
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.resolve(new Response(bytes))),
    )
    const source = createLiveFileContentSource(
      campaignId,
      {
        load: () => Promise.resolve(snapshot),
        watch: vi.fn(() => () => undefined),
        create: vi.fn(),
        discard: vi.fn(),
        download: () => Promise.resolve({ status: 'ready', url: 'https://files.test/evidence' }),
        refresh: vi.fn(),
        upload: vi.fn(),
      },
      () => ({ abandon: vi.fn(), completed: vi.fn() }),
    )

    const result = await source.export(resourceId)
    expect(result).toMatchObject({
      status: 'ready',
      extension: 'txt',
      mediaType: 'text/plain',
    })
    expect(result.status === 'ready' ? Array.from(result.bytes) : null).toEqual(Array.from(bytes))
    source.dispose()
  })
})
