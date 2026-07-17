import { Upload } from 'lucide-react'
import type { AssetReplacementController } from './asset-replacement'

export function AssetReplacementButton({
  ariaLabel,
  compact,
  compactLabel,
  fullLabel,
  pendingLabel,
  replacement,
}: {
  ariaLabel: string
  compact: boolean
  compactLabel: string
  fullLabel: string
  pendingLabel: string
  replacement: AssetReplacementController
}) {
  return (
    <>
      <button
        type="button"
        className="inline-flex h-8 items-center gap-2 rounded-md border border-border px-3 text-sm hover:bg-muted disabled:opacity-50"
        disabled={replacement.pending}
        onClick={replacement.open}
      >
        <Upload className="size-4" aria-hidden="true" />
        {replacement.pending ? pendingLabel : compact ? compactLabel : fullLabel}
      </button>
      <input
        ref={replacement.input}
        aria-label={ariaLabel}
        className="sr-only"
        disabled={replacement.pending}
        type="file"
        onChange={(event) => {
          const file = event.currentTarget.files?.[0]
          event.currentTarget.value = ''
          if (file) replacement.choose(file)
        }}
      />
    </>
  )
}
