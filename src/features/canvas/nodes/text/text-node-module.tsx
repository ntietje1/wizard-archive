import { createCanvasNodeModule } from '../canvas-node-module-types'
import { rectangularCanvasNodeSelection } from '../shared/canvas-node-selection'
import {
  TEXT_NODE_DEFAULT_BACKGROUND,
  TEXT_NODE_DEFAULT_BORDER_STROKE,
  TEXT_NODE_DEFAULT_HEIGHT,
  TEXT_NODE_DEFAULT_WIDTH,
} from './text-node-constants'
import { TextNode, TextPreview } from './text-node'
import type { TextNodeData } from './text-node'
import {
  createEmptyCanvasRichTextContent,
  normalizeCanvasRichTextContent,
} from '../shared/canvas-rich-text-editor'
import {
  borderStrokeCanvasProperty,
  fillCanvasProperty,
} from '../../properties/canvas-property-definitions'
import { bindCanvasPaintProperty } from '../../properties/canvas-property-types'

export const textNodeModule = createCanvasNodeModule<TextNodeData, 'text'>({
  type: 'text',
  NodeComponent: TextNode,
  renderPreview: (data) => <TextPreview {...data} />,
  parseData: (data): TextNodeData => ({
    content: normalizeCanvasRichTextContent(data.content),
    backgroundColor: typeof data.backgroundColor === 'string' ? data.backgroundColor : null,
    borderStroke: typeof data.borderStroke === 'string' ? data.borderStroke : null,
  }),
  defaultSize: { width: TEXT_NODE_DEFAULT_WIDTH, height: TEXT_NODE_DEFAULT_HEIGHT },
  buildDefaultData: (): TextNodeData => ({
    content: createEmptyCanvasRichTextContent(),
    backgroundColor: TEXT_NODE_DEFAULT_BACKGROUND,
    borderStroke: TEXT_NODE_DEFAULT_BORDER_STROKE,
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
      }),
      bindCanvasPaintProperty(borderStrokeCanvasProperty, {
        getColor: () => node.data.borderStroke ?? null,
        setColor: (borderStroke) => updateNodeData(node.id, { borderStroke }),
      }),
    ],
  }),
})
