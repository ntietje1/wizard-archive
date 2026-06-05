import { useState } from 'react'
import { AlertTriangle } from 'lucide-react'
import { Button } from '~/features/shadcn/components/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '~/features/shadcn/components/dialog'
import { rejectionReasonMessage } from '~/features/dnd/utils/drop-rejections'
import { handleError } from '~/shared/utils/logger'
import { useDndStore } from '~/features/dnd/stores/dnd-store'
import type { SurfaceDropAction } from '~/features/dnd/utils/surface-drop-vocabulary'

function pluralize(count: number, singular: string, plural = `${singular}s`) {
  return `${count} ${count === 1 ? singular : plural}`
}

function continueButtonLabel(action: SurfaceDropAction) {
  switch (action) {
    case 'pin':
      return 'Continue pinning items'
    case 'link':
      return 'Continue adding links'
    case 'embed':
      return 'Continue embedding items'
  }
}

function operationVerb(action: SurfaceDropAction) {
  switch (action) {
    case 'pin':
      return 'pinned'
    case 'link':
      return 'linked'
    case 'embed':
      return 'embedded'
  }
}

function blockedOperationText(action: SurfaceDropAction) {
  return `No items can be ${operationVerb(action)} here`
}

function getBatchDecisionTitle({
  action,
  acceptedCount,
  rejectedCount,
}: {
  action: SurfaceDropAction
  acceptedCount: number
  rejectedCount: number
}) {
  if (acceptedCount === 0) {
    return blockedOperationText(action)
  }
  return `${pluralize(acceptedCount, 'item')} can be ${operationVerb(action)} and ${pluralize(
    rejectedCount,
    'item',
  )} cannot`
}

export function DndBatchDecisionDialog() {
  const decision = useDndStore((s) => s.batchDecision)
  const setBatchDecision = useDndStore((s) => s.setBatchDecision)
  const [isSubmitting, setIsSubmitting] = useState(false)

  if (!decision) return null

  const { command } = decision
  const acceptedCount = command.items.length
  const rejectedCount = command.rejectedItems.length
  const title = getBatchDecisionTitle({
    action: command.action,
    acceptedCount,
    rejectedCount,
  })
  const confirmLabel = continueButtonLabel(command.action)

  const cancel = () => setBatchDecision(null)
  const confirm = async () => {
    if (acceptedCount === 0) {
      cancel()
      return
    }
    setIsSubmitting(true)
    try {
      await decision.onConfirm()
      setBatchDecision(null)
    } catch (error) {
      handleError(error, 'Failed to drop items')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={true} onOpenChange={(open) => !open && cancel()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>

        <div className="max-h-72 overflow-auto space-y-2 text-sm">
          {command.rejectedItems.map(({ item, reason }) => (
            <div key={item._id} className="rounded-md border p-3">
              <div className="font-medium">{item.name}</div>
              <div className="text-amber-600 dark:text-amber-400 flex items-center gap-1">
                <AlertTriangle className="size-3" aria-hidden="true" />
                {rejectionReasonMessage(reason)}
              </div>
            </div>
          ))}
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={cancel} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button
            aria-label={confirmLabel}
            onClick={confirm}
            disabled={isSubmitting || acceptedCount === 0}
          >
            <span>Continue</span>
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
