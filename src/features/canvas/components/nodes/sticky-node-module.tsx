import { createCanvasNodeModule, readNumber, readString } from './canvas-node-module-types'
import { StickyPreview } from './sticky-node'
import type { StickyNodeData } from './sticky-node'
import { rectangularCanvasNodeSelection } from './canvas-node-selection'
import {
  STICKY_DEFAULT_COLOR,
  STICKY_DEFAULT_HEIGHT,
  STICKY_DEFAULT_OPACITY,
  STICKY_DEFAULT_WIDTH,
} from './sticky-node-constants'
import { paintCanvasProperty } from '../../properties/canvas-property-definitions'
import { bindCanvasPaintProperty } from '../../properties/canvas-property-types'

export const stickyNodeModule = createCanvasNodeModule<StickyNodeData, 'sticky'>({
  type: 'sticky',
  renderPreview: (data) => (
    <StickyPreview
      label={data.label ?? ''}
      color={data.color ?? 'transparent'}
      opacity={data.opacity ?? STICKY_DEFAULT_OPACITY}
    />
  ),
  parseData: (data): StickyNodeData => ({
    label: readString(data, 'label'),
    color: readString(data, 'color'),
    opacity: readNumber(data, 'opacity'),
  }),
  defaultSize: { width: STICKY_DEFAULT_WIDTH, height: STICKY_DEFAULT_HEIGHT },
  buildDefaultData: (): StickyNodeData => ({
    label: '',
    color: STICKY_DEFAULT_COLOR,
    opacity: STICKY_DEFAULT_OPACITY,
  }),
  selection: rectangularCanvasNodeSelection,
  placement: {
    anchor: 'center',
    selectOnCreate: true,
    startEditingOnCreate: true,
  },
  properties: ({ node, updateNodeData }) => ({
    bindings: [
      bindCanvasPaintProperty(paintCanvasProperty, {
        getColor: () => node.data.color ?? STICKY_DEFAULT_COLOR,
        setColor: (color) => updateNodeData(node.id, { color }),
        getOpacity: () => node.data.opacity ?? STICKY_DEFAULT_OPACITY,
        setOpacity: (opacity) => updateNodeData(node.id, { opacity }),
      }),
    ],
  }),
})
