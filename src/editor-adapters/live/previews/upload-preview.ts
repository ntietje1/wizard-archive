import type { Id } from 'convex/_generated/dataModel'
import type { ResourceId } from '@wizard-archive/editor/resources/domain-id'

const PREVIEW_UPLOAD_TIMEOUT_MS = 30_000
const PREVIEW_UPLOAD_TIMEOUT_SECONDS = PREVIEW_UPLOAD_TIMEOUT_MS / 1000
const PREVIEW_UPLOAD_FILE_NAME = 'preview-image.webp'

interface PreviewStorageLifecycle {
  bindUpload: (args: {
    originalFileName: string
    sessionId: Id<'fileStorage'>
    storageId: Id<'_storage'>
  }) => Promise<unknown>
  discardUpload: (args: { sessionId: Id<'fileStorage'> }) => Promise<unknown>
}

interface PreviewUploadOptions {
  signal?: AbortSignal
  storageLifecycle?: PreviewStorageLifecycle
}

type PreviewPublicationResult = { status: 'published' } | { status: 'stale' }

function throwIfPreviewUploadAborted(signal?: AbortSignal) {
  if (signal?.aborted) {
    throw new Error('Preview upload aborted')
  }
}

function previewUploadTimeoutError() {
  return new Error(`Preview upload timed out after ${PREVIEW_UPLOAD_TIMEOUT_SECONDS}s`)
}

async function waitForPreviewUploadStep<T>(step: Promise<T>, signal?: AbortSignal): Promise<T> {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), PREVIEW_UPLOAD_TIMEOUT_MS)
  const abortStep = () => controller.abort()
  signal?.addEventListener('abort', abortStep, { once: true })

  try {
    return await Promise.race([
      step,
      new Promise<never>((_, reject) => {
        controller.signal.addEventListener(
          'abort',
          () => {
            reject(
              signal?.aborted ? new Error('Preview upload aborted') : previewUploadTimeoutError(),
            )
          },
          { once: true },
        )
      }),
    ])
  } finally {
    clearTimeout(timeoutId)
    signal?.removeEventListener('abort', abortStep)
  }
}

async function fetchPreviewUpload(blob: Blob, uploadUrl: string, signal?: AbortSignal) {
  const contentType = blob.type || 'application/octet-stream'
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), PREVIEW_UPLOAD_TIMEOUT_MS)
  const abortUpload = () => controller.abort()
  signal?.addEventListener('abort', abortUpload, { once: true })

  try {
    return await fetch(uploadUrl, {
      method: 'POST',
      headers: { 'Content-Type': contentType },
      body: blob,
      signal: controller.signal,
    })
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      if (signal?.aborted) {
        throw new Error('Preview upload aborted')
      }
      throw previewUploadTimeoutError()
    }
    throw error
  } finally {
    clearTimeout(timeoutId)
    signal?.removeEventListener('abort', abortUpload)
  }
}

async function parsePreviewStorageId(response: Response) {
  if (!response.ok) {
    const errorText = await response.text().catch(() => 'Unknown error')
    throw new Error(`Preview upload failed: ${response.status} - ${errorText}`)
  }

  let json: unknown
  try {
    json = await response.json()
  } catch (error) {
    throw new Error(`Preview upload failed: invalid JSON response (status ${response.status})`, {
      cause: error,
    })
  }

  if (
    !json ||
    typeof json !== 'object' ||
    typeof (json as { storageId?: unknown }).storageId !== 'string'
  ) {
    throw new Error('Preview upload failed: missing storageId in response')
  }
  return (json as { storageId: string }).storageId as Id<'_storage'>
}

async function publishPreviewUpload(args: {
  claimToken: string
  itemId: ResourceId
  setPreviewImage: (args: {
    itemId: ResourceId
    claimToken: string
    uploadSessionId: Id<'fileStorage'>
  }) => Promise<PreviewPublicationResult>
  signal?: AbortSignal
  sessionId: Id<'fileStorage'>
  storageId: Id<'_storage'>
  storageLifecycle?: PreviewStorageLifecycle
}) {
  try {
    if (args.storageLifecycle) {
      await args.storageLifecycle.bindUpload({
        sessionId: args.sessionId,
        storageId: args.storageId,
        originalFileName: PREVIEW_UPLOAD_FILE_NAME,
      })
    }
    throwIfPreviewUploadAborted(args.signal)
    const result = await args.setPreviewImage({
      itemId: args.itemId,
      claimToken: args.claimToken,
      uploadSessionId: args.sessionId,
    })
    if (result.status === 'stale') {
      await args.storageLifecycle
        ?.discardUpload({ sessionId: args.sessionId })
        .catch(() => undefined)
    }
    return result
  } catch (error) {
    await args.storageLifecycle?.discardUpload({ sessionId: args.sessionId }).catch(() => undefined)
    throw error
  }
}

export async function uploadPreviewBlob(
  blob: Blob,
  createUploadSession: () => Promise<{
    sessionId: Id<'fileStorage'>
    uploadUrl: string
  }>,
  setPreviewImage: (args: {
    itemId: ResourceId
    claimToken: string
    uploadSessionId: Id<'fileStorage'>
  }) => Promise<PreviewPublicationResult>,
  itemId: ResourceId,
  claimToken: string,
  options: PreviewUploadOptions = {},
): Promise<PreviewPublicationResult> {
  throwIfPreviewUploadAborted(options.signal)
  const session = await waitForPreviewUploadStep(createUploadSession(), options.signal)
  let storageId: Id<'_storage'>
  try {
    throwIfPreviewUploadAborted(options.signal)
    const response = await fetchPreviewUpload(blob, session.uploadUrl, options.signal)
    storageId = await parsePreviewStorageId(response)
  } catch (error) {
    await options.storageLifecycle
      ?.discardUpload({ sessionId: session.sessionId })
      .catch(() => undefined)
    throw error
  }
  return await publishPreviewUpload({
    claimToken,
    itemId,
    setPreviewImage,
    signal: options.signal,
    sessionId: session.sessionId,
    storageId,
    storageLifecycle: options.storageLifecycle,
  })
}
