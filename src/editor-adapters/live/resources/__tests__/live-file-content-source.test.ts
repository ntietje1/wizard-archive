import { afterEach, describe, expect, it, vi } from 'vite-plus/test'
import type { FunctionReturnType } from 'convex/server'
import type { api } from 'convex/_generated/api'
import type { Id } from 'convex/_generated/dataModel'
import { testDomainId } from '../../../../../shared/test/domain-id'
import { initialFileContentVersion } from '@wizard-archive/editor/resources/content-version'
import { createLiveFileContentSource } from '../live-file-content-source'

type Snapshot = FunctionReturnType<typeof api.resources.queries.loadContent>

afterEach(() => vi.unstubAllGlobals())

describe('LiveFileContentSource', () => {
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
      kind: 'file',
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
        create: vi.fn(),
        discard: vi.fn(),
        download: () =>
          Promise.resolve({ status: 'ready', url: 'https://files.test/evidence', version }),
        refresh: vi.fn(),
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
            kind: 'file',
            content: { ...metadata, attachment: 'attached' as const },
            version,
          }),
        watch: vi.fn(() => () => undefined),
        create: vi.fn(),
        discard: vi.fn(),
        download: () =>
          Promise.resolve({ status: 'ready', url: 'https://files.test/tampered', version }),
        refresh: vi.fn(),
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
        kind: 'file' as const,
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
        create: vi.fn(),
        discard,
        download: vi.fn(),
        refresh: vi.fn(),
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
        create: vi.fn(),
        discard,
        download: vi.fn(),
        refresh: vi.fn(),
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
