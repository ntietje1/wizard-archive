import { afterEach, describe, expect, it, vi } from 'vite-plus/test'
import type { FunctionReturnType } from 'convex/server'
import type { api } from 'convex/_generated/api'
import type { Id } from 'convex/_generated/dataModel'
import { sha256Digest } from '@wizard-archive/editor/resources/component-version'
import { testDomainId } from '../../../../../shared/test/domain-id'
import { createLiveMapSessionSource } from '../live-map-session-source'

type Snapshot = FunctionReturnType<typeof api.resources.queries.loadContent>

describe('LiveMapSessionSource', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('keeps one session, verifies image bytes, and replays one replacement response loss', async () => {
    const campaignId = testDomainId('campaign', 'map-session-campaign')
    const resourceId = testDomainId('resource', 'map-session-resource')
    const sessionId = 'map-upload-session' as Id<'fileStorage'>
    const original = new Uint8Array([1, 2, 3])
    const replacement = new Uint8Array([4, 5, 6, 7])
    const originalImage = {
      status: 'attached' as const,
      byteSize: original.byteLength,
      digest: await sha256Digest(original),
      mediaType: 'image/png',
    }
    const replacementImage = {
      status: 'attached' as const,
      byteSize: replacement.byteLength,
      digest: await sha256Digest(replacement),
      mediaType: 'image/png',
    }
    const version = {
      scheme: 'authoritative-revision-v1' as const,
      revision: 1,
      digest: 'a'.repeat(64),
    }
    const nextVersion = { ...version, revision: 2, digest: 'b'.repeat(64) }
    let apply: (snapshot: Snapshot) => void = () => undefined
    const replace = vi
      .fn()
      .mockRejectedValueOnce(new Error('response lost'))
      .mockResolvedValue({
        status: 'completed',
        content: { image: replacementImage, layers: [], pins: [] },
        version: nextVersion,
      })
    const discard = vi.fn()
    const source = createLiveMapSessionSource(
      campaignId,
      {
        create: vi.fn(),
        discard,
        download: vi.fn(() =>
          Promise.resolve({
            status: 'ready' as const,
            image: originalImage,
            url: 'https://map.test',
            version,
          }),
        ),
        execute: vi.fn(),
        load: vi.fn(),
        refresh: vi.fn(),
        replace,
        upload: vi.fn(() => Promise.resolve(sessionId)),
        watch: (_resourceId, update) => {
          apply = update
          return () => undefined
        },
      },
      () => ({ abandon: vi.fn(), completed: vi.fn() }),
    )
    source.subscribe(resourceId, () => undefined)
    apply({
      status: 'ready',
      kind: 'map',
      content: { image: originalImage, layers: [], pins: [] },
      version,
    })
    const ready = source.get(resourceId)
    if (ready.status !== 'ready') throw new TypeError('Expected a ready map session')
    const session = ready.session
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.resolve(new Response(original))),
    )

    await expect(session.loadImage(null)).resolves.toEqual({
      status: 'ready',
      bytes: original,
      extension: 'png',
      mediaType: 'image/png',
    })
    await expect(
      session.replaceImage(null, { bytes: replacement, fileName: 'replacement.png' }),
    ).resolves.toEqual({
      status: 'completed',
      content: { image: replacementImage, layers: [], pins: [] },
      version: nextVersion,
    })
    expect(replace).toHaveBeenCalledTimes(2)
    expect(replace.mock.calls[0]![0].uploadSessionId).toBe(sessionId)
    expect(replace.mock.calls[1]![0].uploadSessionId).toBe(sessionId)
    expect(discard).not.toHaveBeenCalled()
    const updated = source.get(resourceId)
    expect(updated.status === 'ready' && updated.session).toBe(session)

    source.dispose()
    await expect(
      session.replaceImage(null, { bytes: replacement, fileName: 'replacement.png' }),
    ).resolves.toEqual({ status: 'rejected', reason: 'resource_missing' })
    await expect(session.loadImage(null)).resolves.toEqual({
      status: 'unavailable',
      reason: 'scope_unavailable',
    })
  })
})
