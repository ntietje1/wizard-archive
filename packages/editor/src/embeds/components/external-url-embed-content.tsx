import { FileText } from 'lucide-react'
import { deriveExternalEmbedName, inferExternalEmbedMediaKind } from 'shared/embeds/embedTargets'
import { MediaEmbedRenderer } from './media-embed-renderer'
import type { EmbedMediaLayoutReporter } from '../utils/media'

type ExternalUrlEmbedContentProps = {
  url: string
  name: string | null
  allowInnerScroll?: boolean
  onMediaLayout?: EmbedMediaLayoutReporter
}

export function ExternalUrlEmbedContent({
  url,
  name,
  allowInnerScroll = true,
  onMediaLayout,
}: ExternalUrlEmbedContentProps) {
  const label = name ?? deriveExternalEmbedName(url) ?? url
  const kind = inferExternalEmbedMediaKind(url)
  const externalFileLinkUrl = getSafeExternalFileLinkUrl(url)

  return (
    <MediaEmbedRenderer
      sourceUrl={url}
      label={label}
      kind={kind}
      allowInnerScroll={allowInnerScroll}
      onMediaLayout={onMediaLayout}
      renderUnknown={() => <ExternalFileLinkCard url={externalFileLinkUrl} label={label} />}
    />
  )
}

function ExternalFileLinkCard({ url, label }: { url: string | null; label: string }) {
  return (
    <div
      data-testid="external-url-embed-card"
      className="flex h-full min-h-32 w-full items-center justify-center text-center"
    >
      <div className="flex max-w-full flex-col items-center gap-3">
        <FileText className="size-6 text-muted-foreground" aria-hidden />
        <div className="max-w-full truncate text-sm font-medium">{label}</div>
        {url ? (
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-primary underline-offset-4 hover:underline"
          >
            Open file
          </a>
        ) : (
          <span role="status" className="text-sm text-muted-foreground">
            Link unavailable
          </span>
        )}
      </div>
    </div>
  )
}

function getSafeExternalFileLinkUrl(url: string): string | null {
  try {
    const parsed = new URL(url)
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null
    return parsed.href
  } catch {
    return null
  }
}
