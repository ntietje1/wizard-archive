import type { Id } from 'convex/_generated/dataModel'

function throwIfPreviewUploadAborted(signal?: AbortSignal) {
  if (signal?.aborted) {
    throw new Error('Preview upload aborted')
  }
}

export async function uploadPreviewBlob(
  blob: Blob,
  generateUploadUrl: () => Promise<string>,
  setPreviewImage: (args: {
    itemId: Id<'sidebarItems'>
    previewStorageId: Id<'_storage'>
    claimToken: string
  }) => Promise<null>,
  itemId: Id<'sidebarItems'>,
  claimToken: string,
  options: { signal?: AbortSignal } = {},
): Promise<void> {
  throwIfPreviewUploadAborted(options.signal)
  const uploadUrl = await generateUploadUrl()
  throwIfPreviewUploadAborted(options.signal)

  const contentType = blob.type || 'application/octet-stream'

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 30_000)
  const abortUpload = () => controller.abort()
  options.signal?.addEventListener('abort', abortUpload, { once: true })

  let response: Response
  try {
    response = await fetch(uploadUrl, {
      method: 'POST',
      headers: { 'Content-Type': contentType },
      body: blob,
      signal: controller.signal,
    })
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      if (options.signal?.aborted) {
        throw new Error('Preview upload aborted')
      }
      throw new Error('Preview upload timed out after 30s')
    }
    throw error
  } finally {
    clearTimeout(timeoutId)
    options.signal?.removeEventListener('abort', abortUpload)
  }

  if (!response.ok) {
    const errorText = await response.text().catch(() => 'Unknown error')
    throw new Error(`Preview upload failed: ${response.status} - ${errorText}`)
  }

  let json: Record<string, unknown>
  try {
    json = await response.json()
  } catch {
    throw new Error(`Preview upload failed: invalid JSON response (status ${response.status})`)
  }
  if (typeof json.storageId !== 'string') {
    throw new Error('Preview upload failed: missing storageId in response')
  }
  const storageId = json.storageId as Id<'_storage'>
  throwIfPreviewUploadAborted(options.signal)

  await setPreviewImage({ itemId, previewStorageId: storageId, claimToken })
}
