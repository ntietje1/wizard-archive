import { useKeyHold } from '@tanstack/react-hotkeys'
import { isPrimarySelectionModifier } from '../../utils/canvas-selection-utils'

export function useCanvasModifierKeys() {
  const ctrlPressed = useKeyHold('Control')
  const metaPressed = useKeyHold('Meta')

  return {
    shiftPressed: useKeyHold('Shift'),
    primaryPressed: isPrimarySelectionModifier({
      ctrlKey: ctrlPressed,
      metaKey: metaPressed,
    }),
  }
}
