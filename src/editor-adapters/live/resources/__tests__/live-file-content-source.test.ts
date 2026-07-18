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

const generatePdfPreview = vi.hoisted(() => vi.fn())

vi.mock('@wizard-archive/editor/resources/preview-generation', () => ({
  generatePdfPreview,
}))

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
  afterEach(() => generatePdfPreview.mockReset())

  it('rejects replacement before upload when the canonical resource permission is read only', async () => {
    const resourceId = testDomainId('resource', 'readonly-file')
    const upload = vi.fn()
    const replace = vi.fn()
    const fixture = createLiveResourceContentAuthorityFixture(false)
    const source = createSource(
      testDomainId('campaign', 'readonly-file-campaign'),
      {
        cancel: vi.fn(),
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
        cancel: vi.fn(),
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
        cancel: vi.fn(),
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
        cancel: vi.fn(),
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
    const metadataVersion = await initialResourceMetadataVersion({
      parentId: null,
      kind: 'file',
      title: canonicalizeResourceTitle('Session.md'),
      icon: null,
      color: null,
      lifecycle: 'active',
    })
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
        cancel: vi.fn(),
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
    }

    await expect(
      source.executeTransfer(
        { campaignId, jobId: importJobId, operationId, destinationParentId: null },
        fileSource,
      ),
    ).resolves.toMatchObject({
      status: 'received',
      result: { status: 'completed' },
    })
    expect(create).toHaveBeenCalledWith({
      campaignId,
      jobId: importJobId,
      operationId,
      destinationParentId: null,
      uploadSessionId: sessionId,
    })
    expect(refresh).toHaveBeenCalledWith(resourceId, null)
    expect(recording.completed).toHaveBeenCalledOnce()
    expect(recording.abandon).not.toHaveBeenCalled()
    expect(discard).not.toHaveBeenCalled()
    source.dispose()
  })

  it('publishes a PDF preview after its canonical file creation commits', async () => {
    const campaignId = testDomainId('campaign', 'create-pdf-preview-campaign')
    const resourceId = testDomainId('resource', 'create-pdf-preview')
    const operationId = testDomainId('operation', 'create-pdf-preview')
    const jobId = testDomainId('importJob', 'create-pdf-preview')
    const sessionId = 'create-pdf-preview-session' as Id<'fileStorage'>
    const metadataVersion = await initialResourceMetadataVersion({
      parentId: null,
      kind: 'file',
      title: canonicalizeResourceTitle('Reference.pdf'),
      icon: null,
      color: null,
      lifecycle: 'active',
    })
    const preview = new Blob(['preview'], { type: 'image/webp' })
    generatePdfPreview.mockResolvedValue(preview)
    const publish = vi.fn(async (_resourceId, generate: () => Promise<Blob>) => {
      await generate()
      return { status: 'published' as const }
    })
    const source = createSource(
      campaignId,
      {
        cancel: vi.fn(),
        load: vi.fn(),
        watch: vi.fn(() => () => undefined),
        create: () =>
          Promise.resolve({
            status: 'completed',
            receipt: {
              campaignId,
              operationId,
              result: { type: 'created', resourceId },
              postconditions: [{ state: 'present', resourceId, metadataVersion }],
            },
          }),
        discard: vi.fn(),
        download: vi.fn(),
        refresh: vi.fn(),
        replace: vi.fn(),
        upload: () => Promise.resolve(sessionId),
      },
      () => ({ abandon: vi.fn(), completed: vi.fn() }),
      createLiveResourceContentAuthorityFixture().authority,
      { publish },
    )
    const bytes = new TextEncoder().encode('%PDF-1.7\npreview')

    await source.executeTransfer(
      { campaignId, jobId, operationId, destinationParentId: null },
      { bytes, fileName: 'Reference.pdf' },
    )
    await vi.waitFor(() => expect(publish).toHaveBeenCalledWith(resourceId, expect.any(Function)))
    expect(generatePdfPreview).toHaveBeenCalledWith(bytes)
    source.dispose()
  })

  it('publishes a PDF preview after canonical file replacement', async () => {
    const campaignId = testDomainId('campaign', 'replace-pdf-preview-campaign')
    const resourceId = testDomainId('resource', 'replace-pdf-preview')
    const bytes = new TextEncoder().encode('%PDF-1.7\nreplacement')
    const metadata = {
      classification: 'viewable_pdf' as const,
      byteSize: bytes.byteLength,
      detectedFormat: 'pdf',
      extension: 'pdf',
      mediaType: 'application/pdf',
      viewerUnavailableReason: null,
    }
    const version = await initialFileContentVersion(bytes, metadata)
    const publish = vi.fn(() => Promise.resolve({ status: 'published' as const }))
    const source = createSource(
      campaignId,
      {
        cancel: vi.fn(),
        load: () =>
          Promise.resolve({
            status: 'ready',
            content: { ...metadata, attachment: 'attached' },
            version,
          }),
        watch: vi.fn(() => () => undefined),
        create: vi.fn(),
        discard: vi.fn(),
        download: vi.fn(),
        refresh: vi.fn(),
        replace: () =>
          Promise.resolve({
            status: 'completed',
            content: { ...metadata, attachment: 'attached' },
            version,
          }),
        upload: () => Promise.resolve('replace-pdf-preview-session' as Id<'fileStorage'>),
      },
      () => ({ abandon: vi.fn(), completed: vi.fn() }),
      createLiveResourceContentAuthorityFixture().authority,
      { publish },
    )

    await source.replace(resourceId, version, { bytes, fileName: 'replacement.pdf' })
    await vi.waitFor(() => expect(publish).toHaveBeenCalledWith(resourceId, expect.any(Function)))
    source.dispose()
  })

  it('rejects and cleans up a create receipt that is not a single created resource', async () => {
    const campaignId = testDomainId('campaign', 'invalid-create-file-campaign')
    const resourceId = testDomainId('resource', 'invalid-create-file')
    const operationId = testDomainId('operation', 'invalid-create-file')
    const metadataVersion = await initialResourceMetadataVersion({
      parentId: null,
      kind: 'file',
      title: canonicalizeResourceTitle('Evidence'),
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
        cancel: vi.fn(),
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
                  resourceId: testDomainId('resource', 'unexpected-created-file'),
                  metadataVersion,
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
      source.executeTransfer(
        {
          campaignId,
          jobId: testDomainId('importJob', 'invalid-create-file'),
          operationId,
          destinationParentId: null,
        },
        {
          bytes: new TextEncoder().encode('evidence'),
          fileName: 'Evidence',
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

  it('cancels the durable transfer job when an in-flight request is aborted', async () => {
    const campaignId = testDomainId('campaign', 'cancel-file-campaign')
    const jobId = testDomainId('importJob', 'cancel-file')
    const operationId = testDomainId('operation', 'cancel-file')
    const sessionId = 'cancel-file-session' as Id<'fileStorage'>
    let resolveCreate!: (
      result: FunctionReturnType<typeof api.resources.actions.executePlainFileTransfer>,
    ) => void
    const create = vi.fn(
      () =>
        new Promise<FunctionReturnType<typeof api.resources.actions.executePlainFileTransfer>>(
          (resolve) => {
            resolveCreate = resolve
          },
        ),
    )
    const cancel = vi.fn(() => Promise.resolve())
    const discard = vi.fn(() => Promise.resolve())
    const recording = { abandon: vi.fn(), completed: vi.fn() }
    const source = createLiveFileContentSource(
      campaignId,
      {
        cancel,
        create,
        discard,
        download: vi.fn(),
        load: vi.fn(),
        refresh: vi.fn(),
        replace: vi.fn(),
        upload: vi.fn(() => Promise.resolve(sessionId)),
        watch: vi.fn(() => () => undefined),
      },
      () => recording,
    )
    const controller = new AbortController()
    const transfer = source.executeTransfer(
      { campaignId, jobId, operationId, destinationParentId: null },
      { bytes: new TextEncoder().encode('cancel me'), fileName: 'cancel.txt' },
      controller.signal,
    )
    await vi.waitFor(() => expect(create).toHaveBeenCalledOnce())

    controller.abort()
    await vi.waitFor(() =>
      expect(cancel).toHaveBeenCalledWith({
        campaignId,
        jobId,
        operationId,
        destinationParentId: null,
        uploadSessionId: sessionId,
      }),
    )
    resolveCreate({ status: 'rejected', reason: 'invalid_command' })

    await expect(transfer).resolves.toEqual({
      status: 'received',
      result: { status: 'rejected', reason: 'invalid_command' },
    })
    expect(discard).toHaveBeenCalledWith(sessionId)
    expect(recording.abandon).toHaveBeenCalledOnce()
    source.dispose()
  })

  it('records cancellation when abort finishes before the upload session exists', async () => {
    const campaignId = testDomainId('campaign', 'cancel-upload-campaign')
    const jobId = testDomainId('importJob', 'cancel-upload')
    const operationId = testDomainId('operation', 'cancel-upload')
    const sessionId = 'cancel-upload-session' as Id<'fileStorage'>
    let resolveUpload!: (sessionId: Id<'fileStorage'>) => void
    const upload = vi.fn(
      () =>
        new Promise<Id<'fileStorage'>>((resolve) => {
          resolveUpload = resolve
        }),
    )
    const cancel = vi.fn(() => Promise.resolve())
    const create = vi.fn()
    const discard = vi.fn(() => Promise.resolve())
    const recording = { abandon: vi.fn(), completed: vi.fn() }
    const source = createLiveFileContentSource(
      campaignId,
      {
        cancel,
        create,
        discard,
        download: vi.fn(),
        load: vi.fn(),
        refresh: vi.fn(),
        replace: vi.fn(),
        upload,
        watch: vi.fn(() => () => undefined),
      },
      () => recording,
    )
    const controller = new AbortController()
    const transfer = source.executeTransfer(
      { campaignId, jobId, operationId, destinationParentId: null },
      { bytes: new TextEncoder().encode('cancel upload'), fileName: 'cancel.txt' },
      controller.signal,
    )
    await vi.waitFor(() => expect(upload).toHaveBeenCalledOnce())

    controller.abort()
    resolveUpload(sessionId)

    await expect(transfer).resolves.toEqual({
      status: 'received',
      result: { status: 'rejected', reason: 'invalid_command' },
    })
    expect(cancel).toHaveBeenCalledWith({
      campaignId,
      jobId,
      operationId,
      destinationParentId: null,
      uploadSessionId: sessionId,
    })
    expect(create).not.toHaveBeenCalled()
    expect(discard).toHaveBeenCalledWith(sessionId)
    expect(recording.abandon).toHaveBeenCalledOnce()
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
        cancel: vi.fn(),
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
        cancel: vi.fn(),
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
