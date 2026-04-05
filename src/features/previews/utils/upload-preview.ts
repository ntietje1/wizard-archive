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

  const response = await fetch(uploadUrl, {
    method: 'POST',
    headers: { 'Content-Type': blob.type },
    body: blob,
  })

  if (!response.ok) {
    throw new Error(`Preview upload failed: ${response.status}`)
  }

  const { storageId } = (await response.json()) as {
    storageId: Id<'_storage'>
  }
  await setPreviewImage({ itemId, previewStorageId: storageId })
}
