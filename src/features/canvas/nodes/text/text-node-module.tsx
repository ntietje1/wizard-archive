import { createCanvasNodeModule } from '../canvas-node-module-types'
import { rectangularCanvasNodeSelection } from '../shared/canvas-node-selection'
import { TEXT_NODE_DEFAULT_HEIGHT, TEXT_NODE_DEFAULT_WIDTH } from './text-node-constants'
import { TextNode } from './text-node'
import type { TextNodeData } from './text-node'
import {
  createEmptyCanvasRichTextContent,
  normalizeCanvasRichTextContent,
} from '../shared/canvas-rich-text-editor'
import {
  fillCanvasProperty,
  linePaintCanvasProperty,
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
  readCanvasNodeBorderWidth,
  readCanvasNodeSurfaceColor,
  readCanvasNodeSurfaceOpacity,
} from '../shared/canvas-node-surface-style'

export const textNodeModule = createCanvasNodeModule<TextNodeData, 'text'>({
  type: 'text',
  NodeComponent: TextNode,
  parseData: (data): TextNodeData => ({
    content: normalizeCanvasRichTextContent(data.content),
    backgroundColor: readCanvasNodeSurfaceColor(data.backgroundColor),
    backgroundOpacity: readCanvasNodeSurfaceOpacity(data.backgroundOpacity),
    borderStroke: readCanvasNodeSurfaceColor(data.borderStroke),
    borderOpacity: readCanvasNodeSurfaceOpacity(data.borderOpacity),
    borderWidth: readCanvasNodeBorderWidth(data.borderWidth),
  }),
  defaultSize: { width: TEXT_NODE_DEFAULT_WIDTH, height: TEXT_NODE_DEFAULT_HEIGHT },
  buildDefaultData: (): TextNodeData => ({
    content: createEmptyCanvasRichTextContent(),
    backgroundColor: DEFAULT_CANVAS_NODE_BACKGROUND_COLOR,
    backgroundOpacity: DEFAULT_CANVAS_NODE_BACKGROUND_OPACITY,
    borderStroke: DEFAULT_CANVAS_NODE_BORDER_STROKE,
    borderOpacity: DEFAULT_CANVAS_NODE_BORDER_OPACITY,
    borderWidth: DEFAULT_CANVAS_NODE_BORDER_WIDTH,
  }),
  selection: rectangularCanvasNodeSelection,
  placement: {
    anchor: 'center',
    selectOnCreate: true,
    startEditingOnCreate: true,
  },
  properties: ({ node, updateNodeData }) => ({
    bindings: [
      bindCanvasPaintProperty(fillCanvasProperty, {
        getColor: () => node.data.backgroundColor ?? null,
        setColor: (backgroundColor) => updateNodeData(node.id, { backgroundColor }),
        getOpacity: () => node.data.backgroundOpacity ?? DEFAULT_CANVAS_NODE_BACKGROUND_OPACITY,
        setOpacity: (backgroundOpacity) => updateNodeData(node.id, { backgroundOpacity }),
      }),
      bindCanvasPaintProperty(linePaintCanvasProperty, {
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
})
