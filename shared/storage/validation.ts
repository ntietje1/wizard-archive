type FileValidationResult = { valid: true } | { valid: false; error: string }

const MAX_FILE_SIZE = 100 * 1024 * 1024

export function validateFileUploadSize(
  size: number,
  maxSize: number = MAX_FILE_SIZE,
): FileValidationResult {
  if (size > maxSize) {
    const maxSizeMB = maxSize / (1024 * 1024)
    return {
      valid: false,
      error: `File must be less than ${maxSizeMB}MB`,
    }
  }
  return { valid: true }
}
