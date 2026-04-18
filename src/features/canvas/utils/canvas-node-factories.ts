import {
  STICKY_DEFAULT_COLOR,
  STICKY_DEFAULT_HEIGHT,
  STICKY_DEFAULT_OPACITY,
  STICKY_DEFAULT_WIDTH,
  TEXT_NODE_DEFAULT_HEIGHT,
  TEXT_NODE_DEFAULT_WIDTH,
} from '../components/nodes/sticky-node-constants'
import type { Id } from 'convex/_generated/dataModel'
import type { Node, XYPosition } from '@xyflow/react'

const EMBED_SIDEBAR_WIDTH = 320
const EMBED_SIDEBAR_HEIGHT = 240
const EMBED_FILE_WIDTH = 200
const EMBED_FILE_HEIGHT = 52

export function createTextNode(position: XYPosition): Node {
  const id = crypto.randomUUID()

  return {
    id,
    type: 'text',
    position: {
      x: position.x - TEXT_NODE_DEFAULT_WIDTH / 2,
      y: position.y - TEXT_NODE_DEFAULT_HEIGHT / 2,
    },
    width: TEXT_NODE_DEFAULT_WIDTH,
    height: TEXT_NODE_DEFAULT_HEIGHT,
    selected: true,
    draggable: true,
    data: {
      label: 'New text',
    },
  }
}

export function createStickyNode(position: XYPosition): Node {
  const id = crypto.randomUUID()

  return {
    id,
    type: 'sticky',
    position: {
      x: position.x - STICKY_DEFAULT_WIDTH / 2,
      y: position.y - STICKY_DEFAULT_HEIGHT / 2,
    },
    width: STICKY_DEFAULT_WIDTH,
    height: STICKY_DEFAULT_HEIGHT,
    selected: true,
    draggable: true,
    data: {
      label: '',
      color: STICKY_DEFAULT_COLOR,
      opacity: STICKY_DEFAULT_OPACITY,
    },
  }
}

export function createRectangleNode(
  id: string,
  rect: { x: number; y: number; width: number; height: number },
  style: { color: string; opacity: number },
): Node {
  return {
    id,
    type: 'rectangle',
    position: { x: rect.x, y: rect.y },
    width: rect.width,
    height: rect.height,
    selected: true,
    draggable: true,
    data: style,
  }
}

export function createEmbedSidebarItemNode(
  sidebarItemId: Id<'sidebarItems'>,
  position: XYPosition,
): Node {
  return {
    id: crypto.randomUUID(),
    type: 'embed',
    position,
    width: EMBED_SIDEBAR_WIDTH,
    height: EMBED_SIDEBAR_HEIGHT,
    data: { sidebarItemId },
  }
}

export function createEmbedFileNode(sidebarItemId: Id<'sidebarItems'>, position: XYPosition): Node {
  return {
    id: crypto.randomUUID(),
    type: 'embed',
    position,
    width: EMBED_FILE_WIDTH,
    height: EMBED_FILE_HEIGHT,
    data: { sidebarItemId },
  }
}
