export interface BlockTypeMenuChangeDetails {
  event: Event
  reason: string
}

interface BlockTypeMenuState {
  ignoreOpeningClickClose: boolean
  open: boolean
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
    // Opening starts on pointer/mouse down; ignore the follow-up click that would close it.
    return {
      open: true,
      ignoreOpeningClickClose:
        details.reason === 'trigger-press' &&
        (details.event.type === 'mousedown' || details.event.type === 'pointerdown'),
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
