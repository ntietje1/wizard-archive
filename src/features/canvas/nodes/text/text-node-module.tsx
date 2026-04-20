import { createCanvasNodeModule, readString } from '../canvas-node-module-types'
import { rectangularCanvasNodeSelection } from '../shared/canvas-node-selection'
import { TEXT_NODE_DEFAULT_HEIGHT, TEXT_NODE_DEFAULT_WIDTH } from '../sticky/sticky-node-constants'
import { TextNode, TextPreview } from './text-node'
import type { TextNodeData } from './text-node'

export const textNodeModule = createCanvasNodeModule<TextNodeData, 'text'>({
  type: 'text',
  NodeComponent: TextNode,
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
