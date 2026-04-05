import { useRef } from 'react'
import { api } from 'convex/_generated/api'
import { uploadPreviewBlob } from '../utils/upload-preview'
import type { SidebarItemId } from 'convex/sidebarItems/types/baseTypes'
import { useAppMutation } from '~/shared/hooks/useAppMutation'
import { logger } from '~/shared/utils/logger'

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

  const claimAndUpload = async (
    itemId: SidebarItemId,
    generate: () => Promise<Blob>,
  ): Promise<boolean> => {
    try {
      const { claimed } = await claimRef.current.mutateAsync({ itemId })
      if (!claimed) return false

      const blob = await generate()
      await uploadPreviewBlob(
        blob,
        () => urlRef.current.mutateAsync({}),
        (args) => setRef.current.mutateAsync(args),
        itemId,
      )
      return true
    } catch (error) {
      logger.error(error)
      return false
    }
  }

  return claimAndUpload
}
