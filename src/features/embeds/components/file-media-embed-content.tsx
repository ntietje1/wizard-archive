import { FilePreview } from '~/features/editor/components/viewer/file/file-preview'
import { OtherFileViewer } from '~/features/editor/components/viewer/file/other-file-viewer'
import { MediaEmbedRenderer } from './media-embed-renderer'
import { inferEmbedMediaKindFromContentType } from '../utils/embed-media'
import type { EmbedMediaLayoutReporter } from '../utils/embed-media'

type FileMediaEmbedContentProps = {
  downloadUrl: string | null
  contentType: string | null
  previewUrl: string | null
  name: string
  onMediaLayout?: EmbedMediaLayoutReporter
}

export function FileMediaEmbedContent({
  downloadUrl,
  contentType,
  previewUrl,
  name,
  onMediaLayout,
}: FileMediaEmbedContentProps) {
  const kind = inferEmbedMediaKindFromContentType(contentType)

  if (!downloadUrl) {
    return (
      <FilePreview
        downloadUrl={downloadUrl}
        contentType={contentType}
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
      onMediaLayout={onMediaLayout}
      renderUnknown={() => <OtherFileViewer fileUrl={downloadUrl} fileName={name} />}
    />
  )
}
