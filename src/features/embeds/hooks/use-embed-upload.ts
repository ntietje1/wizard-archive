import { useFileDropHandler } from '~/features/dnd/hooks/useFileDropHandler'
import { useAssetsFolder } from './use-assets-folder'

export function useEmbedUpload() {
  const { uploadSingleFile } = useFileDropHandler()
  const { error, isLoading, resolveAssetsFolderId } = useAssetsFolder()

  const uploadEmbedFile = async (file: File) => {
    if (isLoading) {
      throw new Error('Cannot upload embeds before sidebar items load')
    }
    if (error) {
      throw new Error('Cannot upload embeds while sidebar items failed to load')
    }
    const assetsFolderId = await resolveAssetsFolderId()
    return await uploadSingleFile(file, assetsFolderId, {
      navigate: false,
    })
  }

  return { uploadEmbedFile }
}
