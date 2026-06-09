import { createReactBlockSpec } from '@blocknote/react'
import { embedBlockConfig } from '../../../../../../shared/editor-blocks/editor-blocknote-spec-factory'
import { parseExternalEmbedBlockHtml } from './embed-block-html'
import { RenderEmbedBlock, RenderExternalEmbedBlock } from './embed-block-renderers'

export const reactEmbedBlockSpec = createReactBlockSpec(embedBlockConfig, {
  parse: parseExternalEmbedBlockHtml,
  render: RenderEmbedBlock,
  toExternalHTML: RenderExternalEmbedBlock,
})()
