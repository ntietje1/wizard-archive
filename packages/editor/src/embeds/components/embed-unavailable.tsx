import { AlertTriangle } from 'lucide-react'
import { RequestAccessButton } from '@wizard-archive/ui/components/request-access-button'
import type { PreviewFallbackReason } from '../../previews/fallback-policy'
import { getPreviewFallbackCopy } from '../../previews/fallback-policy'

type EmbedUnavailableReason =
  | 'missing'
  | 'permission'
  | 'trashed'
  | 'invalidExternalUrl'
  | 'recursive'
  | 'unavailable'
  | 'unsupported'

type EmbedUnavailableProps = {
  reason: EmbedUnavailableReason
  label?: string
}

const PREVIEW_FALLBACK_REASON_BY_EMBED_REASON: Record<
  EmbedUnavailableReason,
  PreviewFallbackReason
> = {
  invalidExternalUrl: 'unsupportedExternalUrl',
  missing: 'missing',
  permission: 'permission',
  recursive: 'recursive',
  trashed: 'trashed',
  unavailable: 'unavailableContentProvider',
  unsupported: 'unsupportedFileType',
}

export function EmbedUnavailable({ reason, label }: EmbedUnavailableProps) {
  const message = getPreviewFallbackCopy({
    surface: 'embed',
    reason: PREVIEW_FALLBACK_REASON_BY_EMBED_REASON[reason],
  })
  const liveRole = reason === 'permission' ? 'alert' : 'status'

  return (
    <div
      role={liveRole}
      className="flex h-full min-h-24 w-full items-center justify-center p-4 text-center text-muted-foreground"
    >
      <div className="flex max-w-full flex-col items-center gap-2">
        <AlertTriangle className="size-4" aria-hidden />
        <div className="max-w-full truncate text-sm font-medium">{label ?? message}</div>
        {label ? <div className="text-xs">{message}</div> : null}
        {reason === 'permission' ? <RequestAccessButton /> : null}
      </div>
    </div>
  )
}
