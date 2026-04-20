import type { CanvasReorderDirection } from '../document/canvas-stack-order'
import type { CanvasSelectionSnapshot } from '../../tools/canvas-tool-types'
import type { ContextMenuContributor } from '~/features/context-menu/types'
import type { SidebarItemType } from 'convex/sidebarItems/types/baseTypes'
import type { Edge, Node } from '@xyflow/react'

export interface CanvasContextMenuPoint {
  x: number
  y: number
}

export interface CanvasContextMenuContext {
  surface: 'canvas'
  pointerPosition: CanvasContextMenuPoint
  selection: CanvasSelectionSnapshot
  canEdit: boolean
}

export interface CanvasClipboardEntry {
  nodes: Array<Node>
  edges: Array<Edge>
  pasteCount: number
}

export interface CanvasContextMenuServices {
  canPaste: () => boolean
  canCopySnapshot: (selection: CanvasSelectionSnapshot) => boolean
  copySnapshot: (selection: CanvasSelectionSnapshot) => boolean
  cutSnapshot: (selection: CanvasSelectionSnapshot) => boolean
  pasteClipboard: () => CanvasSelectionSnapshot | null
  duplicateSnapshot: (selection: CanvasSelectionSnapshot) => CanvasSelectionSnapshot | null
  deleteSnapshot: (selection: CanvasSelectionSnapshot) => boolean
  reorderSnapshot: (
    selection: CanvasSelectionSnapshot,
    direction: CanvasReorderDirection,
  ) => boolean
  createAndEmbedSidebarItem: (
    type: SidebarItemType,
    pointerPosition: CanvasContextMenuPoint,
  ) => Promise<CanvasSelectionSnapshot | null>
}

export type CanvasContextMenuContributor = ContextMenuContributor<
  CanvasContextMenuContext,
  CanvasContextMenuServices
>

export interface CanvasContextMenuCapability {
  contributors?: ReadonlyArray<CanvasContextMenuContributor>
}
