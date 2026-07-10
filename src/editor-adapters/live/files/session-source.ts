import { api } from 'convex/_generated/api'
import { usePdfPreviewUpload } from '~/editor-adapters/live/previews/use-pdf-preview-upload'
import { useCampaignMutation } from '~/shared/hooks/useCampaignMutation'
import { createWizardEditorFileContentSource } from '@wizard-archive/editor/adapter'
import type {
  WizardEditorFileContentSourceInput,
  WizardEditorFileSessionReplaceInput,
} from '@wizard-archive/editor/adapter'
import type { Id } from 'convex/_generated/dataModel'
import { uploadToStorage, useStorageUploadMutations } from '../shared/upload-helpers'
import { handleError } from '~/shared/utils/logger'

type LiveFileSessionAdapterInput = Pick<
  WizardEditorFileContentSourceInput,
  'canReplaceFile' | 'getItemById'
>
type LiveFileUploadSource = File | WizardEditorFileSessionReplaceInput['file']

export function useLiveFileSessionAdapter({
  canReplaceFile,
  getItemById,
}: LiveFileSessionAdapterInput) {
  const storageUploadMutations = useStorageUploadMutations()
  const updateFileStorageMutation = useCampaignMutation(api.files.mutations.updateFileStorage)
  const { generatePdfPreviewIfNeeded } = usePdfPreviewUpload()

  return createWizardEditorFileContentSource({
    canReplaceFile,
    getItemById,
    resolveFile: (file) => {
      const resolvedFile = {
        allowObjectUrl: false as const,
        contentType: file.contentType,
        name: file.name,
        size: null,
      }

      if (file.downloadUrl) {
        return {
          ...resolvedFile,
          downloadUrl: file.downloadUrl,
          status: 'available',
        }
      }

      if (file.assetId) {
        return {
          ...resolvedFile,
          downloadUrl: null,
          reason: 'missing',
          status: 'unavailable',
        }
      }

      return {
        ...resolvedFile,
        downloadUrl: null,
        status: 'unattached',
      }
    },
    writeFile: ({ file, fileId, onProgress }) =>
      uploadAndAttachFileStorage({
        file,
        fileId,
        generatePdfPreviewIfNeeded,
        onProgress,
        storageUploadMutations,
        updateFileStorage: updateFileStorageMutation.mutateAsync,
      }),
  })
}

async function uploadAndAttachFileStorage({
  file,
  fileId,
  generatePdfPreviewIfNeeded,
  onProgress,
  storageUploadMutations,
  updateFileStorage,
}: {
  file: LiveFileUploadSource
  fileId: string
  generatePdfPreviewIfNeeded: ReturnType<typeof usePdfPreviewUpload>['generatePdfPreviewIfNeeded']
  onProgress?: (percentage: number) => void
  storageUploadMutations: ReturnType<typeof useStorageUploadMutations>
  updateFileStorage: (args: {
    fileId: Id<'sidebarItems'>
    uploadSessionId: Awaited<ReturnType<typeof uploadToStorage>>['sessionId']
  }) => Promise<unknown>
}) {
  const upload = await uploadToStorage(
    file,
    storageUploadMutations,
    onProgress ? { onProgress } : undefined,
  )
  try {
    await updateFileStorage({
      fileId: fileId as Id<'sidebarItems'>,
      uploadSessionId: upload.sessionId,
    })
  } catch (error) {
    await storageUploadMutations.discardUpload
      .mutateAsync({ sessionId: upload.sessionId })
      .catch(() => undefined)
    throw error
  }
  generatePdfPreview(file, fileId, generatePdfPreviewIfNeeded)
}

function generatePdfPreview(
  file: LiveFileUploadSource,
  fileId: string,
  generatePdfPreviewIfNeeded: ReturnType<typeof usePdfPreviewUpload>['generatePdfPreviewIfNeeded'],
) {
  void Promise.resolve(generatePdfPreviewIfNeeded(file, fileId)).catch((error) => {
    handleError(error, 'Failed to generate PDF preview')
  })
}
