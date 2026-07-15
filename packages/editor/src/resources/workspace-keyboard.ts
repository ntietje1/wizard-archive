import type { KeyboardEvent } from 'react'

export type WorkspaceKeyboardCommand =
  | 'copy'
  | 'cut'
  | 'duplicate'
  | 'paste'
  | 'redo'
  | 'trash'
  | 'undo'

export function workspaceKeyboardCommand(
  event: KeyboardEvent<HTMLElement>,
): WorkspaceKeyboardCommand | null {
  if (isTextEntry(event.target) || event.altKey) return null
  const key = event.key.toLowerCase()
  if (event.ctrlKey || event.metaKey) return modifierCommand(key, event.shiftKey)
  return key === 'delete' || key === 'backspace' ? 'trash' : null
}

function modifierCommand(key: string, shift: boolean): WorkspaceKeyboardCommand | null {
  const commands: Readonly<Record<string, WorkspaceKeyboardCommand>> = {
    c: 'copy',
    d: 'duplicate',
    v: 'paste',
    x: 'cut',
    z: shift ? 'redo' : 'undo',
  }
  return commands[key] ?? null
}

function isTextEntry(target: EventTarget | null) {
  return (
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement ||
    (target instanceof HTMLElement && target.isContentEditable)
  )
}
