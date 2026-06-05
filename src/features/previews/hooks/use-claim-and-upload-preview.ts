import { useCallback, useRef } from 'react'
import { api } from 'convex/_generated/api'
import { uploadPreviewBlob } from '../utils/upload-preview'
import type { Id } from 'convex/_generated/dataModel'
import { useAppMutation } from '~/shared/hooks/useAppMutation'
import { useCampaignMutation } from '~/shared/hooks/useCampaignMutation'

type PreviewUploadResult =
  | { status: 'success' }
  | { status: 'not-claimed' }
  | { status: 'stale' }
  | { status: 'error'; error: unknown }

export function useClaimAndUploadPreview() {
  const claimPreview = useCampaignMutation(api.sidebarItems.mutations.claimPreviewGeneration)
  const setPreviewImage = useCampaignMutation(api.sidebarItems.mutations.setPreviewImage)
  const generateUploadUrl = useAppMutation(api.storage.mutations.generateUploadUrl)

  const claimRef = useRef(claimPreview)
  claimRef.current = claimPreview
  const setRef = useRef(setPreviewImage)
  setRef.current = setPreviewImage
  const urlRef = useRef(generateUploadUrl)
  urlRef.current = generateUploadUrl

  const claimAndUpload = useCallback(
    async (
      itemId: Id<'sidebarItems'>,
      generate: () => Promise<Blob>,
      options: { signal?: AbortSignal } = {},
    ): Promise<PreviewUploadResult> => {
      try {
        if (options.signal?.aborted) return { status: 'stale' }
        const { claimed, claimToken } = await claimRef.current.mutateAsync({
          itemId,
        })
        if (!claimed || !claimToken) return { status: 'not-claimed' }
        if (options.signal?.aborted) return { status: 'stale' }

        const blob = await generate()
        if (options.signal?.aborted) return { status: 'stale' }
        await uploadPreviewBlob(
          blob,
          () => urlRef.current.mutateAsync({}),
          (args) => setRef.current.mutateAsync(args),
          itemId,
          claimToken,
          { signal: options.signal },
        )
        return { status: 'success' }
      } catch (error) {
        if (options.signal?.aborted) return { status: 'stale' }
        return { status: 'error', error }
      }
    },
    [],
  )

  return claimAndUpload
}
