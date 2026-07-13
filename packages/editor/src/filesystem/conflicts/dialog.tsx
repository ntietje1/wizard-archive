import { useState } from 'react'
import { Check, CircleSlash, FileText, Files, ListChecks, RefreshCw } from 'lucide-react'
import { isFolderConflict, resolveIncomingConflictDecision } from '../operation-planner'
import type { ConflictDecision, ItemOperationConflict } from '../operation-planner'
import { Button } from '@wizard-archive/ui/shadcn/components/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@wizard-archive/ui/shadcn/components/dialog'
import { ScrollArea } from '@wizard-archive/ui/shadcn/components/scroll-area'
import { cn } from '@wizard-archive/ui/shadcn/lib/utils'
import { DEFAULT_SIDEBAR_ITEM_ICONS } from '../../workspace/sidebar/item-icons'

type ConflictDecisions = Record<ItemOperationConflict['sourceItemId'], ConflictDecision>
type BulkDecisionAction = ConflictDecision['action']
type ConflictRowSelection = {
  incoming: boolean
  existing: boolean
}
type ToggleRowSelection = (
  sourceItemId: ItemOperationConflict['sourceItemId'],
  side: keyof ConflictRowSelection,
) => void

const BULK_ACTIONS: Array<{
  action: BulkDecisionAction | 'per-item'
  singleLabel: string
  multipleLabel: string
  icon: typeof RefreshCw
}> = [
  {
    action: 'replace',
    singleLabel: 'Replace the item in the destination',
    multipleLabel: 'Replace the items in the destination',
    icon: RefreshCw,
  },
  {
    action: 'skip',
    singleLabel: 'Skip this item',
    multipleLabel: 'Skip these items',
    icon: CircleSlash,
  },
  {
    action: 'keepBoth',
    singleLabel: 'Keep both items',
    multipleLabel: 'Keep both items',
    icon: Files,
  },
  {
    action: 'per-item',
    singleLabel: 'Compare each item',
    multipleLabel: 'Decide for each item',
    icon: ListChecks,
  },
]

function incomingDecisionForConflict(conflict: ItemOperationConflict): ConflictDecision {
  return resolveIncomingConflictDecision(conflict)
}

function labelForBulkAction({
  action,
  conflicts,
  isSingleConflict,
  singleLabel,
  multipleLabel,
}: {
  action: BulkDecisionAction | 'per-item'
  conflicts: Array<ItemOperationConflict>
  isSingleConflict: boolean
  singleLabel: string
  multipleLabel: string
}) {
  if (action !== 'replace') return isSingleConflict ? singleLabel : multipleLabel
  const mergeConflictCount = conflicts.filter(isFolderConflict).length
  if (mergeConflictCount === 0) return isSingleConflict ? singleLabel : multipleLabel
  if (mergeConflictCount === conflicts.length) {
    return isSingleConflict
      ? 'Merge with the folder in the destination'
      : 'Merge folders in the destination'
  }
  return isSingleConflict
    ? 'Replace or merge the item in the destination'
    : 'Replace or merge the items in the destination'
}

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

function decisionFromSelection(
  conflict: ItemOperationConflict,
  selection: ConflictRowSelection,
): ConflictDecision | null {
  if (selection.incoming && selection.existing) return { action: 'keepBoth' }
  if (selection.incoming) return incomingDecisionForConflict(conflict)
  if (selection.existing) return { action: 'skip' }
  return null
}

function ConflictChoiceButton({
  pressed,
  label,
  name,
  Icon,
  onClick,
}: {
  pressed: boolean
  label: string
  name: string
  Icon: typeof FileText
  onClick: () => void
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      aria-pressed={pressed}
      aria-label={label}
      className={cn(
        'grid h-auto min-h-16 w-full grid-cols-[auto_1fr_auto] items-center gap-2 border border-border p-3 text-left whitespace-normal',
        pressed && 'border-primary bg-primary/20 text-foreground hover:bg-primary/25',
      )}
      onClick={onClick}
    >
      <Icon className="size-4 text-current" />
      <span className="truncate">{name}</span>
      <span
        aria-hidden="true"
        className={cn(
          'grid size-4 place-items-center rounded-sm border',
          pressed
            ? 'border-primary bg-primary text-primary-foreground'
            : 'border-muted-foreground/40 bg-background',
        )}
      >
        {pressed ? <Check className="size-3" /> : null}
      </span>
    </Button>
  )
}

function ConflictChoiceRow({
  conflict,
  selection,
  onToggle,
}: {
  conflict: ItemOperationConflict
  selection: ConflictRowSelection
  onToggle: ToggleRowSelection
}) {
  const SourceIcon = DEFAULT_SIDEBAR_ITEM_ICONS[conflict.sourceType] ?? FileText
  const DestinationIcon = DEFAULT_SIDEBAR_ITEM_ICONS[conflict.destinationType] ?? FileText
  return (
    <tr>
      <td className="w-1/2 p-2 align-top">
        <ConflictChoiceButton
          pressed={selection.incoming}
          label={`Use incoming ${conflict.sourceName}`}
          name={conflict.sourceName}
          Icon={SourceIcon}
          onClick={() => onToggle(conflict.sourceItemId, 'incoming')}
        />
      </td>
      <td className="w-1/2 p-2 align-top">
        <ConflictChoiceButton
          pressed={selection.existing}
          label={`Use existing ${conflict.destinationName}`}
          name={conflict.destinationName}
          Icon={DestinationIcon}
          onClick={() => onToggle(conflict.sourceItemId, 'existing')}
        />
      </td>
    </tr>
  )
}

function ConflictChoicesTable({
  conflicts,
  rowSelections,
  onToggle,
}: {
  conflicts: Array<ItemOperationConflict>
  rowSelections: Record<ItemOperationConflict['sourceItemId'], ConflictRowSelection>
  onToggle: ToggleRowSelection
}) {
  return (
    <table className="w-full border-collapse" aria-label="Conflict choices">
      <thead>
        <tr className="text-left text-xs text-muted-foreground">
          <th className="px-2 pb-2 font-medium">Incoming</th>
          <th className="px-2 pb-2 font-medium">Existing</th>
        </tr>
      </thead>
      <tbody className="divide-y">
        {conflicts.map((conflict) => (
          <ConflictChoiceRow
            key={conflict.sourceItemId}
            conflict={conflict}
            selection={rowSelections[conflict.sourceItemId] ?? { incoming: false, existing: false }}
            onToggle={onToggle}
          />
        ))}
      </tbody>
    </table>
  )
}

function BulkConflictActions({
  conflicts,
  onBulkDecision,
  onPerItem,
}: {
  conflicts: Array<ItemOperationConflict>
  onBulkDecision: (action: BulkDecisionAction) => void
  onPerItem: () => void
}) {
  const isSingleConflict = conflicts.length === 1
  return (
    <div className="grid grid-cols-1 gap-3">
      {BULK_ACTIONS.map((action) => {
        const Icon = action.icon
        const label = labelForBulkAction({
          action: action.action,
          conflicts,
          isSingleConflict,
          singleLabel: action.singleLabel,
          multipleLabel: action.multipleLabel,
        })
        return (
          <Button
            key={action.action}
            aria-label={label}
            variant={action.action === 'replace' ? 'default' : 'outline'}
            className="h-auto min-h-14 justify-start gap-3 p-4 text-left whitespace-normal"
            onClick={() =>
              action.action === 'per-item' ? onPerItem() : onBulkDecision(action.action)
            }
          >
            <Icon className="size-5" />
            <span className="font-medium">{label}</span>
          </Button>
        )
      })}
    </div>
  )
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
  const [mode, setMode] = useState<'bulk' | 'per-item'>('bulk')
  const [rowSelections, setRowSelections] = useState(() => createInitialSelections(conflicts))

  const conflict = conflicts[0]
  if (!conflict) return null
  const isSingleConflict = conflicts.length === 1
  const conflictDescription = isSingleConflict
    ? `There is already an item with the name "${conflict.destinationName}" in this destination.`
    : `${conflicts.length} items have names that already exist in this destination. Select which ones to keep.`

  const applyBulkDecision = (action: BulkDecisionAction) => {
    const nextDecisions: ConflictDecisions = {}
    for (const itemConflict of conflicts) {
      nextDecisions[itemConflict.sourceItemId] =
        action === 'replace' ? incomingDecisionForConflict(itemConflict) : { action }
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
        itemConflict,
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
    setRowSelections(createInitialSelections(conflicts))
    setMode('bulk')
  }

  return (
    <Dialog open={true} onOpenChange={(open) => !open && onCancel()}>
      <DialogContent className={mode === 'per-item' ? 'max-w-3xl' : 'max-w-lg'}>
        <DialogHeader>
          <DialogTitle>
            {isSingleConflict ? 'Resolve Name Conflict' : 'Resolve Name Conflicts'}
          </DialogTitle>
          <DialogDescription>{conflictDescription}</DialogDescription>
        </DialogHeader>

        {mode === 'bulk' ? (
          <BulkConflictActions
            conflicts={conflicts}
            onBulkDecision={applyBulkDecision}
            onPerItem={() => setMode('per-item')}
          />
        ) : (
          <>
            <div className="text-sm">
              {conflicts.length >= 4 ? (
                <ScrollArea style={{ height: 'min(18rem, calc(100vh - 16rem))' }}>
                  <ConflictChoicesTable
                    conflicts={conflicts}
                    rowSelections={rowSelections}
                    onToggle={toggleRowSelection}
                  />
                </ScrollArea>
              ) : (
                <ConflictChoicesTable
                  conflicts={conflicts}
                  rowSelections={rowSelections}
                  onToggle={toggleRowSelection}
                />
              )}
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
