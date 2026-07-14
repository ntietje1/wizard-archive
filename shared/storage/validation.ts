type FileValidationResult = { valid: true } | { valid: false; error: string }

const MAX_FILE_SIZE = 100 * 1024 * 1024 // 100MB

const MEDIA_EXTENSIONS = [
  '.aac',
  '.avi',
  '.flac',
  '.gif',
  '.jpeg',
  '.jpg',
  '.m4a',
  '.mov',
  '.mp3',
  '.mp4',
  '.ogg',
  '.pdf',
  '.png',
  '.wav',
  '.webm',
  '.webp',
] as const
const TEXT_EXTENSIONS = ['.txt', '.md'] as const

function isMediaFile(contentType: string | null, fileName?: string | null): boolean {
  const lowerType = contentType?.toLowerCase()
  if (
    lowerType &&
    (lowerType.startsWith('image/') ||
      lowerType.startsWith('video/') ||
      lowerType.startsWith('audio/') ||
      lowerType === 'application/pdf')
  ) {
    return true
  }
  if (!fileName) return false
  const lowerName = fileName.toLowerCase()
  return MEDIA_EXTENSIONS.some((ext) => lowerName.endsWith(ext))
}

function isTextFile(contentType: string | null, fileName?: string | null): boolean {
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
  const isMedia = isMediaFile(contentType, fileName)
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
