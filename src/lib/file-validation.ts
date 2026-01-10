export interface FileValidationResult {
  success: boolean
  error?: string
}

const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB

export function isMediaFile(file: File): boolean {
  const mimeType = file.type.toLowerCase()
  return (
    mimeType.startsWith('image/') ||
    mimeType.startsWith('video/') ||
    mimeType.startsWith('audio/') ||
    mimeType === 'application/pdf'
  )
}

export function isTextFile(file: File): boolean {
  return (
    file.type.startsWith('text/') ||
    file.name.toLowerCase().endsWith('.txt') ||
    file.name.toLowerCase().endsWith('.md')
  )
}

export function validateFileForUpload(file: File): FileValidationResult {
  const isText = isTextFile(file)
  const isMedia = isMediaFile(file)

  if (!isMedia && !isText) {
    return {
      success: false,
      error:
        'Please upload a valid file type (image, video, audio, PDF, or text file)',
    }
  }

  if (file.size > MAX_FILE_SIZE) {
    return {
      success: false,
      error: 'File must be less than 10MB',
    }
  }

  return { success: true }
}
