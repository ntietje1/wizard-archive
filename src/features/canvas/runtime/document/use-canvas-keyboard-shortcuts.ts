import { useHotkey } from '@tanstack/react-hotkeys'
import { useCanvasToolStore } from '../../stores/canvas-tool-store'
import { canvasToolbarTools } from '../../tools/canvas-tool-modules'
import type { CanvasCommands } from './use-canvas-commands'
import type {
  CanvasHistoryController,
  CanvasSelectionController,
  CanvasToolId,
} from '../../tools/canvas-tool-types'
import type { Edge, Node } from '@xyflow/react'
import type * as Y from 'yjs'

interface UseCanvasKeyboardShortcutsOptions extends Pick<CanvasHistoryController, 'undo' | 'redo'> {
  cancelConnectionDraft: () => void
  canEdit: boolean
  nodesMap: Y.Map<Node>
  edgesMap: Y.Map<Edge>
  selection: Pick<CanvasSelectionController, 'getSnapshot' | 'replace' | 'clear'>
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

const TOOL_SHORTCUT_BINDINGS = [
  { key: '1', toolId: 'select' },
  { key: '2', toolId: 'hand' },
  { key: '3', toolId: 'lasso' },
  { key: '4', toolId: 'draw' },
  { key: '5', toolId: 'erase' },
  { key: '6', toolId: 'text' },
  { key: '7', toolId: 'edge' },
] as const

function useCanvasToolHotkey(
  hotkey: (typeof TOOL_SHORTCUT_BINDINGS)[number]['key'],
  tool: { id: CanvasToolId } | undefined,
  canEdit: boolean,
  hotkeyOptions: { ignoreInputs: true },
) {
  useHotkey(
    hotkey,
    (event) => {
      if (event.repeat || !canEdit || !tool) return
      useCanvasToolStore.getState().setActiveTool(tool.id)
    },
    hotkeyOptions,
  )
}

export function useCanvasKeyboardShortcuts({
  undo,
  redo,
  cancelConnectionDraft,
  canEdit,
  nodesMap,
  edgesMap,
  selection,
  commands,
}: UseCanvasKeyboardShortcutsOptions) {
  const selectTool = canvasToolbarTools.find((tool) => tool.id === 'select')
  const handTool = canvasToolbarTools.find((tool) => tool.id === 'hand')
  const lassoTool = canvasToolbarTools.find((tool) => tool.id === 'lasso')
  const drawTool = canvasToolbarTools.find((tool) => tool.id === 'draw')
  const eraseTool = canvasToolbarTools.find((tool) => tool.id === 'erase')
  const textTool = canvasToolbarTools.find((tool) => tool.id === 'text')
  const edgeTool = canvasToolbarTools.find((tool) => tool.id === 'edge')
  const toolLookup = {
    select: selectTool,
    hand: handTool,
    lasso: lassoTool,
    draw: drawTool,
    erase: eraseTool,
    text: textTool,
    edge: edgeTool,
  } as const

  const hotkeyOptions = {
    ignoreInputs: true,
  } as const

  useHotkey(
    'Escape',
    (event) => {
      if (event.repeat) return
      selection.clear()
      cancelConnectionDraft()
    },
    hotkeyOptions,
  )

  useHotkey(
    'Backspace',
    (event) => {
      if (event.repeat || !canEdit || isEditableKeyboardTarget(event.target)) {
        return
      }

      if (!commands.delete.canRun()) {
        return
      }

      if (commands.delete.run()) {
        event.preventDefault()
      }
    },
    hotkeyOptions,
  )

  useHotkey(
    'Delete',
    (event) => {
      if (event.repeat || !canEdit || isEditableKeyboardTarget(event.target)) {
        return
      }

      if (!commands.delete.canRun()) {
        return
      }

      if (commands.delete.run()) {
        event.preventDefault()
      }
    },
    hotkeyOptions,
  )

  useCanvasToolHotkey(
    TOOL_SHORTCUT_BINDINGS[0].key,
    toolLookup[TOOL_SHORTCUT_BINDINGS[0].toolId],
    canEdit,
    hotkeyOptions,
  )
  useCanvasToolHotkey(
    TOOL_SHORTCUT_BINDINGS[1].key,
    toolLookup[TOOL_SHORTCUT_BINDINGS[1].toolId],
    canEdit,
    hotkeyOptions,
  )
  useCanvasToolHotkey(
    TOOL_SHORTCUT_BINDINGS[2].key,
    toolLookup[TOOL_SHORTCUT_BINDINGS[2].toolId],
    canEdit,
    hotkeyOptions,
  )
  useCanvasToolHotkey(
    TOOL_SHORTCUT_BINDINGS[3].key,
    toolLookup[TOOL_SHORTCUT_BINDINGS[3].toolId],
    canEdit,
    hotkeyOptions,
  )
  useCanvasToolHotkey(
    TOOL_SHORTCUT_BINDINGS[4].key,
    toolLookup[TOOL_SHORTCUT_BINDINGS[4].toolId],
    canEdit,
    hotkeyOptions,
  )
  useCanvasToolHotkey(
    TOOL_SHORTCUT_BINDINGS[5].key,
    toolLookup[TOOL_SHORTCUT_BINDINGS[5].toolId],
    canEdit,
    hotkeyOptions,
  )
  useCanvasToolHotkey(
    TOOL_SHORTCUT_BINDINGS[6].key,
    toolLookup[TOOL_SHORTCUT_BINDINGS[6].toolId],
    canEdit,
    hotkeyOptions,
  )

  useHotkey(
    'Mod+A',
    (event) => {
      if (event.repeat) return
      selection.replace({
        nodeIds: Array.from(nodesMap.keys()),
        edgeIds: Array.from(edgesMap.keys()),
      })
      event.preventDefault()
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

  useHotkey(
    'Mod+C',
    (event) => {
      if (event.repeat) return
      if (!commands.copy.canRun()) return
      if (commands.copy.run()) {
        event.preventDefault()
      }
    },
    hotkeyOptions,
  )

  useHotkey(
    'Mod+X',
    (event) => {
      if (event.repeat) return
      if (!commands.cut.canRun()) return
      if (commands.cut.run()) {
        event.preventDefault()
      }
    },
    hotkeyOptions,
  )

  useHotkey(
    'Mod+V',
    (event) => {
      if (event.repeat) return
      if (!commands.paste.canRun()) return
      if (commands.paste.run()) {
        event.preventDefault()
      }
    },
    hotkeyOptions,
  )
}
