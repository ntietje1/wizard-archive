import { afterEach, describe, expect, it, vi } from 'vite-plus/test'
import type { FunctionReturnType } from 'convex/server'
import type { api } from 'convex/_generated/api'
import type { Id } from 'convex/_generated/dataModel'
import { sha256Digest } from '@wizard-archive/editor/resources/component-version'
import { canonicalizeResourceTitle } from '@wizard-archive/editor/resources/resource-record'
import { testDomainId } from '../../../../../shared/test/domain-id'
import { createLiveMapSessionSource } from '../live-map-session-source'

type Snapshot = FunctionReturnType<typeof api.resources.queries.loadMapContent>

describe('LiveMapSessionSource', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('loads an unopened map once for native export without a subscription', async () => {
    const resourceId = testDomainId('resource', 'map-export')
    const campaignId = testDomainId('campaign', 'map-export-campaign')
    const watch = vi.fn(() => () => undefined)
    const source = createLiveMapSessionSource(
      campaignId,
      {
        load: () =>
          Promise.resolve({
            status: 'ready',
            content: { image: { status: 'unattached' as const }, layers: [], pins: [] },
            version: {
              scheme: 'authoritative-revision-v1' as const,
              revision: 1,
              digest: 'a'.repeat(64),
            },
          }),
        watch,
        create: vi.fn(),
        discard: vi.fn(),
        download: vi.fn(),
        execute: vi.fn(),
        refresh: vi.fn(),
        replace: vi.fn(),
        upload: vi.fn(),
      },
      () => ({ abandon: vi.fn(), completed: vi.fn() }),
    )

    await expect(source.export(resourceId)).resolves.toMatchObject({
      status: 'ready',
      extension: 'wizardmap',
      mediaType: 'application/vnd.wizard-archive.map+json',
    })
    expect(watch).not.toHaveBeenCalled()
    source.dispose()
  })

  it('rejects a completed create with the wrong receipt identity', async () => {
    const campaignId = testDomainId('campaign', 'map-create-campaign')
    const resourceId = testDomainId('resource', 'map-create-resource')
    const operationId = testDomainId('operation', 'map-create-operation')
    const recording = { abandon: vi.fn(), completed: vi.fn() }
    const refresh = vi.fn()
    const source = createLiveMapSessionSource(
      campaignId,
      {
        load: () => Promise.resolve({ status: 'integrity_error', issue: 'content_missing' }),
        watch: () => () => undefined,
        create: () =>
          Promise.resolve({
            status: 'completed',
            receipt: {
              campaignId,
              operationId: testDomainId('operation', 'unexpected-operation'),
              result: { type: 'created', resourceId },
              postconditions: [],
            },
          }),
        discard: vi.fn(),
        download: vi.fn(),
        execute: vi.fn(),
        refresh,
        replace: vi.fn(),
        upload: vi.fn(),
      },
      () => recording,
    )

    await expect(
      source.create({
        campaignId,
        operationId,
        command: {
          type: 'create',
          resourceId,
          kind: 'map',
          parentId: null,
          title: canonicalizeResourceTitle('Map'),
          icon: null,
          color: null,
        },
      }),
    ).resolves.toEqual({
      status: 'not_committed',
      retryable: false,
      reason: 'invalid_response',
    })
    expect(recording.abandon).toHaveBeenCalledOnce()
    expect(recording.completed).not.toHaveBeenCalled()
    expect(refresh).not.toHaveBeenCalled()
    source.dispose()
  })

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
