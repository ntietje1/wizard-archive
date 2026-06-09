import { AlertTriangle } from 'lucide-react'
import { RequestAccessButton } from '~/features/sidebar/components/request-access-button'

type EmbedUnavailableReason =
  | 'missing'
  | 'permission'
  | 'trashed'
  | 'invalidExternalUrl'
  | 'recursive'
  | 'unsupported'

type EmbedUnavailableProps = {
  reason: EmbedUnavailableReason
  label?: string
}

const MESSAGE_BY_REASON: Record<EmbedUnavailableReason, string> = {
  missing: 'Embedded item unavailable',
  permission: "This embedded item isn't shared with you",
  trashed: 'Embedded item is in the trash',
  invalidExternalUrl: 'External file link is invalid',
  recursive: 'Recursive embed hidden',
  unsupported: 'This file type cannot be previewed',
}

export function EmbedUnavailable({ reason, label }: EmbedUnavailableProps) {
  return (
    <div className="flex h-full min-h-24 w-full items-center justify-center p-4 text-center text-muted-foreground">
      <div className="flex max-w-full flex-col items-center gap-2">
        <AlertTriangle className="size-4" aria-hidden />
        <div className="max-w-full truncate text-sm font-medium">
          {label ?? MESSAGE_BY_REASON[reason]}
        </div>
        {label ? <div className="text-xs">{MESSAGE_BY_REASON[reason]}</div> : null}
        {reason === 'permission' ? <RequestAccessButton /> : null}
      </div>
    </div>
  )
}
