import { useKeyHold } from '@tanstack/react-hotkeys'
import { useEffect, useRef } from 'react'
import { isPrimarySelectionModifier } from '../../utils/canvas-selection-utils'

export function useCanvasModifierKeys() {
  const shiftPressed = useKeyHold('Shift')
  const modifiersRef = useRef({
    shiftPressed: false,
    primaryPressed: false,
  })

  modifiersRef.current.shiftPressed = shiftPressed

  useEffect(() => {
    const updatePrimaryPressed = (event: KeyboardEvent) => {
      if (event.key !== 'Control' && event.key !== 'Meta') {
        return
      }

      modifiersRef.current.primaryPressed = isPrimarySelectionModifier({
        ctrlKey: event.ctrlKey,
        metaKey: event.metaKey,
      })
    }

    const clearPrimaryPressed = () => {
      modifiersRef.current.primaryPressed = false
    }

    window.addEventListener('keydown', updatePrimaryPressed)
    window.addEventListener('keyup', updatePrimaryPressed)
    window.addEventListener('blur', clearPrimaryPressed)
    return () => {
      window.removeEventListener('keydown', updatePrimaryPressed)
      window.removeEventListener('keyup', updatePrimaryPressed)
      window.removeEventListener('blur', clearPrimaryPressed)
    }
  }, [])

  return modifiersRef.current
}
