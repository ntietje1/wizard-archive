import type { MenuRoot } from '@base-ui/react/menu'

export interface BlockTypeMenuChangeDetails {
  event: Event
  reason: MenuRoot.ChangeEventReason
}

interface BlockTypeMenuState {
  open: boolean
  ignoreOpeningClickClose: boolean
}

export function getNextBlockTypeMenuState({
  ignoreOpeningClickClose,
  nextOpen,
  details,
}: {
  ignoreOpeningClickClose: boolean
  nextOpen: boolean
  details: BlockTypeMenuChangeDetails
}): BlockTypeMenuState {
  if (nextOpen) {
    return {
      open: true,
      ignoreOpeningClickClose:
        details.reason === 'trigger-press' && details.event.type === 'mousedown',
    }
  }

  if (
    details.reason === 'trigger-press' &&
    details.event.type === 'click' &&
    ignoreOpeningClickClose
  ) {
    return {
      open: true,
      ignoreOpeningClickClose: false,
    }
  }

  return {
    open: false,
    ignoreOpeningClickClose: false,
  }
}
