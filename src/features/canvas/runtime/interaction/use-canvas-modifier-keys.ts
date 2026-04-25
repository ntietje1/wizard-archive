import { useKeyHold } from '@tanstack/react-hotkeys'
import { useEffect, useState } from 'react'
import { isPrimarySelectionModifier } from '../../utils/canvas-selection-utils'

export function useCanvasModifierKeys() {
  const shiftPressed = useKeyHold('Shift')
  const [primaryPressed, setPrimaryPressed] = useState(false)

  useEffect(() => {
    const updatePrimaryPressed = (event: KeyboardEvent) => {
      if (event.key !== 'Control' && event.key !== 'Meta') {
        return
      }

      setPrimaryPressed(
        isPrimarySelectionModifier({
          ctrlKey: event.ctrlKey,
          metaKey: event.metaKey,
        }),
      )
    }

    const clearPrimaryPressed = () => {
      setPrimaryPressed(false)
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

  return { primaryPressed, shiftPressed }
}
