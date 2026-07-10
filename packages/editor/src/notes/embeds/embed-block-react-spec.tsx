import { createReactBlockSpec } from '@blocknote/react'
import { embedBlockConfig } from '../document/schema-factory'
import { parseExternalEmbedBlockHtml } from './embed-block-html'
import { RenderEmbedBlock, RenderExternalEmbedBlock } from './embed-block-renderers'

export const reactEmbedBlockSpec = createReactBlockSpec(embedBlockConfig, {
  parse: parseExternalEmbedBlockHtml,
  render: RenderEmbedBlock,
  toExternalHTML: RenderExternalEmbedBlock,
})()
