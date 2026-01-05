/**
 * Validates a file for upload.
 * Checks file type and size according to application requirements.
 */
export interface FileValidationResult {
  success: boolean
  error?: string
}

const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB

/**
 * Validates that a file is a viewable media type and within size limits.
 *
 * @param file - The file to validate
 * @returns Validation result with success status and optional error message
 */
export function validateFileForUpload(file: File): FileValidationResult {
  const mimeType = file.type.toLowerCase()
  const fileName = file.name.toLowerCase()

  // Check if it's a viewable media type
  const isViewable =
    mimeType.startsWith('image/') ||
    mimeType.startsWith('video/') ||
    mimeType.startsWith('audio/') ||
    mimeType === 'application/pdf' ||
    /\.(jpg|jpeg|png|gif|webp|svg|bmp|ico|pdf|mp4|webm|ogg|mov|avi|wmv|flv|mp3|wav|aac|flac|m4a)$/i.test(
      fileName,
    )

  if (!isViewable) {
    return {
      success: false,
      error: 'Please upload a valid file type (image, video, audio, or PDF)',
    }
  }

  // Check file size (10MB max)
  if (file.size > MAX_FILE_SIZE) {
    return {
      success: false,
      error: 'File must be less than 10MB',
    }
  }

  return { success: true }
}
