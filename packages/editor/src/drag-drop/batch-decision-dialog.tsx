import { useRef, useState } from 'react'
import { AlertTriangle } from 'lucide-react'
import { Button } from '@wizard-archive/ui/shadcn/components/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@wizard-archive/ui/shadcn/components/dialog'
import { rejectionReasonMessage } from './rejections'
import { handleError } from '../errors/handle-error'
import { useDndStore, useDndStoreApi } from './store'
import type { DndBatchDecision } from './batch-decision'
import type { SurfaceDropAction } from './surface-vocabulary'
import { assertNever } from './exhaustiveness'

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
    case 'noteEmbed':
      return 'Continue embedding items'
    default:
      return assertNever(action)
  }
}

function operationVerb(action: SurfaceDropAction) {
  switch (action) {
    case 'pin':
      return 'pinned'
    case 'link':
      return 'linked'
    case 'embed':
    case 'noteEmbed':
      return 'embedded'
    default:
      return assertNever(action)
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
  const dndStore = useDndStoreApi()
  const decision = useDndStore((s) => s.batchDecision)
  const setBatchDecision = useDndStore((s) => s.setBatchDecision)
  const [submittingDecision, setSubmittingDecision] = useState<DndBatchDecision | null>(null)
  const submittingRef = useRef(false)

  if (!decision) return null

  const { command } = decision
  const isSubmitting = submittingDecision === decision
  const acceptedCount = command.items.length
  const rejectedCount = command.rejectedItems.length
  const title = getBatchDecisionTitle({
    action: command.action,
    acceptedCount,
    rejectedCount,
  })
  const confirmLabel = continueButtonLabel(command.action)

  const cancel = () => {
    if (isSubmitting) return
    setBatchDecision(null)
  }
  const confirm = async () => {
    if (acceptedCount === 0) {
      cancel()
      return
    }
    if (submittingRef.current) return
    submittingRef.current = true
    setSubmittingDecision(decision)
    try {
      await decision.onConfirm()
      if (dndStore.getState().batchDecision === decision) {
        setBatchDecision(null)
      }
    } catch (error) {
      handleError(error, 'Failed to drop items')
    } finally {
      submittingRef.current = false
      setSubmittingDecision((current) => (current === decision ? null : current))
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
            <div key={item.id} className="rounded-md border p-3">
              <div className="font-medium">{item.name}</div>
              <div className="text-feedback-warning flex items-center gap-1">
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
