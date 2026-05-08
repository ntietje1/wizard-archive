type ItemSelectionIntent = 'single' | 'toggle' | 'range'

interface ItemSelectionModifierState {
  shiftKey: boolean
  metaKey: boolean
  ctrlKey: boolean
}

/**
 * Converts pointer-key modifier state into sidebar selection intent.
 * Shift always wins and returns `range`; Command on macOS or Ctrl on
 * Windows/Linux returns `toggle`; no modifier returns `single`.
 */
export function getItemSelectionIntent({
  shiftKey,
  metaKey,
  ctrlKey,
}: ItemSelectionModifierState): ItemSelectionIntent {
  if (shiftKey) return 'range'
  if (metaKey || ctrlKey) return 'toggle'
  return 'single'
}
