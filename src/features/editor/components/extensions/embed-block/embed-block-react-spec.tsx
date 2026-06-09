import { createReactBlockSpec } from '@blocknote/react'
import { embedBlockConfig } from '../../../../../../shared/editor-blocks/editor-blocknote-spec-factory'
import { NOTE_EMBED_EXTERNAL_HTML_ATTRIBUTE } from './embed-block-html'
import { RenderEmbedBlock, RenderExternalEmbedBlock } from './embed-block-renderers'
import type { Props } from '@blocknote/core'

export const reactEmbedBlockSpec = createReactBlockSpec(embedBlockConfig, {
  parse: parseExternalEmbedBlockHtml,
  render: RenderEmbedBlock,
  toExternalHTML: RenderExternalEmbedBlock,
})()

type ParsedEmbedBlockProps = Partial<Props<typeof embedBlockConfig.propSchema>>

function parseExternalEmbedBlockHtml(element: HTMLElement): ParsedEmbedBlockProps | undefined {
  if (!element.hasAttribute(NOTE_EMBED_EXTERNAL_HTML_ATTRIBUTE)) return undefined

  const targetKind = element.getAttribute('data-target-kind')
  if (targetKind === 'sidebarItem') {
    return {
      targetKind,
      sidebarItemId: element.getAttribute('data-sidebar-item-id') ?? undefined,
      previewWidth: parsePositiveNumber(element.getAttribute('data-preview-width')),
    }
  }
  if (targetKind === 'externalUrl') {
    return {
      targetKind,
      url: element.getAttribute('data-url') ?? undefined,
      name: element.getAttribute('data-name') ?? undefined,
      previewWidth: parsePositiveNumber(element.getAttribute('data-preview-width')),
    }
  }

  return { targetKind: 'empty' }
}

function parsePositiveNumber(value: string | null) {
  if (value === null) return undefined
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined
}
