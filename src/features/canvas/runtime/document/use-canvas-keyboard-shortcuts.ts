import { useHotkey } from '@tanstack/react-hotkeys'
import type { CanvasHistoryController } from '../../tools/canvas-tool-types'
import { useCanvasSelectionActions } from '../selection/use-canvas-selection-actions'

export function useCanvasKeyboardShortcuts({
  undo,
  redo,
}: Pick<CanvasHistoryController, 'undo' | 'redo'>) {
  const selectionActions = useCanvasSelectionActions()

  const hotkeyOptions = {
    ignoreInputs: true,
  } as const

  useHotkey(
    'Escape',
    (event) => {
      if (event.repeat) return
      selectionActions.clear()
    },
    hotkeyOptions,
  )

  useHotkey(
    'Mod+Z',
    (event) => {
      if (event.repeat) return
      undo()
    },
    hotkeyOptions,
  )

  useHotkey(
    'Mod+Shift+Z',
    (event) => {
      if (event.repeat) return
      redo()
    },
    hotkeyOptions,
  )

  useHotkey(
    'Mod+Y',
    (event) => {
      if (event.repeat) return
      redo()
    },
    hotkeyOptions,
  )
}
