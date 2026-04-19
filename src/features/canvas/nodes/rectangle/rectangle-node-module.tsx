import { createCanvasNodeModule, readNumber } from '../canvas-node-module-types'
import { RectanglePreview } from './rectangle-node'
import type { RectangleNodeData } from './rectangle-node'
import { rectangularCanvasNodeSelection } from '../shared/canvas-node-selection'
import { paintCanvasProperty } from '../../properties/canvas-property-definitions'
import { bindCanvasPaintProperty } from '../../properties/canvas-property-types'

export const rectangleNodeModule = createCanvasNodeModule<RectangleNodeData, 'rectangle'>({
  type: 'rectangle',
  renderPreview: (data) => (
    <RectanglePreview color={data.color ?? 'var(--foreground)'} opacity={data.opacity} />
  ),
  parseData: (data): RectangleNodeData => ({
    color: typeof data.color === 'string' ? data.color : undefined,
    opacity: readNumber(data, 'opacity'),
  }),
  buildDefaultData: (): RectangleNodeData => ({
    color: 'var(--foreground)',
    opacity: 100,
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
        getColor: () => node.data.color ?? 'var(--foreground)',
        setColor: (color) => updateNodeData(node.id, { color }),
        getOpacity: () => node.data.opacity ?? 100,
        setOpacity: (opacity) => updateNodeData(node.id, { opacity }),
      }),
    ],
  }),
})
