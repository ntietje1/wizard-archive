import { useConvexMutation } from '@convex-dev/react-query'
import { useMutation } from '@tanstack/react-query'
import { api } from 'convex/_generated/api'
import { useState } from 'react'
import type { Id } from 'convex/_generated/dataModel'

export const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB

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

  const generateUploadUrl = useMutation({
    mutationFn: useConvexMutation(api.storage.mutations.generateUploadUrl),
  })

  const trackUploadMutation = useMutation({
    mutationFn: useConvexMutation(api.storage.mutations.trackUpload),
  })

  const commitUpload = useMutation({
    mutationFn: useConvexMutation(api.storage.mutations.commitUpload),
  })

  const uploadFile = useMutation({
    mutationFn: async (file: File): Promise<Id<'_storage'>> => {
      if (file.size > MAX_FILE_SIZE) {
        const error = `File must be less than ${MAX_FILE_SIZE / (1024 * 1024)}MB (current: ${(file.size / (1024 * 1024)).toFixed(1)}MB)`
        throw new Error(error)
      }

      const uploadUrl = await generateUploadUrl.mutateAsync({})

      return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest()

        xhr.upload.addEventListener(
          'progress',
          (event: ProgressEvent<XMLHttpRequestUpload>) => {
            if (event.lengthComputable) {
              const percentComplete = (event.loaded / event.total) * 100
              setUploadProgress({
                loaded: event.loaded,
                total: event.total,
                percentage: Math.round(percentComplete),
              })
            }
          },
        )

        xhr.addEventListener('load', async () => {
          if (xhr.status === 200) {
            try {
              const response = JSON.parse(xhr.responseText) as {
                storageId: string
              }
              const storageId = response.storageId as unknown as Id<'_storage'>
              try {
                await trackUploadMutation.mutateAsync({
                  storageId,
                  originalFileName: file.name,
                })
                setUploadProgress({ loaded: 0, total: 0, percentage: 0 })
                resolve(storageId)
              } catch (error) {
                console.error('Failed to track upload', error)
                reject(new Error('Failed to track upload'))
              }
            } catch (error) {
              console.error('Failed to parse upload response', error)
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
    resetProgress: () =>
      setUploadProgress({ loaded: 0, total: 0, percentage: 0 }),
    commitUpload,
  }
}
