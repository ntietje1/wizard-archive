import { useEffect, useState } from 'react'
import { Check, CircleSlash, Files, ListChecks, RefreshCw } from 'lucide-react'
import type {
  ConflictDecision,
  ConflictDecisionAction,
  ItemOperationConflict,
} from 'convex/sidebarItems/operations/types'
import { Button } from '~/features/shadcn/components/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '~/features/shadcn/components/dialog'
import { ScrollArea } from '~/features/shadcn/components/scroll-area'
import { cn } from '~/features/shadcn/lib/utils'
import { DEFAULT_SIDEBAR_ITEM_ICONS } from '~/shared/utils/category-icons'

type ConflictDecisions = Partial<Record<ItemOperationConflict['sourceItemId'], ConflictDecision>>
type BulkDecisionAction = Exclude<ConflictDecisionAction, 'cancel'>
type ConflictRowSelection = {
  incoming: boolean
  existing: boolean
}

const BULK_ACTIONS: Array<{
  action: BulkDecisionAction | 'per-item'
  label: string
  icon: typeof RefreshCw
}> = [
  {
    action: 'replace',
    label: 'Replace the items in the destination',
    icon: RefreshCw,
  },
  {
    action: 'skip',
    label: 'Skip these items',
    icon: CircleSlash,
  },
  {
    action: 'keepBoth',
    label: 'Keep both items',
    icon: Files,
  },
  {
    action: 'per-item',
    label: 'Decide for each item',
    icon: ListChecks,
  },
]

function createInitialSelections(conflicts: Array<ItemOperationConflict>) {
  const selections: Record<ItemOperationConflict['sourceItemId'], ConflictRowSelection> = {}
  for (const conflict of conflicts) {
    selections[conflict.sourceItemId] = {
      incoming: false,
      existing: false,
    }
  }
  return selections
}

function decisionFromSelection(selection: ConflictRowSelection): ConflictDecision | null {
  if (selection.incoming && selection.existing) return { action: 'keepBoth' }
  if (selection.incoming) return { action: 'replace' }
  if (selection.existing) return { action: 'skip' }
  return null
}

export function ItemOperationConflictDialog({
  conflicts,
  onResolve,
  onCancel,
}: {
  conflicts: Array<ItemOperationConflict>
  onResolve: (decisions: ConflictDecisions) => void
  onCancel: () => void
}) {
  const [mode, setMode] = useState<'bulk' | 'per-item'>(() =>
    conflicts.length > 1 ? 'bulk' : 'per-item',
  )
  const [rowSelections, setRowSelections] = useState(() => createInitialSelections(conflicts))

  useEffect(() => {
    if (conflicts.length === 0) onResolve({})
  }, [conflicts.length, onResolve])

  useEffect(() => {
    setRowSelections((current) => {
      const nextSelections = createInitialSelections(conflicts)
      for (const itemConflict of conflicts) {
        const existingSelection = current[itemConflict.sourceItemId]
        if (existingSelection) nextSelections[itemConflict.sourceItemId] = existingSelection
      }
      return nextSelections
    })
  }, [conflicts])

  const conflict = conflicts[0]
  if (!conflict) return null
  const hasBulkScreen = conflicts.length > 1
  const visibleMode = hasBulkScreen ? mode : 'per-item'
  const conflictDescription =
    conflicts.length === 1
      ? `The destination already has an item named ${conflict.destinationName}. Select one or both to keep.`
      : `${conflicts.length} items have names that already exist in this destination. Select which ones to keep.`
  const bulkActions = hasBulkScreen
    ? BULK_ACTIONS
    : BULK_ACTIONS.filter((action) => action.action !== 'per-item')
  const conflictListHeight = `min(${Math.min(conflicts.length * 5, 24)}rem, calc(100vh - 16rem))`

  const applyBulkDecision = (action: BulkDecisionAction) => {
    const nextDecisions: ConflictDecisions = {}
    for (const itemConflict of conflicts) {
      nextDecisions[itemConflict.sourceItemId] = { action }
    }
    onResolve(nextDecisions)
  }

  const toggleRowSelection = (
    sourceItemId: ItemOperationConflict['sourceItemId'],
    side: keyof ConflictRowSelection,
  ) => {
    setRowSelections((current) => ({
      ...current,
      [sourceItemId]: {
        ...(current[sourceItemId] ?? { incoming: false, existing: false }),
        [side]: !(current[sourceItemId]?.[side] ?? false),
      },
    }))
  }

  const buildPerItemDecisions = (): ConflictDecisions | null => {
    const nextDecisions: ConflictDecisions = {}
    for (const itemConflict of conflicts) {
      const decision = decisionFromSelection(
        rowSelections[itemConflict.sourceItemId] ?? { incoming: false, existing: false },
      )
      if (!decision) return null
      nextDecisions[itemConflict.sourceItemId] = decision
    }
    return nextDecisions
  }

  const perItemDecisions = buildPerItemDecisions()
  const canContinue = perItemDecisions !== null

  const continuePerItemDecisions = () => {
    if (perItemDecisions) onResolve(perItemDecisions)
  }

  const cancelPerItemDecisions = () => {
    if (hasBulkScreen) {
      setMode('bulk')
      return
    }
    onCancel()
  }

  return (
    <Dialog open={true} onOpenChange={(open) => !open && onCancel()}>
      <DialogContent className={visibleMode === 'per-item' ? 'max-w-3xl' : 'max-w-lg'}>
        <DialogHeader>
          <DialogTitle>Resolve File Conflict</DialogTitle>
          <DialogDescription>{conflictDescription}</DialogDescription>
        </DialogHeader>

        {visibleMode === 'bulk' ? (
          <>
            <div className="grid grid-cols-1 gap-3">
              {bulkActions.map((action) => {
                const Icon = action.icon
                return (
                  <Button
                    key={action.action}
                    aria-label={action.label}
                    variant={action.action === 'replace' ? 'default' : 'outline'}
                    className="h-auto min-h-14 justify-start gap-3 p-4 text-left whitespace-normal"
                    onClick={() =>
                      action.action === 'per-item'
                        ? setMode('per-item')
                        : applyBulkDecision(action.action)
                    }
                  >
                    <Icon className="size-5" />
                    <span className="font-medium">{action.label}</span>
                  </Button>
                )
              })}
            </div>
          </>
        ) : (
          <>
            <div role="table" aria-label="Conflict choices" className="space-y-2 text-sm">
              <div role="row" className="grid grid-cols-2 gap-2 px-1 text-xs text-muted-foreground">
                <div role="columnheader">Incoming</div>
                <div role="columnheader">Existing</div>
              </div>
              <ScrollArea style={{ height: conflictListHeight }}>
                <div className="divide-y">
                  {conflicts.map((itemConflict) => {
                    const selection = rowSelections[itemConflict.sourceItemId] ?? {
                      incoming: false,
                      existing: false,
                    }
                    const SourceIcon = DEFAULT_SIDEBAR_ITEM_ICONS[itemConflict.sourceType]
                    const DestinationIcon = DEFAULT_SIDEBAR_ITEM_ICONS[itemConflict.destinationType]
                    return (
                      <div
                        role="row"
                        key={itemConflict.sourceItemId}
                        className="grid grid-cols-2 gap-2 p-2"
                      >
                        <div role="cell">
                          <Button
                            type="button"
                            variant="ghost"
                            aria-pressed={selection.incoming}
                            aria-label={`Use incoming ${itemConflict.sourceName}`}
                            className={cn(
                              'grid h-auto min-h-16 w-full grid-cols-[auto_1fr_auto] items-center gap-2 border border-border p-3 text-left whitespace-normal',
                              selection.incoming &&
                                '!border-primary !bg-primary/20 text-foreground hover:!bg-primary/25',
                            )}
                            onClick={() =>
                              toggleRowSelection(itemConflict.sourceItemId, 'incoming')
                            }
                          >
                            <SourceIcon className="size-4 text-current" />
                            <span className="truncate">{itemConflict.sourceName}</span>
                            <span
                              aria-hidden="true"
                              className={cn(
                                'grid size-4 place-items-center rounded-sm border',
                                selection.incoming
                                  ? 'border-primary bg-primary text-primary-foreground'
                                  : 'border-muted-foreground/40 bg-background',
                              )}
                            >
                              {selection.incoming ? <Check className="size-3" /> : null}
                            </span>
                          </Button>
                        </div>
                        <div role="cell">
                          <Button
                            type="button"
                            variant="ghost"
                            aria-pressed={selection.existing}
                            aria-label={`Use existing ${itemConflict.destinationName}`}
                            className={cn(
                              'grid h-auto min-h-16 w-full grid-cols-[auto_1fr_auto] items-center gap-2 border border-border p-3 text-left whitespace-normal',
                              selection.existing &&
                                '!border-primary !bg-primary/20 text-foreground hover:!bg-primary/25',
                            )}
                            onClick={() =>
                              toggleRowSelection(itemConflict.sourceItemId, 'existing')
                            }
                          >
                            <DestinationIcon className="size-4 text-current" />
                            <span className="truncate">{itemConflict.destinationName}</span>
                            <span
                              aria-hidden="true"
                              className={cn(
                                'grid size-4 place-items-center rounded-sm border',
                                selection.existing
                                  ? 'border-primary bg-primary text-primary-foreground'
                                  : 'border-muted-foreground/40 bg-background',
                              )}
                            >
                              {selection.existing ? <Check className="size-3" /> : null}
                            </span>
                          </Button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </ScrollArea>
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={cancelPerItemDecisions}>
                Cancel
              </Button>
              <Button
                aria-label="Apply selected conflict choices"
                onClick={continuePerItemDecisions}
                disabled={!canContinue}
              >
                Apply Choices
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
