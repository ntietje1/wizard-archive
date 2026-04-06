import type { Id } from 'convex/_generated/dataModel'
import type { SidebarItemId } from 'convex/sidebarItems/types/baseTypes'

export async function uploadPreviewBlob(
  blob: Blob,
  generateUploadUrl: () => Promise<string>,
  setPreviewImage: (args: {
    itemId: SidebarItemId
    previewStorageId: Id<'_storage'>
    claimToken: string
  }) => Promise<null>,
  itemId: SidebarItemId,
  claimToken: string,
): Promise<void> {
  const uploadUrl = await generateUploadUrl()

  const contentType = blob.type || 'application/octet-stream'

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 30_000)

  let response: Response
  try {
    response = await fetch(uploadUrl, {
      method: 'POST',
      headers: { 'Content-Type': contentType },
      body: blob,
      signal: controller.signal,
    })
  } catch (error) {
    clearTimeout(timeoutId)
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new Error('Preview upload timed out after 30s')
    }
    throw error
  }
  clearTimeout(timeoutId)

  if (!response.ok) {
    const errorText = await response.text().catch(() => 'Unknown error')
    throw new Error(`Preview upload failed: ${response.status} - ${errorText}`)
  }

  let json: Record<string, unknown>
  try {
    json = await response.json()
  } catch {
    throw new Error(
      `Preview upload failed: invalid JSON response (status ${response.status})`,
    )
  }
  if (typeof json.storageId !== 'string') {
    throw new Error('Preview upload failed: missing storageId in response')
  }
  const storageId = json.storageId as Id<'_storage'>

  await setPreviewImage({ itemId, previewStorageId: storageId, claimToken })
}
