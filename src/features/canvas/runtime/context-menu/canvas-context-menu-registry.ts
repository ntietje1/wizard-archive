import {
  BringToFront,
  ChevronsDown,
  ChevronsUp,
  Copy,
  CopyPlus,
  CornerDownLeft,
  File,
  FilePlus,
  FolderPlus,
  Grid2x2Plus,
  MapPin,
  Plus,
  Scissors,
  SendToBack,
  Trash2,
} from 'lucide-react'
import { SIDEBAR_ITEM_TYPES } from 'convex/sidebarItems/types/baseTypes'
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

function hasSelection(context: CanvasContextMenuContext): boolean {
  return context.selection.nodeIds.length > 0 || context.selection.edgeIds.length > 0
}

function handleReorder(
  context: CanvasContextMenuContext,
  services: CanvasContextMenuServices,
  payload: CanvasReorderPayload | undefined,
) {
  if (!payload) return
  services.reorderSnapshot(context.selection, payload.direction)
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

const canvasCreateSubmenuItems = () =>
  [
    {
      id: 'canvas-pane-create-note',
      commandId: 'create.note',
      label: 'Note',
      icon: FilePlus,
      group: 'create',
      priority: 10,
    },
    {
      id: 'canvas-pane-create-folder',
      commandId: 'create.folder',
      label: 'Folder',
      icon: FolderPlus,
      group: 'create',
      priority: 11,
    },
    {
      id: 'canvas-pane-create-map',
      commandId: 'create.map',
      label: 'Map',
      icon: MapPin,
      group: 'create',
      priority: 12,
    },
    {
      id: 'canvas-pane-create-canvas',
      commandId: 'create.canvas',
      label: 'Canvas',
      icon: Grid2x2Plus,
      group: 'create',
      priority: 13,
    },
    {
      id: 'canvas-pane-create-file',
      commandId: 'create.file',
      label: 'File',
      icon: File,
      group: 'create',
      priority: 14,
    },
  ] satisfies Array<ContextMenuItemSpec<CanvasContextMenuContext, CanvasContextMenuServices>>

export const canvasContextMenuCommands = {
  'selection.open': createCanvasCommand<CanvasSelectionPayload>(
    'selection.open',
    async (context, services) => {
      await services.openEmbedSelection(context.selection)
    },
  ),
  'create.note': {
    id: 'create.note',
    run: async (context, services) => {
      await services.createAndEmbedSidebarItem(SIDEBAR_ITEM_TYPES.notes, context.pointerPosition)
    },
  },
  'create.folder': {
    id: 'create.folder',
    run: async (context, services) => {
      await services.createAndEmbedSidebarItem(SIDEBAR_ITEM_TYPES.folders, context.pointerPosition)
    },
  },
  'create.map': {
    id: 'create.map',
    run: async (context, services) => {
      await services.createAndEmbedSidebarItem(SIDEBAR_ITEM_TYPES.gameMaps, context.pointerPosition)
    },
  },
  'create.canvas': {
    id: 'create.canvas',
    run: async (context, services) => {
      await services.createAndEmbedSidebarItem(SIDEBAR_ITEM_TYPES.canvases, context.pointerPosition)
    },
  },
  'create.file': {
    id: 'create.file',
    run: async (context, services) => {
      await services.createAndEmbedSidebarItem(SIDEBAR_ITEM_TYPES.files, context.pointerPosition)
    },
  },
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
    handleReorder,
  ),
  'reorder.sendBackward': createCanvasCommand<CanvasReorderPayload>(
    'reorder.sendBackward',
    handleReorder,
  ),
  'reorder.bringForward': createCanvasCommand<CanvasReorderPayload>(
    'reorder.bringForward',
    handleReorder,
  ),
  'reorder.bringToFront': createCanvasCommand<CanvasReorderPayload>(
    'reorder.bringToFront',
    handleReorder,
  ),
} satisfies Record<
  string,
  ContextMenuCommand<CanvasContextMenuContext, CanvasContextMenuServices, any>
>

const canvasPaneContributor: CanvasContextMenuContributor = {
  id: 'canvas-pane',
  surfaces: ['canvas'],
  getItems: (context) =>
    hasSelection(context)
      ? []
      : [
          {
            id: 'canvas-pane-create-submenu',
            label: 'New...',
            icon: Plus,
            group: 'create',
            priority: 0,
            applies: (ctx) => ctx.canEdit,
            children: () => canvasCreateSubmenuItems(),
          },
          {
            id: 'canvas-pane-paste',
            commandId: 'edit.paste',
            label: 'Paste',
            icon: CornerDownLeft,
            group: 'edit',
            priority: 1,
            applies: (ctx) => ctx.canEdit,
          },
        ],
}

const canvasSelectionContributor: CanvasContextMenuContributor = {
  id: 'canvas-selection',
  surfaces: ['canvas'],
  applies: (context) => hasSelection(context),
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
        applies: (ctx) => canCopy && ctx.canEdit,
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
        applies: (ctx) => canCopy && ctx.canEdit,
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
  navigation: { label: null, priority: 0 },
  reorder: { label: null, priority: 1 },
  create: { label: null, priority: 2 },
  edit: { label: null, priority: 3 },
  danger: { label: null, priority: 99 },
}
