import type { DropRejectionReason } from './drop-rejections'

type DragDropAction = 'move' | 'copy' | 'trash' | 'restore' | 'pin' | 'embed' | 'open' | 'link'

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
