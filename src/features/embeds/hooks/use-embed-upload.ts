import { useSingleMediaFileUpload } from '~/features/file-upload/hooks/useSingleMediaFileUpload'
import { useAssetsFolder } from './use-assets-folder'

export function useEmbedUpload() {
  const { uploadSingleMediaFile } = useSingleMediaFileUpload()
  const { error, isLoading, resolveAssetsFolderId } = useAssetsFolder()

  const uploadEmbedFile = async (file: File) => {
    if (isLoading) {
      throw new Error('Cannot upload embeds before sidebar items load')
    }
    if (error) {
      throw new Error('Cannot upload embeds while sidebar items failed to load')
    }
    const assetsFolderId = await resolveAssetsFolderId()
    return await uploadSingleMediaFile(file, assetsFolderId, {
      navigate: false,
    })
  }

  return { uploadEmbedFile }
}
