import { createReactBlockSpec } from '@blocknote/react'
import { embedBlockConfig } from '../../../../../../shared/editor-blocks/editor-blocknote-spec-factory'
import { RenderEmbedBlock, RenderExternalEmbedBlock } from './embed-block-renderers'

export const reactEmbedBlockSpec = createReactBlockSpec(embedBlockConfig, {
  render: RenderEmbedBlock,
  toExternalHTML: RenderExternalEmbedBlock,
})()
