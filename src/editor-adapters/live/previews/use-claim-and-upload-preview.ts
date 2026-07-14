import { api } from 'convex/_generated/api'
import { uploadPreviewBlob } from './upload-preview'
import type { Id } from 'convex/_generated/dataModel'
import type {
  WizardEditorPreviewUpload,
  WizardEditorPreviewUploadResult,
} from '@wizard-archive/editor/adapter'
import type { ResourceId } from '@wizard-archive/editor/resources/domain-id'
import { useCampaignMutation } from '~/shared/hooks/useCampaignMutation'
import { useStorageUploadMutations } from '../shared/upload-helpers'

export function useClaimAndUploadPreview() {
  const claimPreview = useCampaignMutation(api.sidebarItems.mutations.claimPreviewGeneration)
  const setPreviewImage = useCampaignMutation(api.sidebarItems.mutations.setPreviewImage)
  const storageUploadMutations = useStorageUploadMutations()

  const claimAndUpload = (async (
    itemId,
    generate: () => Promise<Blob>,
    options: { signal?: AbortSignal } = {},
  ): Promise<WizardEditorPreviewUploadResult> => {
    try {
      if (options.signal?.aborted) return { status: 'stale' }
      const claim = await claimPreview.mutateAsync({
        itemId,
      })
      if (claim.status !== 'claimed') return { status: 'not-claimed' }
      if (options.signal?.aborted) return { status: 'stale' }

      const blob = await generate()
      if (options.signal?.aborted) return { status: 'stale' }
      const publication = await uploadPreviewBlob(
        blob,
        () =>
          storageUploadMutations.createUploadSession.mutateAsync({}) as Promise<{
            sessionId: Id<'fileStorage'>
            uploadUrl: string
          }>,
        (args) => setPreviewImage.mutateAsync(args),
        itemId,
        claim.claimToken,
        {
          signal: options.signal,
          storageLifecycle: {
            bindUpload: (args) => storageUploadMutations.bindUpload.mutateAsync(args),
            discardUpload: (args) => storageUploadMutations.discardUpload.mutateAsync(args),
          },
        },
      )
      return publication.status === 'published' ? { status: 'success' } : { status: 'stale' }
    } catch (error) {
      if (options.signal?.aborted) return { status: 'stale' }
      return { status: 'error', error }
    }
  }) satisfies WizardEditorPreviewUpload<ResourceId>

  return claimAndUpload
}
