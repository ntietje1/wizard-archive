import { useHotkey } from '@tanstack/react-hotkeys'
import { useCanvasContextMenuServices } from '../context-menu/use-canvas-context-menu-services'
import { getCanvasSelectionSnapshot } from '../selection/use-canvas-selection-state'
import { useCanvasSelectionActions } from '../selection/use-canvas-selection-actions'
import type { Id } from 'convex/_generated/dataModel'
import type {
  CanvasHistoryController,
  CanvasSelectionController,
} from '../../tools/canvas-tool-types'
import type { Edge, Node } from '@xyflow/react'
import type * as Y from 'yjs'

interface UseCanvasKeyboardShortcutsOptions extends Pick<CanvasHistoryController, 'undo' | 'redo'> {
  canEdit: boolean
  nodesMap: Y.Map<Node>
  edgesMap: Y.Map<Edge>
  selection: Pick<CanvasSelectionController, 'replace' | 'clear'>
}

export function useCanvasKeyboardShortcuts({
  undo,
  redo,
  canEdit,
  nodesMap,
  edgesMap,
  selection,
}: UseCanvasKeyboardShortcutsOptions) {
  const selectionActions = useCanvasSelectionActions()
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
