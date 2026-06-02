type FileValidationResult = { valid: true } | { valid: false; error: string }

export const MAX_FILE_SIZE = 100 * 1024 * 1024 // 100MB

const ALLOWED_MIME_TYPES = ['application/pdf'] as const
const TEXT_EXTENSIONS = ['.txt', '.md'] as const

export const FILE_UPLOAD_ACCEPT_PATTERN = [
  'image/*',
  'video/*',
  'audio/*',
  'text/*',
  ...ALLOWED_MIME_TYPES,
  ...TEXT_EXTENSIONS,
].join(',')

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

export function isTextFile(contentType: string | null, fileName?: string | null): boolean {
  if (contentType?.toLowerCase().startsWith('text/')) {
    return true
  }
  if (fileName) {
    const lowerName = fileName.toLowerCase()
    return TEXT_EXTENSIONS.some((ext) => lowerName.endsWith(ext))
  }
  return false
}

function validateFileSize(size: number, maxSize: number = MAX_FILE_SIZE): FileValidationResult {
  if (size > maxSize) {
    const maxSizeMB = maxSize / (1024 * 1024)
    return {
      valid: false,
      error: `File must be less than ${maxSizeMB}MB`,
    }
  }
  return { valid: true }
}

function validateFileType(
  contentType: string | null,
  fileName?: string | null,
): FileValidationResult {
  const isMedia = isMediaFile(contentType)
  const isText = isTextFile(contentType, fileName)

  if (!isMedia && !isText) {
    return {
      valid: false,
      error: 'Please upload a valid file type (image, video, audio, PDF, or text file)',
    }
  }
  return { valid: true }
}

export function validateFileUpload(
  contentType: string | null,
  size: number,
  fileName?: string | null,
  maxSize: number = MAX_FILE_SIZE,
): FileValidationResult {
  const typeResult = validateFileType(contentType, fileName)
  if (!typeResult.valid) {
    return typeResult
  }

  return validateFileSize(size, maxSize)
}

export function validateFileForUpload(file: {
  type: string
  size: number
  name: string
}): FileValidationResult {
  return validateFileUpload(file.type, file.size, file.name)
}
