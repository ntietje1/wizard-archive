import { useCallback, useRef } from 'react'
import { api } from 'convex/_generated/api'
import type { Id } from 'convex/_generated/dataModel'
import { useAppMutation } from '~/shared/hooks/useAppMutation'

const THUMBNAIL_WIDTH = 800

export function useNoteThumbnailCapture(noteId: Id<'notes'>) {
  const claimMutation = useAppMutation(
    api.sidebarItems.mutations.claimThumbnailGeneration,
  )
  const commitMutation = useAppMutation(
    api.sidebarItems.mutations.commitThumbnail,
  )
  const generateUploadUrl = useAppMutation(
    api.storage.mutations.generateUploadUrl,
  )
  const trackUpload = useAppMutation(api.storage.mutations.trackUpload)
  const commitUpload = useAppMutation(api.storage.mutations.commitUpload)

  const isCapturing = useRef(false)

  const captureThumbnail = useCallback(
    async (editorElement: HTMLElement) => {
      console.log('[thumbnail] captureThumbnail called', {
        noteId,
        isCapturing: isCapturing.current,
        editorElement: !!editorElement,
      })

      if (isCapturing.current) {
        console.log('[thumbnail] skipping — already capturing')
        return
      }
      isCapturing.current = true

      try {
        // Step 1: Claim the generation lock
        console.log('[thumbnail] claiming generation lock...')
        const result = await claimMutation.mutateAsync({
          itemId: noteId,
        })
        console.log('[thumbnail] claim result:', result)
        if (!result.claimed) {
          console.log('[thumbnail] claim denied, reason:', result.reason)
          return
        }

        // Step 2: Capture the editor as a PNG (dynamic import to avoid SSR issues)
        console.log('[thumbnail] importing html-to-image...')
        const { toPng } = await import('html-to-image')
        console.log('[thumbnail] capturing editor element...', {
          width: editorElement.offsetWidth,
          height: editorElement.offsetHeight,
        })
        const dataUrl = await toPng(editorElement, {
          width: THUMBNAIL_WIDTH,
          canvasWidth: THUMBNAIL_WIDTH,
          pixelRatio: 1,
          skipAutoScale: true,
          skipFonts: true,
        })
        console.log(
          '[thumbnail] captured, dataUrl length:',
          dataUrl.length,
          'prefix:',
          dataUrl.substring(0, 50),
        )

        // Step 3: Convert data URL to blob
        const response = await fetch(dataUrl)
        const blob = await response.blob()
        console.log('[thumbnail] blob size:', blob.size, 'type:', blob.type)

        // Step 4: Upload to Convex storage
        console.log('[thumbnail] generating upload URL...')
        const uploadUrl = await generateUploadUrl.mutateAsync({})
        console.log('[thumbnail] uploading blob...')
        const uploadResponse = await fetch(uploadUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'image/png' },
          body: blob,
        })
        const { storageId } = (await uploadResponse.json()) as {
          storageId: Id<'_storage'>
        }
        console.log('[thumbnail] uploaded, storageId:', storageId)

        // Step 5: Track and commit the upload
        await trackUpload.mutateAsync({
          storageId,
          originalFileName: `thumbnail-${noteId}.png`,
        })
        await commitUpload.mutateAsync({ storageId })
        console.log('[thumbnail] upload tracked and committed')

        // Step 6: Commit the thumbnail to the sidebar item
        await commitMutation.mutateAsync({
          itemId: noteId,
          thumbnailStorageId: storageId,
        })
        console.log('[thumbnail] thumbnail committed successfully!')
      } catch (error) {
        console.error('[thumbnail] error during capture:', error)
      } finally {
        isCapturing.current = false
      }
    },
    [
      noteId,
      claimMutation,
      commitMutation,
      generateUploadUrl,
      trackUpload,
      commitUpload,
    ],
  )

  return { captureThumbnail }
}
