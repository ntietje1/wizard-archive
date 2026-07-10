import { MediaEmbedRenderer } from '../../embeds/components/media-embed-renderer'
import { getFileTypeCategory } from '../file-type-category'
import { FilePreview } from './file-preview'
import { OtherFileViewer } from './other-file-viewer'
import type { EmbedMediaKind, EmbedMediaLayoutReporter } from '../../embeds/utils/media'

type FileMediaEmbedContentProps = {
  downloadUrl: string | null
  contentType: string | null
  previewUrl: string | null
  name: string
  allowInnerScroll?: boolean
  onMediaLayout?: EmbedMediaLayoutReporter
}

export function FileMediaEmbedContent({
  downloadUrl,
  contentType,
  previewUrl,
  name,
  allowInnerScroll = true,
  onMediaLayout,
}: FileMediaEmbedContentProps) {
  const kind = getEmbedMediaKind(contentType, name)

  if (!downloadUrl) {
    return (
      <FilePreview
        downloadUrl={downloadUrl}
        contentType={contentType}
        fileName={name}
        previewUrl={previewUrl}
        alt={name}
      />
    )
  }

  return (
    <MediaEmbedRenderer
      sourceUrl={downloadUrl}
      label={name}
      kind={kind}
      allowInnerScroll={allowInnerScroll}
      onMediaLayout={onMediaLayout}
      renderUnknown={() => <OtherFileViewer fileUrl={downloadUrl} fileName={name} />}
    />
  )
}

function getEmbedMediaKind(
  contentType: string | null | undefined,
  name: string | null | undefined,
): EmbedMediaKind {
  const category = getFileTypeCategory(contentType, name)
  return category === 'file' ? 'unknown' : category
}
