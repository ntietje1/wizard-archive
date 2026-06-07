import type { CanvasSelectionSnapshot } from '../../system/canvas-selection'
import type { CanvasCommands } from '../document/use-canvas-commands'
import type { CanvasSelectionController } from '../../tools/canvas-tool-types'
import type { ContextMenuContributor, ContextMenuItemSpec } from '~/features/context-menu/types'
import type { Id } from 'convex/_generated/dataModel'
import type { CanvasArrangeAction } from '../document/canvas-arrange'
import type { CanvasReorderDirection } from '../document/canvas-reorder'
import type { EmbedTarget } from 'shared/embeds/embedTargets'
import type {
  CanvasDocumentEdge,
  CanvasDocumentNode,
  CanvasEdgeType,
  CanvasNodeType,
} from '~/features/canvas/domain/canvas-document'
export interface CanvasContextMenuPoint {
  x: number
  y: number
}

export interface CanvasContextMenuContext {
  surface: 'canvas'
  pointerPosition: CanvasContextMenuPoint
  selection: CanvasSelectionSnapshot
  target: CanvasContextMenuTarget
  canEdit: boolean
}

export type CanvasContextMenuTarget =
  | { kind: 'pane' }
  | {
      kind: 'mixed-selection'
      nodeIds: ReadonlyArray<string>
      edgeIds: ReadonlyArray<string>
    }
  | {
      kind: 'node-selection'
      nodeIds: ReadonlyArray<string>
      nodeType: CanvasNodeType | null
    }
  | {
      kind: 'edge-selection'
      edgeIds: ReadonlyArray<string>
      edgeType: CanvasEdgeType | null
    }
  | {
      kind: 'embed-node'
      nodeId: string
      target: EmbedTarget
      nodeType: 'embed'
    }

type EmbedNodeTarget = Extract<CanvasContextMenuTarget, { kind: 'embed-node' }>
export type CanvasEmbedNodeTarget = EmbedNodeTarget

export type CanvasContextMenuReorderPayload = {
  kind: 'reorder'
  direction: CanvasReorderDirection
}

export type CanvasContextMenuArrangePayload = {
  kind: 'arrange'
  action: CanvasArrangeAction
}

export interface CanvasClipboardEntry {
  nodes: Array<CanvasDocumentNode>
  edges: Array<CanvasDocumentEdge>
  pasteCount: number
}

export interface CanvasContextMenuServices {
  hasSelectableCanvasItems: () => boolean
  selectAllCanvasItems: () => void
  createEmbedNode: (pointerPosition: CanvasContextMenuPoint) => CanvasSelectionSnapshot | null
  createTextNode: (pointerPosition: CanvasContextMenuPoint) => CanvasSelectionSnapshot | null
}

export type CanvasContextMenuItem<TPayload = unknown> = ContextMenuItemSpec<
  CanvasContextMenuContext,
  CanvasContextMenuServices,
  TPayload
>

export type CanvasContextMenuCommands = Pick<
  CanvasCommands,
  'copy' | 'cut' | 'paste' | 'duplicate' | 'delete' | 'reorder' | 'arrange'
>

export type CanvasContextMenuContributor = ContextMenuContributor<
  CanvasContextMenuContext,
  CanvasContextMenuServices
>

export interface CanvasContextMenuCreateItemContext {
  campaignId: Id<'campaigns'>
  canEdit: boolean
  canvasParentId: Id<'sidebarItems'> | null
  createNode: (node: CanvasDocumentNode) => void
  screenToCanvasPosition: (position: CanvasContextMenuPoint) => { x: number; y: number }
  setSelection: CanvasSelectionController['setSelection']
}

export interface CanvasContextMenuAdapters {
  createItems?: (
    context: CanvasContextMenuCreateItemContext,
  ) => ReadonlyArray<CanvasContextMenuItem>
  getTargetContributors?: (
    target: CanvasContextMenuTarget,
  ) => ReadonlyArray<CanvasContextMenuContributor>
}
