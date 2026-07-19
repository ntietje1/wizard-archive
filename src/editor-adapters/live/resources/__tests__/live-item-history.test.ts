import { afterEach, describe, expect, it, vi } from 'vite-plus/test'
import { initialVersion, sha256Digest } from '@wizard-archive/editor/resources/component-version'
import { DOMAIN_ID_KIND, generateDomainId } from '@wizard-archive/editor/resources/domain-id'
import { readLiveItemHistoryPreview } from '../live-item-history'

afterEach(() => vi.unstubAllGlobals())

describe('live item history', () => {
  it('loads historical map images through the canonical verified image path', async () => {
    const bytes = new Uint8Array([1, 2, 3, 4])
    const digest = await sha256Digest(bytes)
    const version = initialVersion(digest)
    const fetchImage = vi.fn().mockResolvedValue(new Response(bytes, { status: 200 }))
    vi.stubGlobal('fetch', fetchImage)
    const stored = {
      kind: 'map',
      snapshotId: generateDomainId(DOMAIN_ID_KIND.snapshot),
      version,
      content: {
        image: {
          status: 'attached',
          byteSize: bytes.byteLength,
          digest,
          mediaType: 'image/png',
        },
        layers: [],
        pins: [],
      },
      images: [{ layerId: null, url: 'https://example.com/history-map.png' }],
    } satisfies Parameters<typeof readLiveItemHistoryPreview>[0]

    const preview = readLiveItemHistoryPreview(stored)
    if (preview.kind !== 'map') throw new TypeError('Expected map preview')

    await expect(preview.loadImage(null)).resolves.toEqual({
      status: 'ready',
      bytes,
      extension: 'png',
      mediaType: 'image/png',
    })
    expect(fetchImage).toHaveBeenCalledWith('https://example.com/history-map.png')
  })
})
