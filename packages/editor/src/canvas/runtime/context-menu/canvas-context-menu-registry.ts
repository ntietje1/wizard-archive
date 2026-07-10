import {
  AlignHorizontalSpaceBetween,
  ArrowUpToLine,
  Copy,
  CopyPlus,
  CornerDownLeft,
  Paperclip,
  Plus,
  Scissors,
  SquareMousePointer,
  Trash2,
  Type,
} from 'lucide-react'
import { parseCanvasReorderPayload } from '../../commands'
import { CANVAS_ARRANGE_ACTIONS } from '../document/canvas-arrange'
import { CANVAS_REORDER_ACTIONS } from '../document/canvas-reorder-actions'
import { buildMenu } from '../../../context-menu/menu-builder'
import type { ContextMenuGroupConfig } from '../../../context-menu/types'
import type { CanvasArrangeAction } from '../document/canvas-arrange'
import type { CanvasReorderDirection } from '../document/canvas-reorder'
import type {
  CanvasContextMenuArrangePayload,
  CanvasContextMenuCommands,
  CanvasContextMenuContext,
  CanvasContextMenuContributor,
  CanvasContextMenuItem,
  CanvasContextMenuReorderPayload,
  CanvasContextMenuServices,
} from './canvas-context-menu-types'
import { assertNever } from '../../internal/assert-never'

// Any target kind other than `pane` is currently treated as selectable.
// Update this if new non-selectable target kinds are introduced.
function isTargetSelectable(context: CanvasContextMenuContext): boolean {
  return context.target.kind !== 'pane'
}

function createCanvasReorderPayload(
  direction: CanvasReorderDirection,
): CanvasContextMenuReorderPayload {
  return { kind: 'reorder', direction }
}

function buildCanvasReorderItems(): Array<CanvasContextMenuItem> {
  return CANVAS_REORDER_ACTIONS.map((action, priority) => ({
    id: `reorder-${action.id}-selection`,
    commandId: 'canvas-selection-reorder',
    label: action.label,
    icon: action.icon,
    group: 'reorder',
    priority,
    payload: createCanvasReorderPayload(action.direction),
  }))
}

function createCanvasArrangePayload(action: CanvasArrangeAction): CanvasContextMenuArrangePayload {
  return { kind: 'arrange', action }
}

function getCanvasArrangeGroup(action: CanvasArrangeAction): string {
  switch (action) {
    case 'alignLeft':
    case 'alignRight':
    case 'alignTop':
    case 'alignBottom':
    case 'alignCenter':
    case 'alignVertical':
    case 'alignHorizontal':
      return 'arrange-align'
    case 'distributeHorizontal':
    case 'distributeVertical':
      return 'arrange-distribute'
    case 'flipHorizontal':
    case 'flipVertical':
      return 'arrange-flip'
    default: {
      assertNever(action)
    }
  }
}

function buildCanvasArrangeItems(): Array<CanvasContextMenuItem> {
  return CANVAS_ARRANGE_ACTIONS.map((action, priority) => ({
    id: `canvas-selection-arrange-${action.id}`,
    commandId: 'canvas-selection-arrange',
    label: action.label,
    group: getCanvasArrangeGroup(action.id),
    priority,
    payload: createCanvasArrangePayload(action.id),
  }))
}

function parseCanvasReorderDirection(payload: unknown): CanvasReorderDirection | null {
  return parseCanvasReorderPayload(payload)?.direction ?? null
}

function parseCanvasArrangeAction(payload: unknown): CanvasArrangeAction | null {
  if (!payload || typeof payload !== 'object') {
    return null
  }

  const maybePayload = payload as Partial<CanvasContextMenuArrangePayload>
  return maybePayload.kind === 'arrange' &&
    CANVAS_ARRANGE_ACTIONS.some((action) => action.id === maybePayload.action)
    ? (maybePayload.action ?? null)
    : null
}

function buildCanvasCreateItems(
  injectedCreateItems: ReadonlyArray<CanvasContextMenuItem>,
): Array<CanvasContextMenuItem> {
  return [
    ...injectedCreateItems,
    {
      id: 'canvas-pane-create-embed',
      label: 'Embed',
      icon: Paperclip,
      group: 'create-node',
      priority: 15,
      onSelect: (context, services) => {
        services.createEmbedNode(context.pointerPosition)
      },
    },
    {
      id: 'canvas-pane-create-text',
      label: 'Text',
      icon: Type,
      group: 'create-node',
      priority: 20,
      onSelect: (context, services) => {
        services.createTextNode(context.pointerPosition)
      },
    },
  ]
}

function createCanvasPaneContributor(
  createItems: ReadonlyArray<CanvasContextMenuItem>,
): CanvasContextMenuContributor {
  return {
    id: 'canvas-pane',
    surfaces: ['canvas'],
    getItems: (context, _services) =>
      context.target.kind !== 'pane'
        ? []
        : [
            {
              id: 'canvas-pane-create-submenu',
              label: 'New...',
              icon: Plus,
              group: 'create',
              priority: 0,
              applies: (ctx) => ctx.canEdit,
              children: () => buildCanvasCreateItems(createItems),
            },
            {
              id: 'canvas-pane-select-all',
              label: 'Select All',
              icon: SquareMousePointer,
              shortcut: 'Mod+A',
              group: 'edit',
              priority: 0,
              isEnabled: (_ctx, services) => services.hasSelectableCanvasItems(),
              onSelect: (_ctx, services) => {
                services.selectAllCanvasItems()
              },
            },
          ],
  }
}

const canvasClipboardContributor: CanvasContextMenuContributor = {
  id: 'canvas-clipboard',
  surfaces: ['canvas'],
  getItems: (_context, _services) => [
    {
      id: 'canvas-paste',
      commandId: 'canvas-paste',
      group: 'edit',
      priority: 0,
      applies: (ctx) => ctx.canEdit,
    },
  ],
}

const canvasSelectionContributor: CanvasContextMenuContributor = {
  id: 'canvas-selection',
  surfaces: ['canvas'],
  applies: (context) => isTargetSelectable(context),
  getItems: (_context, _services) => [
    {
      id: 'canvas-selection-reorder',
      label: 'Reorder',
      icon: ArrowUpToLine,
      group: 'reorder',
      priority: 0,
      applies: (ctx) => ctx.canEdit,
      children: () => buildCanvasReorderItems(),
    },
    {
      id: 'canvas-selection-arrange',
      label: 'Arrange',
      icon: AlignHorizontalSpaceBetween,
      group: 'reorder',
      priority: 1,
      applies: (ctx) => ctx.canEdit && ctx.selection.nodeIds.size > 1,
      children: () => buildCanvasArrangeItems(),
    },
    {
      id: 'canvas-selection-cut',
      commandId: 'canvas-selection-cut',
      group: 'edit',
      priority: 1,
      applies: (ctx, _nextServices, _payload) => ctx.canEdit,
    },
    {
      id: 'canvas-selection-copy',
      commandId: 'canvas-selection-copy',
      group: 'edit',
      priority: 2,
    },
    {
      id: 'canvas-selection-duplicate',
      commandId: 'canvas-selection-duplicate',
      group: 'edit',
      priority: 3,
      applies: (ctx) => ctx.canEdit,
    },
    {
      id: 'canvas-selection-delete',
      commandId: 'canvas-selection-delete',
      group: 'danger',
      priority: 99,
      variant: 'danger',
      applies: (ctx) => ctx.canEdit,
    },
  ],
}

const canvasContextMenuContributors = [
  canvasClipboardContributor,
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
  commands,
  createItems = [],
  contributors = [],
}: {
  context: CanvasContextMenuContext
  services: CanvasContextMenuServices
  commands: CanvasContextMenuCommands
  createItems?: ReadonlyArray<CanvasContextMenuItem>
  contributors?: ReadonlyArray<CanvasContextMenuContributor>
}) {
  return buildMenu({
    context,
    services,
    contributors: [
      createCanvasPaneContributor(createItems),
      ...canvasContextMenuContributors,
      ...contributors,
    ],
    commands: {
      'canvas-paste': {
        id: 'canvas-paste',
        label: 'Paste',
        icon: CornerDownLeft,
        isEnabled: () => commands.paste.canRun(),
        run: () => {
          commands.paste.run()
        },
      },
      'canvas-selection-cut': {
        id: 'canvas-selection-cut',
        label: 'Cut',
        icon: Scissors,
        isEnabled: (nextContext) => commands.cut.canRun({ selection: nextContext.selection }),
        run: (nextContext) => {
          commands.cut.run({ selection: nextContext.selection })
        },
      },
      'canvas-selection-copy': {
        id: 'canvas-selection-copy',
        label: 'Copy',
        icon: Copy,
        isEnabled: (nextContext) => commands.copy.canRun({ selection: nextContext.selection }),
        run: (nextContext) => {
          commands.copy.run({ selection: nextContext.selection })
        },
      },
      'canvas-selection-duplicate': {
        id: 'canvas-selection-duplicate',
        label: 'Duplicate',
        icon: CopyPlus,
        isEnabled: (nextContext) => commands.duplicate.canRun({ selection: nextContext.selection }),
        run: (nextContext) => {
          commands.duplicate.run({ selection: nextContext.selection })
        },
      },
      'canvas-selection-delete': {
        id: 'canvas-selection-delete',
        label: 'Delete',
        icon: Trash2,
        isEnabled: (nextContext) => commands.delete.canRun({ selection: nextContext.selection }),
        run: (nextContext) => {
          commands.delete.run({ selection: nextContext.selection })
        },
      },
      'canvas-selection-reorder': {
        id: 'canvas-selection-reorder',
        isEnabled: (nextContext, _services, payload) => {
          const direction = parseCanvasReorderDirection(payload)
          return (
            direction !== null &&
            commands.reorder.canRun({
              selection: nextContext.selection,
              direction,
            })
          )
        },
        run: (nextContext, _services, payload) => {
          const direction = parseCanvasReorderDirection(payload)
          if (!direction) {
            return
          }

          commands.reorder.run({
            selection: nextContext.selection,
            direction,
          })
        },
      },
      'canvas-selection-arrange': {
        id: 'canvas-selection-arrange',
        isEnabled: (nextContext, _services, payload) => {
          const action = parseCanvasArrangeAction(payload)
          return (
            action !== null &&
            commands.arrange.canRun({
              selection: nextContext.selection,
              action,
            })
          )
        },
        run: (nextContext, _services, payload) => {
          const action = parseCanvasArrangeAction(payload)
          if (!action) {
            return
          }

          commands.arrange.run({
            selection: nextContext.selection,
            action,
          })
        },
      },
    },
    groupConfig: canvasContextMenuGroupConfig,
  })
}
