import { createCanvasNodeModule, readString } from './canvas-node-module-types'
import { rectangularCanvasNodeSelection } from './canvas-node-selection'
import { TextPreview } from './text-node'
import type { TextNodeData } from './text-node'
import { TEXT_NODE_DEFAULT_HEIGHT, TEXT_NODE_DEFAULT_WIDTH } from './sticky-node-constants'

export const textNodeModule = createCanvasNodeModule<TextNodeData, 'text'>({
  type: 'text',
  renderPreview: (data) => <TextPreview label={data.label ?? ''} />,
  parseData: (data): TextNodeData => ({
    label: readString(data, 'label'),
  }),
  defaultSize: { width: TEXT_NODE_DEFAULT_WIDTH, height: TEXT_NODE_DEFAULT_HEIGHT },
  buildDefaultData: (): TextNodeData => ({
    label: 'New text',
  }),
  selection: rectangularCanvasNodeSelection,
  placement: {
    anchor: 'center',
    selectOnCreate: true,
    startEditingOnCreate: true,
  },
})
