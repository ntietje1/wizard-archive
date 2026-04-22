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
import { buildMenu } from '~/features/context-menu/menu-builder'
import type { ContextMenuGroupConfig } from '~/features/context-menu/types'
import type { CanvasReorderDirection } from '../document/canvas-reorder'
import type {
  CanvasContextMenuContext,
  CanvasContextMenuContributor,
  CanvasContextMenuItem,
  CanvasContextMenuServices,
} from './canvas-context-menu-types'

function hasSelection(context: CanvasContextMenuContext): boolean {
  return context.selection.nodeIds.length > 0 || context.selection.edgeIds.length > 0
}

function buildCanvasReorderItems(): Array<CanvasContextMenuItem> {
  const createReorderItem = (
    id: string,
    label: string,
    icon: CanvasContextMenuItem['icon'],
    priority: number,
    direction: CanvasReorderDirection,
  ): CanvasContextMenuItem => ({
    id,
    label,
    icon,
    group: 'reorder',
    priority,
    scope: 'selection',
    onSelect: (context, services) => {
      services.reorderSnapshot(context.selection, direction)
    },
  })

  return [
    createReorderItem(
      'reorder-send-to-back-selection',
      'Send to back',
      SendToBack,
      0,
      'sendToBack',
    ),
    createReorderItem(
      'reorder-send-backward-selection',
      'Send backward',
      ChevronsDown,
      1,
      'sendBackward',
    ),
    createReorderItem(
      'reorder-bring-forward-selection',
      'Bring forward',
      ChevronsUp,
      2,
      'bringForward',
    ),
    createReorderItem(
      'reorder-bring-to-front-selection',
      'Bring to front',
      BringToFront,
      3,
      'bringToFront',
    ),
  ]
}

function buildCanvasCreateItems(): Array<CanvasContextMenuItem> {
  const createItem = (
    id: string,
    label: string,
    icon: CanvasContextMenuItem['icon'],
    priority: number,
    type: (typeof SIDEBAR_ITEM_TYPES)[keyof typeof SIDEBAR_ITEM_TYPES],
  ): CanvasContextMenuItem => ({
    id,
    label,
    icon,
    group: 'create',
    priority,
    onSelect: async (context, services) => {
      await services.createAndEmbedSidebarItem(type, context.pointerPosition)
    },
  })

  return [
    createItem('canvas-pane-create-note', 'Note', FilePlus, 10, SIDEBAR_ITEM_TYPES.notes),
    createItem('canvas-pane-create-folder', 'Folder', FolderPlus, 11, SIDEBAR_ITEM_TYPES.folders),
    createItem('canvas-pane-create-map', 'Map', MapPin, 12, SIDEBAR_ITEM_TYPES.gameMaps),
    createItem('canvas-pane-create-canvas', 'Canvas', Grid2x2Plus, 13, SIDEBAR_ITEM_TYPES.canvases),
    createItem('canvas-pane-create-file', 'File', File, 14, SIDEBAR_ITEM_TYPES.files),
  ]
}

const canvasPaneContributor: CanvasContextMenuContributor = {
  id: 'canvas-pane',
  surfaces: ['canvas'],
  getItems: (context, _services) =>
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
            children: () => buildCanvasCreateItems(),
          },
          {
            id: 'canvas-pane-paste',
            label: 'Paste',
            icon: CornerDownLeft,
            group: 'edit',
            priority: 1,
            applies: (ctx) => ctx.canEdit,
            isEnabled: (_ctx, nextServices) => nextServices.canPaste(),
            onSelect: (_ctx, nextServices) => {
              nextServices.pasteClipboard()
            },
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
        children: () => buildCanvasReorderItems(),
      },
      {
        id: 'canvas-selection-cut',
        label: 'Cut',
        icon: Scissors,
        group: 'edit',
        priority: 1,
        scope: 'selection',
        applies: (ctx) => canCopy && ctx.canEdit,
        onSelect: (ctx, nextServices) => {
          nextServices.cutSnapshot(ctx.selection)
        },
      },
      {
        id: 'canvas-selection-copy',
        label: 'Copy',
        icon: Copy,
        group: 'edit',
        priority: 2,
        scope: 'selection',
        applies: () => canCopy,
        onSelect: (ctx, nextServices) => {
          nextServices.copySnapshot(ctx.selection)
        },
      },
      {
        id: 'canvas-selection-duplicate',
        label: 'Duplicate',
        icon: CopyPlus,
        group: 'edit',
        priority: 3,
        scope: 'selection',
        applies: (ctx) => canCopy && ctx.canEdit,
        onSelect: (ctx, nextServices) => {
          nextServices.duplicateSnapshot(ctx.selection)
        },
      },
      {
        id: 'canvas-selection-delete',
        label: 'Delete',
        icon: Trash2,
        group: 'danger',
        priority: 99,
        scope: 'selection',
        applies: (ctx) => ctx.canEdit,
        onSelect: (ctx, nextServices) => {
          nextServices.deleteSnapshot(ctx.selection)
        },
      },
    ]
  },
}

const canvasContextMenuContributors = [
  canvasPaneContributor,
  canvasSelectionContributor,
] satisfies ReadonlyArray<CanvasContextMenuContributor>

const canvasContextMenuGroupConfig: ContextMenuGroupConfig = {
  navigation: { label: null, priority: 0 },
  reorder: { label: null, priority: 1 },
  create: { label: null, priority: 2 },
  edit: { label: null, priority: 3 },
  danger: { label: null, priority: 99 },
}

export function buildCanvasContextMenu({
  context,
  services,
  contributors = [],
}: {
  context: CanvasContextMenuContext
  services: CanvasContextMenuServices
  contributors?: ReadonlyArray<CanvasContextMenuContributor>
}) {
  return buildMenu({
    context,
    services,
    contributors: [...canvasContextMenuContributors, ...contributors],
    commands: {},
    groupConfig: canvasContextMenuGroupConfig,
  })
}
