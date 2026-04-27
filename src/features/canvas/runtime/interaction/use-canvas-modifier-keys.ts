import { useEffect, useMemo } from 'react'
import { isPrimarySelectionModifier } from '../../utils/canvas-selection-utils'

type CanvasModifierKeyState = {
  primaryPressed: boolean
  shiftPressed: boolean
}

type CanvasModifierKeyReader = CanvasModifierKeyState

let listenerCount = 0
let modifierKeyState: CanvasModifierKeyState = {
  primaryPressed: false,
  shiftPressed: false,
}

export function useCanvasModifierKeys(): CanvasModifierKeyReader {
  useEffect(() => {
    subscribeCanvasModifierKeys()
    return unsubscribeCanvasModifierKeys
  }, [])

  return useMemo(
    () => ({
      get primaryPressed() {
        return modifierKeyState.primaryPressed
      },
      get shiftPressed() {
        return modifierKeyState.shiftPressed
      },
    }),
    [],
  )
}

function subscribeCanvasModifierKeys() {
  if (listenerCount === 0) {
    window.addEventListener('keydown', updateModifierKeysFromEvent)
    window.addEventListener('keyup', updateModifierKeysFromEvent)
    window.addEventListener('blur', clearModifierKeys)
  }
  listenerCount += 1
}

function unsubscribeCanvasModifierKeys() {
  if (import.meta.env.DEV && listenerCount <= 0) {
    console.warn('Canvas modifier listenerCount unsubscribe mismatch')
  }
  listenerCount = Math.max(0, listenerCount - 1)
  if (listenerCount > 0) {
    return
  }

  window.removeEventListener('keydown', updateModifierKeysFromEvent)
  window.removeEventListener('keyup', updateModifierKeysFromEvent)
  window.removeEventListener('blur', clearModifierKeys)
  clearModifierKeys()
}

function updateModifierKeysFromEvent(event: KeyboardEvent) {
  modifierKeyState = {
    primaryPressed: isPrimarySelectionModifier({
      ctrlKey: event.ctrlKey,
      metaKey: event.metaKey,
    }),
    shiftPressed: event.shiftKey,
  }
}

function clearModifierKeys() {
  modifierKeyState = {
    primaryPressed: false,
    shiftPressed: false,
  }
}
