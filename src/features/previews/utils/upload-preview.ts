import type { Id } from 'convex/_generated/dataModel'
import type { SidebarItemId } from 'convex/sidebarItems/types/baseTypes'

export async function uploadPreviewBlob(
  blob: Blob,
  generateUploadUrl: () => Promise<string>,
  setPreviewImage: (args: {
    itemId: SidebarItemId
    previewStorageId: Id<'_storage'>
  }) => Promise<null>,
  itemId: SidebarItemId,
): Promise<void> {
  const uploadUrl = await generateUploadUrl()

  const contentType = blob.type || 'application/octet-stream'

  const response = await fetch(uploadUrl, {
    method: 'POST',
    headers: { 'Content-Type': contentType },
    body: blob,
  })

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
  const storageId = json?.storageId as Id<'_storage'> | undefined

  if (!storageId) {
    throw new Error('Preview upload failed: missing storageId in response')
  }

  await setPreviewImage({ itemId, previewStorageId: storageId })
}
