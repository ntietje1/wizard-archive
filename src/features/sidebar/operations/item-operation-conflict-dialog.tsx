import { useState } from 'react'
import type {
  ConflictDecision,
  ConflictDecisionAction,
  ItemOperationConflict,
} from 'convex/sidebarItems/operations/types'
import { Button } from '~/features/shadcn/components/button'
import { Checkbox } from '~/features/shadcn/components/checkbox'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '~/features/shadcn/components/dialog'

export function ItemOperationConflictDialog({
  conflicts,
  onResolve,
  onCancel,
}: {
  conflicts: Array<ItemOperationConflict>
  onResolve: (
    decisions: Partial<Record<ItemOperationConflict['sourceItemId'], ConflictDecision>>,
  ) => void
  onCancel: () => void
}) {
  const [index, setIndex] = useState(0)
  const [applyToAll, setApplyToAll] = useState(false)
  const [decisions, setDecisions] = useState<
    Partial<Record<ItemOperationConflict['sourceItemId'], ConflictDecision>>
  >({})

  const conflict = conflicts[index]
  if (!conflict) return null

  const choose = (action: ConflictDecisionAction) => {
    if (action === 'cancel') {
      onCancel()
      return
    }

    if (applyToAll) {
      const decisionsForRemaining: Partial<
        Record<ItemOperationConflict['sourceItemId'], ConflictDecision>
      > = {}
      for (const itemConflict of conflicts) {
        if (!(itemConflict.sourceItemId in decisions)) {
          decisionsForRemaining[itemConflict.sourceItemId] = { action }
        }
      }
      const nextDecisions = {
        ...decisions,
        ...decisionsForRemaining,
      }
      onResolve(nextDecisions)
      return
    }

    const nextDecisions = {
      ...decisions,
      [conflict.sourceItemId]: { action },
    }
    if (index >= conflicts.length - 1) {
      onResolve(nextDecisions)
      return
    }
    setDecisions(nextDecisions)
    setIndex((current) => current + 1)
  }

  return (
    <Dialog open={true} onOpenChange={(open) => !open && onCancel()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Replace or Skip Files</DialogTitle>
          <DialogDescription>
            The destination already has an item named {conflict.destinationName}.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 text-sm">
          <div className="rounded-md border p-3">
            <div className="font-medium">{conflict.sourceName}</div>
            <div className="text-muted-foreground">Incoming item</div>
          </div>
          <div className="rounded-md border p-3">
            <div className="font-medium">{conflict.destinationName}</div>
            <div className="text-muted-foreground">Existing item</div>
          </div>
          <div className="flex items-center gap-2">
            <Checkbox
              aria-label="Apply to all remaining conflicts"
              checked={applyToAll}
              onCheckedChange={(checked) => setApplyToAll(checked === true)}
            />
            <span>Apply to all remaining conflicts</span>
          </div>
          <div className="text-xs text-muted-foreground">
            Conflict {index + 1} of {conflicts.length}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <Button variant="default" onClick={() => choose('replace')}>
            Replace
          </Button>
          <Button variant="outline" onClick={() => choose('skip')}>
            Skip
          </Button>
          <Button variant="outline" onClick={() => choose('keepBoth')}>
            Keep Both
          </Button>
          <Button variant="ghost" onClick={() => choose('cancel')}>
            Cancel
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
