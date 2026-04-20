import {
  BringToFront,
  ChevronsDown,
  ChevronsUp,
  Copy,
  CopyPlus,
  CornerDownLeft,
  Scissors,
  SendToBack,
  Trash2,
} from 'lucide-react'
import type { CanvasReorderDirection } from '../document/canvas-stack-order'
import type {
  CanvasContextMenuContext,
  CanvasContextMenuContributor,
  CanvasContextMenuServices,
} from './canvas-context-menu-types'
import type {
  ContextMenuCommand,
  ContextMenuGroupConfig,
  ContextMenuItemSpec,
} from '~/features/context-menu/types'

interface CanvasSelectionPayload {
  scope: 'selection'
}

interface CanvasReorderPayload extends CanvasSelectionPayload {
  direction: CanvasReorderDirection
}

function createCanvasCommand<TPayload extends CanvasSelectionPayload | undefined = undefined>(
  id: string,
  run: (
    context: CanvasContextMenuContext,
    services: CanvasContextMenuServices,
    payload: TPayload | undefined,
  ) => void | Promise<void>,
): ContextMenuCommand<CanvasContextMenuContext, CanvasContextMenuServices, TPayload> {
  return { id, run }
}

const canvasReorderSubmenuItems = () =>
  [
    {
      id: 'reorder-send-to-back-selection',
      commandId: 'reorder.sendToBack',
      payload: { scope: 'selection', direction: 'sendToBack' },
      label: 'Send to back',
      icon: SendToBack,
      group: 'reorder',
      priority: 0,
      scope: 'selection',
    },
    {
      id: 'reorder-send-backward-selection',
      commandId: 'reorder.sendBackward',
      payload: { scope: 'selection', direction: 'sendBackward' },
      label: 'Send backward',
      icon: ChevronsDown,
      group: 'reorder',
      priority: 1,
      scope: 'selection',
    },
    {
      id: 'reorder-bring-forward-selection',
      commandId: 'reorder.bringForward',
      payload: { scope: 'selection', direction: 'bringForward' },
      label: 'Bring forward',
      icon: ChevronsUp,
      group: 'reorder',
      priority: 2,
      scope: 'selection',
    },
    {
      id: 'reorder-bring-to-front-selection',
      commandId: 'reorder.bringToFront',
      payload: { scope: 'selection', direction: 'bringToFront' },
      label: 'Bring to front',
      icon: BringToFront,
      group: 'reorder',
      priority: 3,
      scope: 'selection',
    },
  ] satisfies Array<ContextMenuItemSpec<CanvasContextMenuContext, CanvasContextMenuServices>>

export const canvasContextMenuCommands = {
  'edit.copy': createCanvasCommand<CanvasSelectionPayload>('edit.copy', (context, services) => {
    services.copySnapshot(context.selection)
  }),
  'edit.cut': createCanvasCommand<CanvasSelectionPayload>('edit.cut', (context, services) => {
    services.cutSnapshot(context.selection)
  }),
  'edit.duplicate': createCanvasCommand<CanvasSelectionPayload>(
    'edit.duplicate',
    (context, services) => {
      services.duplicateSnapshot(context.selection)
    },
  ),
  'edit.delete': createCanvasCommand<CanvasSelectionPayload>('edit.delete', (context, services) => {
    services.deleteSnapshot(context.selection)
  }),
  'edit.paste': {
    id: 'edit.paste',
    run: (_context, services) => {
      services.pasteClipboard()
    },
    isEnabled: (_context, services) => services.canPaste(),
  },
  'reorder.sendToBack': createCanvasCommand<CanvasReorderPayload>(
    'reorder.sendToBack',
    (context, services, payload) => {
      if (!payload) return
      services.reorderSnapshot(context.selection, payload.direction)
    },
  ),
  'reorder.sendBackward': createCanvasCommand<CanvasReorderPayload>(
    'reorder.sendBackward',
    (context, services, payload) => {
      if (!payload) return
      services.reorderSnapshot(context.selection, payload.direction)
    },
  ),
  'reorder.bringForward': createCanvasCommand<CanvasReorderPayload>(
    'reorder.bringForward',
    (context, services, payload) => {
      if (!payload) return
      services.reorderSnapshot(context.selection, payload.direction)
    },
  ),
  'reorder.bringToFront': createCanvasCommand<CanvasReorderPayload>(
    'reorder.bringToFront',
    (context, services, payload) => {
      if (!payload) return
      services.reorderSnapshot(context.selection, payload.direction)
    },
  ),
} satisfies Record<
  string,
  ContextMenuCommand<CanvasContextMenuContext, CanvasContextMenuServices, any>
>

const canvasPaneContributor: CanvasContextMenuContributor = {
  id: 'canvas-pane',
  surfaces: ['canvas'],
  getItems: (context) =>
    context.selection.nodeIds.length > 0 || context.selection.edgeIds.length > 0
      ? []
      : [
          {
            id: 'canvas-pane-paste',
            commandId: 'edit.paste',
            label: 'Paste',
            icon: CornerDownLeft,
            group: 'edit',
            priority: 0,
            applies: (ctx) => ctx.canEdit,
          },
        ],
}

const canvasSelectionContributor: CanvasContextMenuContributor = {
  id: 'canvas-selection',
  surfaces: ['canvas'],
  applies: (context) =>
    context.selection.nodeIds.length > 0 || context.selection.edgeIds.length > 0,
  getItems: (context, services) => {
    const canCopy = services.canCopySnapshot(context.selection)

    return [
      {
        id: 'canvas-selection-reorder',
        label: 'Reorder',
        icon: BringToFront,
        group: 'reorder',
        priority: 0,
        scope: 'selection',
        applies: (ctx) => ctx.canEdit,
        children: () => canvasReorderSubmenuItems(),
      },
      {
        id: 'canvas-selection-cut',
        commandId: 'edit.cut',
        payload: { scope: 'selection' },
        label: 'Cut',
        icon: Scissors,
        group: 'edit',
        priority: 1,
        scope: 'selection',
        applies: () => canCopy && context.canEdit,
      },
      {
        id: 'canvas-selection-copy',
        commandId: 'edit.copy',
        payload: { scope: 'selection' },
        label: 'Copy',
        icon: Copy,
        group: 'edit',
        priority: 2,
        scope: 'selection',
        applies: () => canCopy,
      },
      {
        id: 'canvas-selection-duplicate',
        commandId: 'edit.duplicate',
        payload: { scope: 'selection' },
        label: 'Duplicate',
        icon: CopyPlus,
        group: 'edit',
        priority: 3,
        scope: 'selection',
        applies: () => canCopy && context.canEdit,
      },
      {
        id: 'canvas-selection-delete',
        commandId: 'edit.delete',
        payload: { scope: 'selection' },
        label: 'Delete',
        icon: Trash2,
        group: 'danger',
        priority: 99,
        scope: 'selection',
        applies: (ctx) => ctx.canEdit,
      },
    ]
  },
}

export const canvasContextMenuContributors = [
  canvasPaneContributor,
  canvasSelectionContributor,
] satisfies ReadonlyArray<CanvasContextMenuContributor>

export const canvasContextMenuGroupConfig: ContextMenuGroupConfig = {
  reorder: { label: null, priority: 0 },
  edit: { label: null, priority: 1 },
  danger: { label: null, priority: 99 },
}
