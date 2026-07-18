import { afterEach, describe, expect, it, vi } from 'vite-plus/test'
import type { FunctionReturnType } from 'convex/server'
import type { api } from 'convex/_generated/api'
import type { Id } from 'convex/_generated/dataModel'
import { testDomainId } from '../../../../../shared/test/domain-id'
import { initialFileContentVersion } from '@wizard-archive/editor/resources/content-version'
import { assertVersionStamp } from '@wizard-archive/editor/resources/component-version'
import { initialResourceMetadataVersion } from '@wizard-archive/editor/resources/resource-metadata-version'
import { canonicalizeResourceTitle } from '@wizard-archive/editor/resources/resource-record'
import { createLiveFileContentSource as createSource } from '../live-file-content-source'
import { createLiveResourceContentAuthorityFixture } from './live-resource-content-authority.fixture'

function createLiveFileContentSource(
  campaign: Parameters<typeof createSource>[0],
  backend: Parameters<typeof createSource>[1],
  beginUndo: Parameters<typeof createSource>[2],
) {
  return createSource(
    campaign,
    backend,
    beginUndo,
    createLiveResourceContentAuthorityFixture().authority,
  )
}

type Snapshot = FunctionReturnType<typeof api.resources.queries.loadFileContent>

afterEach(() => vi.unstubAllGlobals())

describe('LiveFileContentSource', () => {
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
        create: vi.fn(),
        discard: vi.fn(),
        download: vi.fn(),
        refresh: vi.fn(),
        replace,
        upload,
      },
      () => ({ abandon: vi.fn(), completed: vi.fn() }),
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
        create: vi.fn(),
        discard: vi.fn(),
        download: vi.fn(),
        refresh: vi.fn(),
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

  it('commits a planned file identity and source alias through the authoritative create', async () => {
    const campaignId = testDomainId('campaign', 'create-file-campaign')
    const resourceId = testDomainId('resource', 'create-file')
    const operationId = testDomainId('operation', 'create-file')
    const importJobId = testDomainId('importJob', 'create-file')
    const sessionId = 'create-file-session' as Id<'fileStorage'>
    const command = {
      type: 'create' as const,
      resourceId,
      kind: 'file' as const,
      parentId: null,
      title: canonicalizeResourceTitle('Session.md'),
      icon: null,
      color: null,
    }
    const metadataVersion = await initialResourceMetadataVersion({
      parentId: command.parentId,
      kind: command.kind,
      title: command.title,
      icon: command.icon,
      color: command.color,
      lifecycle: 'active',
    })
    const alias = {
      campaignId,
      resourceId,
      importJobId,
      sourceRootId: 'selected-file',
      rawPath: 'Session.md',
      normalizedPath: 'Session.md',
    }
    const create = vi.fn(() =>
      Promise.resolve({
        status: 'completed' as const,
        receipt: {
          campaignId,
          operationId,
          result: { type: 'created' as const, resourceId },
          postconditions: [{ state: 'present' as const, resourceId, metadataVersion }],
        },
      }),
    )
    const discard = vi.fn()
    const refresh = vi.fn(() => Promise.resolve())
    const recording = { abandon: vi.fn(), completed: vi.fn() }
    const source = createLiveFileContentSource(
      campaignId,
      {
        load: vi.fn(),
        watch: vi.fn(() => () => undefined),
        create,
        discard,
        download: vi.fn(),
        refresh,
        replace: vi.fn(),
        upload: vi.fn(() => Promise.resolve(sessionId)),
      },
      () => recording,
    )
    const fileSource = {
      bytes: new TextEncoder().encode('# Kept as a file'),
      fileName: 'Session.md',
      alias,
      metadataVersion,
    }

    await expect(
      source.create({ campaignId, operationId, command }, fileSource),
    ).resolves.toMatchObject({
      status: 'received',
      result: { status: 'completed' },
    })
    expect(create).toHaveBeenCalledWith({
      campaignId,
      operationId,
      command,
      alias,
      metadataVersion,
      uploadSessionId: sessionId,
    })
    expect(refresh).toHaveBeenCalledWith(resourceId, null)
    expect(recording.completed).toHaveBeenCalledOnce()
    expect(recording.abandon).not.toHaveBeenCalled()
    expect(discard).not.toHaveBeenCalled()
    source.dispose()
  })

  it('rejects and cleans up a create receipt that does not match its planned metadata', async () => {
    const campaignId = testDomainId('campaign', 'invalid-create-file-campaign')
    const resourceId = testDomainId('resource', 'invalid-create-file')
    const operationId = testDomainId('operation', 'invalid-create-file')
    const command = {
      type: 'create' as const,
      resourceId,
      kind: 'file' as const,
      parentId: null,
      title: canonicalizeResourceTitle('Evidence'),
      icon: null,
      color: null,
    }
    const metadataVersion = await initialResourceMetadataVersion({
      parentId: null,
      kind: 'file',
      title: command.title,
      icon: null,
      color: null,
      lifecycle: 'active',
    })
    const sessionId = 'invalid-create-file-session' as Id<'fileStorage'>
    const discard = vi.fn(() => Promise.resolve())
    const recording = { abandon: vi.fn(), completed: vi.fn() }
    const source = createLiveFileContentSource(
      campaignId,
      {
        load: vi.fn(),
        watch: vi.fn(() => () => undefined),
        create: vi.fn(() =>
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
                  metadataVersion: { ...metadataVersion, digest: 'f'.repeat(64) },
                },
              ],
            },
          }),
        ),
        discard,
        download: vi.fn(),
        refresh: vi.fn(),
        replace: vi.fn(),
        upload: vi.fn(() => Promise.resolve(sessionId)),
      },
      () => recording,
    )

    await expect(
      source.create(
        { campaignId, operationId, command },
        {
          bytes: new TextEncoder().encode('evidence'),
          fileName: 'Evidence',
          alias: {
            campaignId,
            resourceId,
            importJobId: testDomainId('importJob', 'invalid-create-file'),
            sourceRootId: 'selected-file',
            rawPath: 'Evidence',
            normalizedPath: 'Evidence',
          },
          metadataVersion,
        },
      ),
    ).resolves.toEqual({
      status: 'not_committed',
      retryable: false,
      reason: 'invalid_response',
    })
    expect(discard).toHaveBeenCalledWith(sessionId)
    expect(recording.abandon).toHaveBeenCalledOnce()
    expect(recording.completed).not.toHaveBeenCalled()
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
