import { useSyncExternalStore } from 'react'

let shiftPressed = false
const subscribers = new Set<() => void>()

function notifySubscribers() {
  for (const subscriber of subscribers) {
    subscriber()
  }
}

function handleShiftDown(event: KeyboardEvent) {
  if (event.key === 'Shift' && !shiftPressed) {
    shiftPressed = true
    notifySubscribers()
  }
}

function handleShiftUp(event: KeyboardEvent) {
  if (event.key === 'Shift' && shiftPressed) {
    shiftPressed = false
    notifySubscribers()
  }
}

function handleWindowBlur() {
  if (shiftPressed) {
    shiftPressed = false
    notifySubscribers()
  }
}

function handleVisibilityChange() {
  if (document.visibilityState !== 'visible' && shiftPressed) {
    shiftPressed = false
    notifySubscribers()
  }
}

function subscribe(onStoreChange: () => void) {
  if (subscribers.size === 0) {
    window.addEventListener('keydown', handleShiftDown)
    window.addEventListener('keyup', handleShiftUp)
    window.addEventListener('blur', handleWindowBlur)
    document.addEventListener('visibilitychange', handleVisibilityChange)
  }

  subscribers.add(onStoreChange)

  return () => {
    subscribers.delete(onStoreChange)
    if (subscribers.size === 0) {
      window.removeEventListener('keydown', handleShiftDown)
      window.removeEventListener('keyup', handleShiftUp)
      window.removeEventListener('blur', handleWindowBlur)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }
}

function getSnapshot() {
  return shiftPressed
}

function getServerSnapshot() {
  return false
}

export function useShiftKeyPressed() {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
}
