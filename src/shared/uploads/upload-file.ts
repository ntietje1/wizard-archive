import type { Id } from 'convex/_generated/dataModel'
import type { MaybePromise } from 'shared/common/async'

interface UploadProgressCallback {
  (percentage: number): void
}

interface UploadOptions {
  onProgress?: UploadProgressCallback
  timeout?: number
}

interface UploadFileSource {
  type?: string
  contentType?: string
  arrayBuffer: () => MaybePromise<ArrayBuffer>
}

export async function uploadFile(
  file: UploadFileSource,
  uploadUrl: string,
  options?: UploadOptions,
): Promise<Id<'_storage'>> {
  const contentType = file.contentType ?? file.type ?? 'application/octet-stream'
  const body = new Blob([await file.arrayBuffer()], { type: contentType })
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()

    xhr.timeout = options?.timeout ?? 60000 // 60 seconds

    if (options?.onProgress) {
      xhr.upload.addEventListener('progress', (event: ProgressEvent) => {
        if (event.lengthComputable) {
          const percentage = Math.round((event.loaded / event.total) * 100)
          options.onProgress!(percentage)
        }
      })
    }

    xhr.addEventListener('load', () => {
      if (xhr.status !== 200) {
        reject(new Error(`Upload failed with status ${xhr.status}`))
        return
      }

      try {
        const response = JSON.parse(xhr.responseText) as {
          storageId: Id<'_storage'>
        }
        if (!response.storageId) {
          reject(new Error('Invalid response: missing storageId'))
          return
        }
        resolve(response.storageId)
      } catch {
        reject(new Error('Failed to parse upload response'))
      }
    })

    xhr.addEventListener('error', () => reject(new Error('Upload failed')))
    xhr.addEventListener('abort', () => reject(new Error('Upload cancelled')))
    xhr.addEventListener('timeout', () => reject(new Error('Upload timed out')))

    xhr.open('POST', uploadUrl, true)
    xhr.setRequestHeader('Content-Type', body.type)
    xhr.send(body)
  })
}
