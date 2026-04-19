import { paintCanvasProperty } from '~/features/canvas/properties/canvas-property-definitions'
import { bindCanvasPaintProperty } from '~/features/canvas/properties/canvas-property-types'
import { createCanvasNodeModule, readString, readNumber } from '../canvas-node-module-types'
import { rectangularCanvasNodeSelection } from '../shared/canvas-node-selection'
import { StickyPreview } from './sticky-node'
import type { StickyNodeData } from './sticky-node'
import {
  STICKY_DEFAULT_COLOR,
  STICKY_DEFAULT_HEIGHT,
  STICKY_DEFAULT_OPACITY,
  STICKY_DEFAULT_WIDTH,
} from './sticky-node-constants'

export const stickyNodeModule = createCanvasNodeModule<StickyNodeData, 'sticky'>({
  type: 'sticky',
  renderPreview: (data) => (
    <StickyPreview
      label={data.label ?? ''}
      color={data.color ?? STICKY_DEFAULT_COLOR}
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
