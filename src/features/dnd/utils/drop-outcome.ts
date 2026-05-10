import type { DropRejectionReason } from './drop-rejections'

export type DragDropAction =
  | 'move'
  | 'copy'
  | 'trash'
  | 'restore'
  | 'pin'
  | 'embed'
  | 'open'
  | 'link'

type OperationOutcome = {
  type: 'operation'
  action: DragDropAction
  label: string
  execute: null
}

type RejectionOutcome = {
  type: 'rejection'
  reason: DropRejectionReason
}

export type DropOutcome = OperationOutcome | RejectionOutcome

export function operation(action: DragDropAction, label: string): OperationOutcome {
  if (label.trim().length === 0) {
    throw new Error(`Drop operation label cannot be empty for ${action}`)
  }
  return { type: 'operation', action, label, execute: null }
}

export function rejection(reason: DropRejectionReason): RejectionOutcome {
  return { type: 'rejection', reason }
}
