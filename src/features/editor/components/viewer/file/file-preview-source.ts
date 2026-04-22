const EMPTY_ERRORED_URLS = new Set<string>()

export function resolveFilePreviewImageUrl({
  downloadUrl,
  contentType,
  previewUrl,
  erroredUrls = EMPTY_ERRORED_URLS,
}: {
  downloadUrl: string | null
  contentType: string | null
  previewUrl: string | null
  erroredUrls?: ReadonlySet<string>
}) {
  if (contentType?.startsWith('image/') && downloadUrl && !erroredUrls.has(downloadUrl)) {
    return downloadUrl
  }

  if (previewUrl && !erroredUrls.has(previewUrl)) {
    return previewUrl
  }

  return null
}
