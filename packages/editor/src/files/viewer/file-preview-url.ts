import { isValidFileUrl } from './file-url-validation'
import { getFileTypeCategory } from '../file-type-category'

const EMPTY_ERRORED_URLS = new Set<string>()

export function resolveFilePreviewImageUrl({
  downloadUrl,
  contentType,
  fileName,
  previewUrl,
  erroredUrls = EMPTY_ERRORED_URLS,
}: {
  downloadUrl: string | null
  contentType: string | null
  fileName?: string | null
  previewUrl: string | null
  erroredUrls?: ReadonlySet<string>
}): string | null {
  const validDownloadUrl =
    downloadUrl && isValidFileUrl(downloadUrl) && !erroredUrls.has(downloadUrl)
  const validPreviewUrl = previewUrl && isValidFileUrl(previewUrl) && !erroredUrls.has(previewUrl)

  if (getFileTypeCategory(contentType, fileName) === 'image' && validDownloadUrl) {
    return downloadUrl
  }

  if (validPreviewUrl) {
    return previewUrl
  }

  return null
}
