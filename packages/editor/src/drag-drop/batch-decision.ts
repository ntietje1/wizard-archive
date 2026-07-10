import type { AnyItem } from '../workspace/items'
import type { DropRejectionReason } from './rejections'
import type { SurfaceDropAction } from './surface-vocabulary'

type DndRejectedItem = {
  item: AnyItem
  reason: DropRejectionReason
}

type DndBatchDecisionCommand = {
  action: SurfaceDropAction
  commandId: string
  items: Array<AnyItem>
  label: string
  rejectedItems: Array<DndRejectedItem>
  status: 'partial' | 'failed'
  target: Record<string, unknown>
}

export type DndBatchDecision = {
  command: DndBatchDecisionCommand
  onConfirm: () => Promise<void>
}
