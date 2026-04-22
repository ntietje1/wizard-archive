import { useHotkey } from '@tanstack/react-hotkeys'
import { useCanvasContextMenuServices } from '../context-menu/use-canvas-context-menu-services'
import { getCanvasSelectionSnapshot } from '../selection/use-canvas-selection-state'
import { useCanvasToolStore } from '../../stores/canvas-tool-store'
import { getCanvasToolbarTools } from '../../tools/canvas-tool-modules'
import type { Id } from 'convex/_generated/dataModel'
import type {
  CanvasHistoryController,
  CanvasSelectionController,
  CanvasToolId,
} from '../../tools/canvas-tool-types'
import type { Edge, Node } from '@xyflow/react'
import type * as Y from 'yjs'

interface UseCanvasKeyboardShortcutsOptions extends Pick<CanvasHistoryController, 'undo' | 'redo'> {
  canEdit: boolean
  nodesMap: Y.Map<Node>
  edgesMap: Y.Map<Edge>
  selection: Pick<CanvasSelectionController, 'replace' | 'clear'>
}

const TOOL_SHORTCUT_BINDINGS = [
  { key: '1', toolId: 'select' },
  { key: '2', toolId: 'hand' },
  { key: '3', toolId: 'lasso' },
  { key: '4', toolId: 'draw' },
  { key: '5', toolId: 'erase' },
  { key: '6', toolId: 'text' },
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
  canEdit,
  nodesMap,
  edgesMap,
  selection,
}: UseCanvasKeyboardShortcutsOptions) {
  const toolbarTools = getCanvasToolbarTools()
  const selectTool = toolbarTools.find((tool) => tool.id === 'select')
  const handTool = toolbarTools.find((tool) => tool.id === 'hand')
  const lassoTool = toolbarTools.find((tool) => tool.id === 'lasso')
  const drawTool = toolbarTools.find((tool) => tool.id === 'draw')
  const eraseTool = toolbarTools.find((tool) => tool.id === 'erase')
  const textTool = toolbarTools.find((tool) => tool.id === 'text')
  const toolLookup = {
    select: selectTool,
    hand: handTool,
    lasso: lassoTool,
    draw: drawTool,
    erase: eraseTool,
    text: textTool,
  } as const
  const contextMenuServices = useCanvasContextMenuServices({
    canEdit,
    campaignId: 'canvas-shortcuts-campaign' as Id<'campaigns'>,
    canvasParentId: null,
    nodesMap,
    edgesMap,
    createNode: () => undefined,
    screenToFlowPosition: ({ x, y }) => ({ x, y }),
    selection,
  })

  const hotkeyOptions = {
    ignoreInputs: true,
  } as const

  useHotkey(
    'Escape',
    (event) => {
      if (event.repeat) return
      if (canEdit && selectTool && useCanvasToolStore.getState().activeTool !== selectTool.id) {
        useCanvasToolStore.getState().setActiveTool(selectTool.id)
        return
      }
      selection.clear()
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
      if (contextMenuServices.copySnapshot(getCanvasSelectionSnapshot())) {
        event.preventDefault()
      }
    },
    hotkeyOptions,
  )

  useHotkey(
    'Mod+X',
    (event) => {
      if (event.repeat) return
      if (contextMenuServices.cutSnapshot(getCanvasSelectionSnapshot())) {
        event.preventDefault()
      }
    },
    hotkeyOptions,
  )

  useHotkey(
    'Mod+V',
    (event) => {
      if (event.repeat) return
      if (contextMenuServices.pasteClipboard()) {
        event.preventDefault()
      }
    },
    hotkeyOptions,
  )
}
