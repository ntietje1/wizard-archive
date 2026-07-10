type FileTypeCategory = 'image' | 'pdf' | 'video' | 'audio' | 'file'

const FILE_TYPE_EXTENSIONS: Record<Exclude<FileTypeCategory, 'file'>, ReadonlySet<string>> = {
  image: new Set([
    'avif',
    'bmp',
    'gif',
    'heic',
    'heif',
    'ico',
    'jpeg',
    'jpg',
    'png',
    'svg',
    'tif',
    'tiff',
    'webp',
  ]),
  pdf: new Set(['pdf']),
  video: new Set(['avi', 'flv', 'm4v', 'mkv', 'mov', 'mp4', 'ogv', 'webm', 'wmv']),
  audio: new Set(['aac', 'flac', 'm4a', 'mp3', 'oga', 'ogg', 'opus', 'wav']),
}

export function getFileTypeCategory(
  contentType: string | null | undefined,
  fileName: string | null | undefined,
): FileTypeCategory {
  const mimeType = contentType?.toLowerCase().split(';', 1)[0]?.trim() ?? ''
  const extension = getFileExtension(fileName)

  if (mimeType.startsWith('image/') || hasFileExtension('image', extension)) {
    return 'image'
  }
  if (mimeType === 'application/pdf' || hasFileExtension('pdf', extension)) {
    return 'pdf'
  }
  if (mimeType.startsWith('video/') || hasFileExtension('video', extension)) {
    return 'video'
  }
  if (mimeType.startsWith('audio/') || hasFileExtension('audio', extension)) {
    return 'audio'
  }
  return 'file'
}

function getFileExtension(fileName: string | null | undefined) {
  const index = fileName?.lastIndexOf('.') ?? -1
  if (index === -1) return null
  return fileName?.slice(index + 1).toLowerCase() ?? null
}

function hasFileExtension(category: Exclude<FileTypeCategory, 'file'>, extension: string | null) {
  return extension !== null && FILE_TYPE_EXTENSIONS[category].has(extension)
}
