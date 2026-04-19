import { createCanvasNodeModule } from '../canvas-node-module-types'
import { EmbedPreview } from './embed-node-preview'
import { parseEmbedNodeData } from './embed-node-data'
import type { EmbedNodeData } from './embed-node-data'
import { rectangularCanvasNodeSelection } from '../shared/canvas-node-selection'

export const embedNodeModule = createCanvasNodeModule<EmbedNodeData, 'embed'>({
  type: 'embed',
  renderPreview: () => <EmbedPreview />,
  parseData: parseEmbedNodeData,
  defaultSize: { width: 320, height: 240 },
  buildDefaultData: (): EmbedNodeData => ({}),
  selection: rectangularCanvasNodeSelection,
  placement: {
    anchor: 'top-left',
    selectOnCreate: false,
    startEditingOnCreate: false,
  },
})
