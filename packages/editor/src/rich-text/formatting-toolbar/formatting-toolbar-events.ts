import type { SyntheticEvent } from 'react'

export function preventEditorBlur(event: SyntheticEvent) {
  event.preventDefault()
  event.stopPropagation()
}

export function eventStartedOnToolbarTrigger(event: SyntheticEvent) {
  return (
    event.target instanceof Element &&
    (event.target.closest('[data-slot="dropdown-menu-trigger"]') !== null ||
      event.target.closest('[data-slot="popover-trigger"]') !== null)
  )
}

export function stopPropagation(event: SyntheticEvent) {
  event.stopPropagation()
}
