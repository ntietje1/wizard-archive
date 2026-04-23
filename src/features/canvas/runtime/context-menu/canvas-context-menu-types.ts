import type { CanvasSelectionSnapshot } from '../../tools/canvas-tool-types'
import type { CanvasCommands } from '../document/use-canvas-commands'
import type { ContextMenuContributor, ContextMenuItemSpec } from '~/features/context-menu/types'
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
  canOpenEmbedSelection: (selection: CanvasSelectionSnapshot) => boolean
  openEmbedSelection: (selection: CanvasSelectionSnapshot) => Promise<boolean>
  createAndEmbedSidebarItem: (
    type: SidebarItemType,
    pointerPosition: CanvasContextMenuPoint,
  ) => Promise<CanvasSelectionSnapshot | null>
}

export type CanvasContextMenuItem = ContextMenuItemSpec<
  CanvasContextMenuContext,
  CanvasContextMenuServices,
  unknown
>

export type CanvasContextMenuCommands = Pick<
  CanvasCommands,
  'copy' | 'cut' | 'paste' | 'duplicate' | 'delete' | 'reorder'
>

export type CanvasContextMenuContributor = ContextMenuContributor<
  CanvasContextMenuContext,
  CanvasContextMenuServices
>

export interface CanvasContextMenuCapability {
  contributors?: ReadonlyArray<CanvasContextMenuContributor>
}
