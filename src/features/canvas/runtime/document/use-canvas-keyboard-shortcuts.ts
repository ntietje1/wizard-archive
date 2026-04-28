import { useEffect, useRef } from 'react'
import { useCanvasToolStore } from '../../stores/canvas-tool-store'
import type { CanvasCommands } from './use-canvas-commands'
import type {
  CanvasHistoryController,
  CanvasSelectionController,
} from '../../tools/canvas-tool-types'
import type {
  CanvasDocumentEdge,
  CanvasDocumentNode,
} from '~/features/canvas/types/canvas-domain-types'
import type * as Y from 'yjs'

interface UseCanvasKeyboardShortcutsOptions extends Pick<CanvasHistoryController, 'undo' | 'redo'> {
  canEdit: boolean
  nodesMap: Y.Map<CanvasDocumentNode>
  edgesMap: Y.Map<CanvasDocumentEdge>
  selection: Pick<CanvasSelectionController, 'getSnapshot' | 'setSelection' | 'clearSelection'>
  commands: Pick<CanvasCommands, 'copy' | 'cut' | 'paste' | 'delete'>
}

function isEditableKeyboardTarget(target: EventTarget | null) {
  if (!(target instanceof Element)) {
    return false
  }

  return (
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement ||
    target.matches('[contenteditable="true"]') ||
    target.closest('[contenteditable="true"]') !== null
  )
}

const TOOL_SHORTCUTS = new Map([
  ['1', 'select'],
  ['2', 'hand'],
  ['3', 'lasso'],
  ['4', 'draw'],
  ['5', 'erase'],
  ['6', 'text'],
  ['7', 'edge'],
] as const)

function getToolShortcut(key: string) {
  return key.length === 1
    ? TOOL_SHORTCUTS.get(key as '1' | '2' | '3' | '4' | '5' | '6' | '7')
    : undefined
}

function handleEscapeShortcut(current: UseCanvasKeyboardShortcutsOptions, key: string) {
  if (key !== 'escape') {
    return false
  }

  current.selection.clearSelection()
  return true
}

function handleDeleteShortcut(
  current: UseCanvasKeyboardShortcutsOptions,
  event: KeyboardEvent,
  key: string,
) {
  if (key !== 'backspace' && key !== 'delete') {
    return false
  }

  if (current.canEdit && current.commands.delete.canRun() && current.commands.delete.run()) {
    event.preventDefault()
  }

  return true
}

function handleToolShortcut(current: UseCanvasKeyboardShortcutsOptions, key: string) {
  const toolId = getToolShortcut(key)

  if (current.canEdit && toolId) {
    useCanvasToolStore.getState().setActiveTool(toolId)
  }
}

function handleSelectAllShortcut(
  current: UseCanvasKeyboardShortcutsOptions,
  event: KeyboardEvent,
  key: string,
) {
  if (key !== 'a') {
    return false
  }

  current.selection.setSelection({
    nodeIds: new Set(current.nodesMap.keys()),
    edgeIds: new Set(current.edgesMap.keys()),
  })
  event.preventDefault()
  return true
}

function handleHistoryShortcut(
  current: UseCanvasKeyboardShortcutsOptions,
  event: KeyboardEvent,
  key: string,
) {
  if (key === 'z') {
    event.preventDefault()
    if (event.shiftKey) {
      current.redo()
    } else {
      current.undo()
    }
    return true
  }

  if (key === 'y') {
    event.preventDefault()
    current.redo()
    return true
  }

  return false
}

function runClipboardCommand(
  command: CanvasCommands['copy'] | CanvasCommands['paste'],
  event: KeyboardEvent,
) {
  if (command.canRun() && command.run()) {
    event.preventDefault()
  }
}

function handleClipboardShortcut(
  current: UseCanvasKeyboardShortcutsOptions,
  event: KeyboardEvent,
  key: string,
) {
  if (key === 'c') {
    runClipboardCommand(current.commands.copy, event)
    return
  }

  if (key === 'x') {
    runClipboardCommand(current.commands.cut, event)
    return
  }

  if (key === 'v') {
    runClipboardCommand(current.commands.paste, event)
  }
}

function handleCanvasKeyDown(current: UseCanvasKeyboardShortcutsOptions, event: KeyboardEvent) {
  if (event.repeat) {
    return
  }

  const key = event.key.toLowerCase()

  if (isEditableKeyboardTarget(event.target) || handleEscapeShortcut(current, key)) {
    return
  }

  if (handleDeleteShortcut(current, event, key)) {
    return
  }

  if (!event.ctrlKey && !event.metaKey) {
    handleToolShortcut(current, key)
    return
  }

  if (handleSelectAllShortcut(current, event, key)) {
    return
  }

  if (handleHistoryShortcut(current, event, key)) {
    return
  }

  handleClipboardShortcut(current, event, key)
}

export function useCanvasKeyboardShortcuts(options: UseCanvasKeyboardShortcutsOptions) {
  const optionsRef = useRef(options)
  optionsRef.current = options

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      handleCanvasKeyDown(optionsRef.current, event)
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])
}
