import { FileText } from 'lucide-react'
import { deriveExternalEmbedName } from 'shared/embeds/embedTargets'
import { MediaEmbedRenderer } from './media-embed-renderer'
import { inferEmbedMediaKindFromUrl } from '../utils/embed-media'
import type { IntrinsicAspectRatioReporter } from '../utils/embed-media'

type ExternalUrlEmbedContentProps = {
  url: string
  name: string | null
  onIntrinsicAspectRatio?: IntrinsicAspectRatioReporter
}

export function ExternalUrlEmbedContent({
  url,
  name,
  onIntrinsicAspectRatio,
}: ExternalUrlEmbedContentProps) {
  const label = name ?? deriveExternalEmbedName(url) ?? url
  const kind = inferEmbedMediaKindFromUrl(url)

  return (
    <MediaEmbedRenderer
      sourceUrl={url}
      label={label}
      kind={kind}
      onIntrinsicAspectRatio={onIntrinsicAspectRatio}
      renderUnknown={() => <ExternalFileLinkCard url={url} label={label} />}
    />
  )
}

function ExternalFileLinkCard({ url, label }: { url: string; label: string }) {
  return (
    <div
      data-testid="external-url-embed-card"
      className="flex h-full min-h-32 w-full items-center justify-center rounded-md border border-border bg-muted/30 p-4 text-center"
    >
      <div className="flex max-w-full flex-col items-center gap-3">
        <FileText className="size-6 text-muted-foreground" aria-hidden />
        <div className="max-w-full truncate text-sm font-medium">{label}</div>
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm text-primary underline-offset-4 hover:underline"
        >
          Open file
        </a>
      </div>
    </div>
  )
}
