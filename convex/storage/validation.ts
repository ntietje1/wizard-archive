export interface FileValidationResult {
  success: boolean
  error?: string
}

export const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB

// Allowed MIME type prefixes and exact types
const ALLOWED_MIME_PREFIXES = ['image/', 'video/', 'audio/', 'text/'] as const
const ALLOWED_MIME_TYPES = ['application/pdf'] as const

// Text file extensions for fallback detection
const TEXT_EXTENSIONS = ['.txt', '.md'] as const

/**
 * Check if a content type is allowed for upload
 */
export function isAllowedContentType(contentType: string | null): boolean {
  if (!contentType) return false
  const lowerType = contentType.toLowerCase()
  return (
    ALLOWED_MIME_PREFIXES.some((prefix) => lowerType.startsWith(prefix)) ||
    ALLOWED_MIME_TYPES.some((type) => lowerType === type)
  )
}

/**
 * Check if a file is a media file (image, video, audio, or PDF)
 */
export function isMediaFile(contentType: string | null): boolean {
  if (!contentType) return false
  const lowerType = contentType.toLowerCase()
  return (
    lowerType.startsWith('image/') ||
    lowerType.startsWith('video/') ||
    lowerType.startsWith('audio/') ||
    lowerType === 'application/pdf'
  )
}

/**
 * Check if a file is a text file by content type or filename
 */
export function isTextFile(
  contentType: string | null,
  fileName?: string | null,
): boolean {
  if (contentType?.toLowerCase().startsWith('text/')) {
    return true
  }
  if (fileName) {
    const lowerName = fileName.toLowerCase()
    return TEXT_EXTENSIONS.some((ext) => lowerName.endsWith(ext))
  }
  return false
}

/**
 * Validate file size
 */
export function validateFileSize(
  size: number,
  maxSize: number = MAX_FILE_SIZE,
): FileValidationResult {
  if (size > maxSize) {
    const maxSizeMB = maxSize / (1024 * 1024)
    return {
      success: false,
      error: `File must be less than ${maxSizeMB}MB`,
    }
  }
  return { success: true }
}

/**
 * Validate file type by content type and optional filename
 */
export function validateFileType(
  contentType: string | null,
  fileName?: string | null,
): FileValidationResult {
  const isMedia = isMediaFile(contentType)
  const isText = isTextFile(contentType, fileName)

  if (!isMedia && !isText) {
    return {
      success: false,
      error:
        'Please upload a valid file type (image, video, audio, PDF, or text file)',
    }
  }
  return { success: true }
}

/**
 * Combined validation for file uploads
 * Validates both file type and size
 */
export function validateFileUpload(
  contentType: string | null,
  size: number,
  fileName?: string | null,
  maxSize: number = MAX_FILE_SIZE,
): FileValidationResult {
  // Check type first
  const typeResult = validateFileType(contentType, fileName)
  if (!typeResult.success) {
    return typeResult
  }

  // Then check size
  return validateFileSize(size, maxSize)
}

/**
 * Frontend-compatible validation using File object
 * Use this in browser contexts where you have a File object
 */
export function validateFileForUpload(file: {
  type: string
  size: number
  name: string
}): FileValidationResult {
  return validateFileUpload(file.type, file.size, file.name)
}
