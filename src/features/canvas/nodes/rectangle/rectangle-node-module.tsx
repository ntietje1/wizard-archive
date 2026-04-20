import { createCanvasNodeModule, readNumber } from '../canvas-node-module-types'
import { RectangleNode, RectanglePreview } from './rectangle-node'
import type { RectangleNodeData } from './rectangle-node'
import { rectangularCanvasNodeSelection } from '../shared/canvas-node-selection'
import { paintCanvasProperty } from '../../properties/canvas-property-definitions'
import { bindCanvasPaintProperty } from '../../properties/canvas-property-types'

const DEFAULT_RECTANGLE_COLOR = 'var(--foreground)'
const DEFAULT_RECTANGLE_OPACITY = 100

export const rectangleNodeModule = createCanvasNodeModule<RectangleNodeData, 'rectangle'>({
  type: 'rectangle',
  NodeComponent: RectangleNode,
  renderPreview: (data) => (
    <RectanglePreview
      color={data.color ?? DEFAULT_RECTANGLE_COLOR}
      opacity={data.opacity ?? DEFAULT_RECTANGLE_OPACITY}
    />
  ),
  parseData: (data): RectangleNodeData => ({
    color: typeof data.color === 'string' ? data.color : undefined,
    opacity: readNumber(data, 'opacity'),
  }),
  buildDefaultData: (): RectangleNodeData => ({
    color: DEFAULT_RECTANGLE_COLOR,
    opacity: DEFAULT_RECTANGLE_OPACITY,
  }),
  selection: rectangularCanvasNodeSelection,
  placement: {
    anchor: 'top-left',
    selectOnCreate: true,
    startEditingOnCreate: false,
  },
  properties: ({ node, updateNodeData }) => ({
    bindings: [
      bindCanvasPaintProperty(paintCanvasProperty, {
        getColor: () => node.data.color ?? DEFAULT_RECTANGLE_COLOR,
        setColor: (color) => updateNodeData(node.id, { color }),
        getOpacity: () => node.data.opacity ?? DEFAULT_RECTANGLE_OPACITY,
        setOpacity: (opacity) => updateNodeData(node.id, { opacity }),
      }),
    ],
  }),
})
