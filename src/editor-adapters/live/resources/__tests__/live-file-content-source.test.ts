import { afterEach, describe, expect, it, vi } from 'vite-plus/test'
import type { FunctionReturnType } from 'convex/server'
import type { api } from 'convex/_generated/api'
import type { Id } from 'convex/_generated/dataModel'
import { testDomainId } from '../../../../../shared/test/domain-id'
import { initialFileContentVersion } from '@wizard-archive/editor/resources/content-version'
import { assertVersionStamp } from '@wizard-archive/editor/resources/component-version'
import { createLiveFileContentSource as createSource } from '../live-file-content-source'
import { createLiveResourceContentAuthorityFixture } from './live-resource-content-authority.fixture'

function createLiveFileContentSource(
  campaign: Parameters<typeof createSource>[0],
  backend: Parameters<typeof createSource>[1],
  _beginUndo: () => unknown,
) {
  return createSource(campaign, backend, createLiveResourceContentAuthorityFixture().authority)
}

type Snapshot = FunctionReturnType<typeof api.resources.queries.loadFileContent>

afterEach(() => vi.unstubAllGlobals())

describe('LiveFileContentSource', () => {
  it('retries authored creation with the same server upload identity', async () => {
    const campaignId = testDomainId('campaign', 'asset-create-campaign')
    const resourceId = testDomainId('resource', 'asset-create-resource')
    const sessionId = 'asset-create-session' as Id<'fileStorage'>
    const upload = vi.fn(() => Promise.resolve(sessionId))
    const createAsset = vi
      .fn()
      .mockRejectedValueOnce(new Error('response lost'))
      .mockResolvedValueOnce({ status: 'completed', resourceId })
    const discard = vi.fn()
    const source = createLiveFileContentSource(
      campaignId,
      {
        load: vi.fn(() => Promise.reject(new Error('projection not loaded'))),
        watch: vi.fn(() => () => undefined),
        discard,
        createAsset,
        download: vi.fn(),
        replace: vi.fn(),
        upload,
      },
      () => ({ abandon: vi.fn(), completed: vi.fn() }),
    )

    const first = await source.createAsset({
      bytes: new TextEncoder().encode('asset'),
      fileName: 'Asset.txt',
    })
    if (first.status !== 'retryable') throw new TypeError('Expected retryable creation')
    await expect(first.retry()).resolves.toEqual({ status: 'completed', resourceId })
    expect(upload).toHaveBeenCalledOnce()
    expect(createAsset).toHaveBeenCalledTimes(2)
    expect(createAsset.mock.calls[1]).toEqual(createAsset.mock.calls[0])
    expect(discard).not.toHaveBeenCalled()
    source.dispose()
  })

  it('rejects replacement before upload when the canonical resource permission is read only', async () => {
    const resourceId = testDomainId('resource', 'readonly-file')
    const upload = vi.fn()
    const replace = vi.fn()
    const fixture = createLiveResourceContentAuthorityFixture(false)
    const source = createSource(
      testDomainId('campaign', 'readonly-file-campaign'),
      {
        load: vi.fn(),
        watch: vi.fn(() => () => undefined),
        discard: vi.fn(),
        createAsset: vi.fn(),
        download: vi.fn(),
        replace,
        upload,
      },
      fixture.authority,
    )

    await expect(
      source.replace(
        resourceId,
        assertVersionStamp({
          scheme: 'authoritative-revision-v1',
          revision: 1,
          digest: 'a'.repeat(64),
        }),
        { bytes: new Uint8Array([1]), fileName: 'readonly.txt' },
      ),
    ).resolves.toEqual({ status: 'rejected', reason: 'unauthorized' })
    expect(upload).not.toHaveBeenCalled()
    expect(replace).not.toHaveBeenCalled()
    source.dispose()
  })

  it('keeps loading, initializing, ready, unavailable, and integrity states distinct', () => {
    const resourceId = testDomainId('resource', 'file-content')
    const campaignId = testDomainId('campaign', 'file-content-campaign')
    let apply: (snapshot: Snapshot) => void = () => undefined
    const unsubscribe = vi.fn()
    const listener = vi.fn()
    const source = createLiveFileContentSource(
      campaignId,
      {
        load: () => Promise.resolve({ status: 'integrity_error', issue: 'content_missing' }),
        watch: (_resourceId, update) => {
          apply = update
          return unsubscribe
        },
        discard: vi.fn(),
        createAsset: vi.fn(),
        download: vi.fn(),
        replace: vi.fn(),
        upload: vi.fn(),
      },
      () => ({ abandon: vi.fn(), completed: vi.fn() }),
    )

    expect(source.get(resourceId)).toEqual({ status: 'loading' })
    source.subscribe(resourceId, listener)
    const operationId = testDomainId('operation', 'file-copy')
    apply({ status: 'initializing', operationId })
    expect(source.get(resourceId)).toEqual({ status: 'initializing', operationId })

    const content = {
      attachment: 'unattached' as const,
      classification: 'inert_file' as const,
      byteSize: 0,
      detectedFormat: null,
      extension: 'txt',
      mediaType: 'application/octet-stream',
      viewerUnavailableReason: 'empty_file' as const,
    }
    const version = {
      scheme: 'authoritative-revision-v1' as const,
      revision: 1,
      digest: 'a'.repeat(64),
    }
    apply({ status: 'ready', content, version })
    expect(source.get(resourceId)).toEqual({ status: 'ready', content, version })
    apply({ status: 'unavailable', reason: 'unauthorized' })
    expect(source.get(resourceId)).toEqual({ status: 'unavailable', reason: 'unauthorized' })
    apply({ status: 'integrity_error', issue: 'content_missing' })
    expect(source.get(resourceId)).toEqual({
      status: 'integrity_error',
      issue: 'content_missing',
    })
    expect(listener).toHaveBeenCalledTimes(4)

    source.dispose()
    expect(unsubscribe).toHaveBeenCalledOnce()
  })

  it('downloads the authorized exact bytes and verifies their owned metadata', async () => {
    const resourceId = testDomainId('resource', 'download-file')
    const campaignId = testDomainId('campaign', 'download-campaign')
    const bytes = new TextEncoder().encode('exact file bytes')
    const metadata = {
      classification: 'inert_file' as const,
      byteSize: bytes.byteLength,
      detectedFormat: null,
      extension: 'txt',
      mediaType: 'text/plain',
      viewerUnavailableReason: 'unsupported_format' as const,
    }
    const version = await initialFileContentVersion(bytes, metadata)
    const snapshot: Snapshot = {
      status: 'ready',
      content: { ...metadata, attachment: 'attached' as const },
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
        discard: vi.fn(),
        createAsset: vi.fn(),
        download: () =>
          Promise.resolve({ status: 'ready', url: 'https://files.test/evidence', version }),
        replace: vi.fn(),
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

  it('rejects same-length bytes that do not match the stored content version', async () => {
    const resourceId = testDomainId('resource', 'corrupt-download-file')
    const campaignId = testDomainId('campaign', 'corrupt-download-campaign')
    const expectedBytes = new TextEncoder().encode('expected bytes')
    const metadata = {
      classification: 'inert_file' as const,
      byteSize: expectedBytes.byteLength,
      detectedFormat: null,
      extension: 'txt',
      mediaType: 'text/plain',
      viewerUnavailableReason: 'unsupported_format' as const,
    }
    const version = await initialFileContentVersion(expectedBytes, metadata)
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.resolve(new Response(new TextEncoder().encode('tampered bytes')))),
    )
    const source = createLiveFileContentSource(
      campaignId,
      {
        load: () =>
          Promise.resolve({
            status: 'ready',
            content: { ...metadata, attachment: 'attached' as const },
            version,
          }),
        watch: vi.fn(() => () => undefined),
        discard: vi.fn(),
        createAsset: vi.fn(),
        download: () =>
          Promise.resolve({ status: 'ready', url: 'https://files.test/tampered', version }),
        replace: vi.fn(),
        upload: vi.fn(),
      },
      () => ({ abandon: vi.fn(), completed: vi.fn() }),
    )

    await expect(source.export(resourceId)).resolves.toEqual({
      status: 'integrity_error',
      issue: 'content_corrupt',
    })
    source.dispose()
  })

  it('uploads replacement bytes through one focused operation and reloads the content snapshot', async () => {
    const resourceId = testDomainId('resource', 'replace-file')
    const campaignId = testDomainId('campaign', 'replace-campaign')
    const bytes = new TextEncoder().encode('replacement')
    const metadata = {
      classification: 'inert_file' as const,
      byteSize: bytes.byteLength,
      detectedFormat: null,
      extension: 'txt',
      mediaType: 'text/plain',
      viewerUnavailableReason: 'unsupported_format' as const,
    }
    const version = await initialFileContentVersion(bytes, metadata)
    const sessionId = 'replacement-session' as Id<'fileStorage'>
    const load = vi.fn(() =>
      Promise.resolve({
        status: 'ready' as const,
        content: { ...metadata, attachment: 'attached' as const },
        version,
      }),
    )
    const replace = vi
      .fn()
      .mockRejectedValueOnce(new TypeError('response lost'))
      .mockResolvedValue({
        status: 'completed' as const,
        content: { ...metadata, attachment: 'attached' as const },
        version,
      })
    const discard = vi.fn()
    const source = createLiveFileContentSource(
      campaignId,
      {
        load,
        watch: vi.fn(() => () => undefined),
        discard,
        createAsset: vi.fn(),
        download: vi.fn(),
        replace,
        upload: vi.fn(() => Promise.resolve(sessionId)),
      },
      () => ({ abandon: vi.fn(), completed: vi.fn() }),
    )

    await expect(
      source.replace(resourceId, version, { bytes, fileName: 'replacement.txt' }),
    ).resolves.toMatchObject({
      status: 'completed',
      content: { attachment: 'attached', byteSize: bytes.byteLength },
    })
    expect(replace).toHaveBeenCalledWith({
      campaignId,
      resourceId,
      expectedVersion: version,
      uploadSessionId: sessionId,
    })
    expect(replace).toHaveBeenCalledTimes(2)
    expect(load).toHaveBeenCalledWith(resourceId)
    expect(discard).not.toHaveBeenCalled()
    source.dispose()
  })

  it('discards an uncommitted upload before returning a retryable replacement outcome', async () => {
    const resourceId = testDomainId('resource', 'replace-retry-file')
    const campaignId = testDomainId('campaign', 'replace-retry-campaign')
    const bytes = new TextEncoder().encode('replacement')
    const metadata = {
      classification: 'inert_file' as const,
      byteSize: bytes.byteLength,
      detectedFormat: null,
      extension: 'txt',
      mediaType: 'text/plain',
      viewerUnavailableReason: 'unsupported_format' as const,
    }
    const version = await initialFileContentVersion(bytes, metadata)
    const sessionId = 'replacement-retry-session' as Id<'fileStorage'>
    const discard = vi.fn(() => Promise.resolve())
    const source = createLiveFileContentSource(
      campaignId,
      {
        load: vi.fn(),
        watch: vi.fn(() => () => undefined),
        discard,
        createAsset: vi.fn(),
        download: vi.fn(),
        replace: vi.fn(() =>
          Promise.resolve({
            status: 'retryable' as const,
            reason: 'content_initializing' as const,
          }),
        ),
        upload: vi.fn(() => Promise.resolve(sessionId)),
      },
      () => ({ abandon: vi.fn(), completed: vi.fn() }),
    )

    await expect(
      source.replace(resourceId, version, { bytes, fileName: 'replacement.txt' }),
    ).resolves.toEqual({
      status: 'retryable',
      reason: 'content_initializing',
    })
    expect(discard).toHaveBeenCalledWith(sessionId)
    source.dispose()
  })
})
