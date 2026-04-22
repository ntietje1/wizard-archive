import { createCanvasNodeModule } from '../canvas-node-module-types'
import { EmbedNode } from './embed-node'
import { embedNodeContextMenuContributors } from './embed-node-context-menu'
import { parseEmbedNodeData } from './embed-node-data'
import type { EmbedNodeData } from './embed-node-data'
import { rectangularCanvasNodeSelection } from '../shared/canvas-node-selection'
import {
  borderStrokeCanvasProperty,
  fillCanvasProperty,
  strokeSizeCanvasProperty,
} from '../../properties/canvas-property-definitions'
import {
  bindCanvasPaintProperty,
  bindCanvasStrokeSizeProperty,
} from '../../properties/canvas-property-types'
import {
  DEFAULT_CANVAS_NODE_BACKGROUND_COLOR,
  DEFAULT_CANVAS_NODE_BACKGROUND_OPACITY,
  DEFAULT_CANVAS_NODE_BORDER_OPACITY,
  DEFAULT_CANVAS_NODE_BORDER_STROKE,
  DEFAULT_CANVAS_NODE_BORDER_WIDTH,
} from '../shared/canvas-node-surface-style'

export const embedNodeModule = createCanvasNodeModule<EmbedNodeData, 'embed'>({
  type: 'embed',
  NodeComponent: EmbedNode,
  parseData: parseEmbedNodeData,
  defaultSize: { width: 320, height: 240 },
  buildDefaultData: (): EmbedNodeData => ({
    backgroundColor: DEFAULT_CANVAS_NODE_BACKGROUND_COLOR,
    backgroundOpacity: DEFAULT_CANVAS_NODE_BACKGROUND_OPACITY,
    borderStroke: DEFAULT_CANVAS_NODE_BORDER_STROKE,
    borderOpacity: DEFAULT_CANVAS_NODE_BORDER_OPACITY,
    borderWidth: DEFAULT_CANVAS_NODE_BORDER_WIDTH,
  }),
  selection: rectangularCanvasNodeSelection,
  properties: ({ node, updateNodeData }) => ({
    bindings: [
      bindCanvasPaintProperty(fillCanvasProperty, {
        getColor: () => node.data.backgroundColor ?? null,
        setColor: (backgroundColor) => updateNodeData(node.id, { backgroundColor }),
        getOpacity: () => node.data.backgroundOpacity ?? DEFAULT_CANVAS_NODE_BACKGROUND_OPACITY,
        setOpacity: (backgroundOpacity) => updateNodeData(node.id, { backgroundOpacity }),
      }),
      bindCanvasPaintProperty(borderStrokeCanvasProperty, {
        getColor: () => node.data.borderStroke ?? null,
        setColor: (borderStroke) => updateNodeData(node.id, { borderStroke }),
        getOpacity: () => node.data.borderOpacity ?? DEFAULT_CANVAS_NODE_BORDER_OPACITY,
        setOpacity: (borderOpacity) => updateNodeData(node.id, { borderOpacity }),
      }),
      bindCanvasStrokeSizeProperty(
        strokeSizeCanvasProperty,
        () => node.data.borderWidth ?? DEFAULT_CANVAS_NODE_BORDER_WIDTH,
        (borderWidth) => updateNodeData(node.id, { borderWidth }),
      ),
    ],
  }),
  contextMenu: {
    contributors: embedNodeContextMenuContributors,
  },
  placement: {
    anchor: 'top-left',
    selectOnCreate: false,
    startEditingOnCreate: false,
  },
})
