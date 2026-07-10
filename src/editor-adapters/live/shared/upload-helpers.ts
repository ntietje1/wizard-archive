import { api } from 'convex/_generated/api'
import type { Id } from 'convex/_generated/dataModel'
import type { MaybePromise } from 'shared/common/async'
import { useAppMutation } from '~/shared/hooks/useAppMutation'
import { uploadFile as uploadFileToUrl } from '~/shared/uploads/upload-file'

interface LiveUploadFileSource {
  contentType?: string
  name: string
  type?: string
  arrayBuffer: () => MaybePromise<ArrayBuffer>
}

interface LiveUploadMutation<TArgs> {
  mutateAsync: (args: TArgs) => Promise<unknown>
}

interface LiveStorageUploadMutations {
  createUploadSession: LiveUploadMutation<Record<string, never>>
  bindUpload: LiveUploadMutation<{
    originalFileName: string
    sessionId: Id<'fileStorage'>
    storageId: Id<'_storage'>
  }>
  discardUpload: LiveUploadMutation<{
    sessionId: Id<'fileStorage'>
  }>
}

export function useStorageUploadMutations(): LiveStorageUploadMutations {
  return {
    createUploadSession: useAppMutation(api.storage.mutations.createUploadSession),
    bindUpload: useAppMutation(api.storage.mutations.bindUpload),
    discardUpload: useAppMutation(api.storage.mutations.discardUpload),
  }
}

export async function uploadToStorage(
  file: LiveUploadFileSource,
  mutations: LiveStorageUploadMutations,
  options?: { onProgress?: (percentage: number) => void },
): Promise<{ sessionId: Id<'fileStorage'>; storageId: Id<'_storage'> }> {
  const { sessionId, uploadUrl } = (await mutations.createUploadSession.mutateAsync({})) as {
    sessionId: Id<'fileStorage'>
    uploadUrl: string
  }
  try {
    const storageId = options
      ? await uploadFileToUrl(file, uploadUrl, options)
      : await uploadFileToUrl(file, uploadUrl)
    await mutations.bindUpload.mutateAsync({
      sessionId,
      storageId,
      originalFileName: file.name,
    })
    return { sessionId, storageId }
  } catch (error) {
    await mutations.discardUpload.mutateAsync({ sessionId }).catch(() => undefined)
    throw error
  }
}
