import { useMutation } from '@tanstack/react-query'
import { api } from 'convex/_generated/api'
import { useState } from 'react'
import type { Id } from 'convex/_generated/dataModel'
import { logger } from '~/shared/utils/logger'
import { useAppMutation } from '~/shared/hooks/useAppMutation'

export interface UploadProgress {
  loaded: number
  total: number
  percentage: number
}

export const useFileUpload = () => {
  const [uploadProgress, setUploadProgress] = useState<UploadProgress>({
    loaded: 0,
    total: 0,
    percentage: 0,
  })

  const generateUploadUrl = useAppMutation(api.storage.mutations.generateUploadUrl)

  const trackUploadMutation = useAppMutation(api.storage.mutations.trackUpload)

  const commitUpload = useAppMutation(api.storage.mutations.commitUpload)

  // assumes file is already validated
  const uploadFile = useMutation({
    mutationFn: async (file: File): Promise<Id<'_storage'>> => {
      const uploadUrl = await generateUploadUrl.mutateAsync({})

      return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest()

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
                await trackUploadMutation.mutateAsync({
                  storageId,
                  originalFileName: file.name,
                })
                resolve(storageId)
              } catch (error) {
                logger.error(error)
                reject(new Error('Failed to track upload'))
              }
            } catch (error) {
              logger.error(error)
              reject(new Error('Failed to parse upload response'))
            }
          } else {
            reject(new Error(`Upload failed with status ${xhr.status}`))
          }
        })
        xhr.addEventListener('error', () => {
          setUploadProgress({ loaded: 0, total: 0, percentage: 0 })
          reject(new Error('Upload failed'))
        })

        xhr.addEventListener('abort', () => {
          setUploadProgress({ loaded: 0, total: 0, percentage: 0 })
          reject(new Error('Upload cancelled'))
        })

        xhr.open('POST', uploadUrl, true)
        xhr.setRequestHeader('Content-Type', file.type)
        xhr.send(file)
      })
    },
  })

  return {
    uploadFile,
    uploadProgress,
    resetProgress: () => setUploadProgress({ loaded: 0, total: 0, percentage: 0 }),
    commitUpload,
  }
}
