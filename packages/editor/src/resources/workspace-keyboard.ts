import type { KeyboardEvent } from 'react'

export type WorkspaceKeyboardCommand = 'copy' | 'cut' | 'duplicate' | 'paste' | 'trash'

export function workspaceKeyboardCommand(
  event: KeyboardEvent<HTMLElement>,
): WorkspaceKeyboardCommand | null {
  if (isTextEntry(event.target) || event.altKey) return null
  const key = event.key.toLowerCase()
  if (event.ctrlKey || event.metaKey) {
    if (key === 'c') return 'copy'
    if (key === 'x') return 'cut'
    if (key === 'v') return 'paste'
    if (key === 'd') return 'duplicate'
    return null
  }
  return key === 'delete' || key === 'backspace' ? 'trash' : null
}

function isTextEntry(target: EventTarget | null) {
  return (
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement ||
    (target instanceof HTMLElement && target.isContentEditable)
  )
}
