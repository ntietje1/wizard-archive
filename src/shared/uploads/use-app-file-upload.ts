import { useMutation } from '@tanstack/react-query'
import { api } from 'convex/_generated/api'
import { useState } from 'react'
import type { Id } from 'convex/_generated/dataModel'
import { logger } from '~/shared/utils/logger'
import { useAppMutation } from '~/shared/hooks/useAppMutation'

interface UploadProgress {
  loaded: number
  total: number
  percentage: number
}

export function useAppFileUpload() {
  const [uploadProgress, setUploadProgress] = useState<UploadProgress>({
    loaded: 0,
    total: 0,
    percentage: 0,
  })

  const createUploadSession = useAppMutation(api.storage.mutations.createUploadSession)

  const bindUpload = useAppMutation(api.storage.mutations.bindUpload)

  const discardUpload = useAppMutation(api.storage.mutations.discardUpload)

  // assumes file is already validated
  const uploadFile = useMutation({
    mutationFn: async (
      file: File,
    ): Promise<{ sessionId: Id<'fileStorage'>; storageId: Id<'_storage'> }> => {
      const { sessionId, uploadUrl } = await createUploadSession.mutateAsync({})

      return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest()
        const rejectAndDiscard = (error: Error) => {
          void discardUpload
            .mutateAsync({ sessionId })
            .catch((discardError) => logger.error(discardError))
            .finally(() => reject(error))
        }

        xhr.upload.addEventListener('progress', (event: ProgressEvent<XMLHttpRequestUpload>) => {
          if (event.lengthComputable) {
            const percentComplete = (event.loaded / event.total) * 100
            setUploadProgress({
              loaded: event.loaded,
              total: event.total,
              percentage: Math.round(percentComplete),
            })
          }
        })

        xhr.addEventListener('load', async () => {
          if (xhr.status === 200) {
            try {
              const response = JSON.parse(xhr.responseText) as {
                storageId: Id<'_storage'>
              }
              const storageId = response.storageId
              try {
                await bindUpload.mutateAsync({
                  sessionId,
                  storageId,
                  originalFileName: file.name,
                })
                resolve({ sessionId, storageId })
              } catch (error) {
                logger.error(error)
                rejectAndDiscard(new Error('Failed to bind upload'))
              }
            } catch (error) {
              logger.error(error)
              rejectAndDiscard(new Error('Failed to parse upload response'))
            }
          } else {
            rejectAndDiscard(new Error(`Upload failed with status ${xhr.status}`))
          }
        })
        xhr.addEventListener('error', () => {
          setUploadProgress({ loaded: 0, total: 0, percentage: 0 })
          rejectAndDiscard(new Error('Upload failed'))
        })

        xhr.addEventListener('abort', () => {
          setUploadProgress({ loaded: 0, total: 0, percentage: 0 })
          rejectAndDiscard(new Error('Upload cancelled'))
        })

        xhr.open('POST', uploadUrl, true)
        xhr.setRequestHeader('Content-Type', file.type)
        xhr.send(file)
      })
    },
  })

  return {
    discardUpload,
    uploadFile,
    uploadProgress,
    resetProgress: () => setUploadProgress({ loaded: 0, total: 0, percentage: 0 }),
  }
}
