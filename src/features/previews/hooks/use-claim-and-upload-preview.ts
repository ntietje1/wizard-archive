import { useCallback, useRef } from 'react'
import { api } from 'convex/_generated/api'
import { uploadPreviewBlob } from '../utils/upload-preview'
import type { SidebarItemId } from 'convex/sidebarItems/types/baseTypes'
import { useAppMutation } from '~/shared/hooks/useAppMutation'
import { logger } from '~/shared/utils/logger'

export type PreviewUploadResult =
  | { status: 'success' }
  | { status: 'not-claimed' }
  | { status: 'error'; error: unknown }

export function useClaimAndUploadPreview() {
  const claimPreview = useAppMutation(
    api.sidebarItems.mutations.claimPreviewGeneration,
  )
  const setPreviewImage = useAppMutation(
    api.sidebarItems.mutations.setPreviewImage,
  )
  const generateUploadUrl = useAppMutation(
    api.storage.mutations.generateUploadUrl,
  )

  const claimRef = useRef(claimPreview)
  claimRef.current = claimPreview
  const setRef = useRef(setPreviewImage)
  setRef.current = setPreviewImage
  const urlRef = useRef(generateUploadUrl)
  urlRef.current = generateUploadUrl

  const claimAndUpload = useCallback(
    async (
      itemId: SidebarItemId,
      generate: () => Promise<Blob>,
    ): Promise<PreviewUploadResult> => {
      try {
        const { claimed, claimToken } = await claimRef.current.mutateAsync({
          itemId,
        })
        if (!claimed || !claimToken) return { status: 'not-claimed' }

        const blob = await generate()
        await uploadPreviewBlob(
          blob,
          () => urlRef.current.mutateAsync({}),
          (args) => setRef.current.mutateAsync(args),
          itemId,
          claimToken,
        )
        return { status: 'success' }
      } catch (error) {
        logger.error(
          `Failed to claim/upload preview for itemId=${itemId}:`,
          error,
        )
        return { status: 'error', error }
      }
    },
    [],
  )

  return claimAndUpload
}
