import { Ban } from 'lucide-react'
import { rejectionReasonMessage } from '~/features/dnd/utils/drop-rejections'
import { cn } from '~/features/shadcn/lib/utils'
import type { DropOutcome } from '~/features/dnd/utils/drop-outcome'

export function MapDropFeedbackOverlay({ outcome }: { outcome: DropOutcome | null }) {
  if (!outcome) return null

  return (
    <>
      <div
        className={cn(
          'absolute inset-0 z-[998] ring-2 ring-offset-2 pointer-events-none',
          outcome.type === 'operation' ? 'ring-ring' : 'ring-destructive',
        )}
      />
      <div
        className={cn(
          'absolute top-4 left-1/2 -translate-x-1/2 z-[2000] px-4 py-2 rounded-md shadow-lg',
          outcome.type === 'operation'
            ? 'bg-primary text-primary-foreground'
            : 'bg-destructive text-destructive-foreground',
        )}
      >
        <p className="text-sm font-medium flex items-center gap-1.5">
          {outcome.type === 'rejection' && <Ban className="size-4 shrink-0" />}
          {outcome.type === 'operation'
            ? 'Release to place pin here'
            : rejectionReasonMessage(outcome.reason)}
        </p>
      </div>
    </>
  )
}
