import type { CanvasSelectionSnapshot } from '../../tools/canvas-tool-types'
import type { CanvasCommands } from '../document/use-canvas-commands'
import type { ContextMenuContributor, ContextMenuItemSpec } from '~/features/context-menu/types'
import type { CanvasEdgeType } from '../../edges/canvas-edge-types'
import type { CanvasNodeType } from '../../nodes/canvas-node-types'
import type { Id } from 'convex/_generated/dataModel'
import type { SidebarItemType } from 'convex/sidebarItems/types/baseTypes'
import type { CanvasReorderDirection } from '../document/canvas-reorder'
import type {
  CanvasEdge as Edge,
  CanvasNode as Node,
} from '~/features/canvas/types/canvas-domain-types'

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
      sidebarItemId: Id<'sidebarItems'>
      nodeType: 'embed'
    }

type EmbedNodeTarget = Extract<CanvasContextMenuTarget, { kind: 'embed-node' }>

export type CanvasContextMenuReorderPayload = {
  kind: 'reorder'
  direction: CanvasReorderDirection
}

export interface CanvasClipboardEntry {
  nodes: Array<Node>
  edges: Array<Edge>
  pasteCount: number
}

export interface CanvasContextMenuServices {
  canOpenEmbedTarget: (target: EmbedNodeTarget) => boolean
  openEmbedTarget: (target: EmbedNodeTarget) => Promise<boolean>
  createAndEmbedSidebarItem: (
    type: SidebarItemType,
    pointerPosition: CanvasContextMenuPoint,
  ) => Promise<CanvasSelectionSnapshot | null>
}

export type CanvasContextMenuItem<TPayload = unknown> = ContextMenuItemSpec<
  CanvasContextMenuContext,
  CanvasContextMenuServices,
  TPayload
>

export type CanvasContextMenuCommands = Pick<
  CanvasCommands,
  'copy' | 'cut' | 'paste' | 'duplicate' | 'delete' | 'reorder'
>

export type CanvasContextMenuContributor = ContextMenuContributor<
  CanvasContextMenuContext,
  CanvasContextMenuServices
>
