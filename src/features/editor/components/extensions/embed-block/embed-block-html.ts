import type { Props } from '@blocknote/core'
import type { embedBlockConfig } from '../../../../../../shared/editor-blocks/editor-blocknote-spec-factory'

export const NOTE_EMBED_EXTERNAL_HTML_ATTRIBUTE = 'data-note-embed-external-html'

type ParsedEmbedBlockProps = Partial<Props<typeof embedBlockConfig.propSchema>>

export function parseExternalEmbedBlockHtml(
  element: HTMLElement,
): ParsedEmbedBlockProps | undefined {
  if (!element.hasAttribute(NOTE_EMBED_EXTERNAL_HTML_ATTRIBUTE)) return undefined

  const targetKind = element.getAttribute('data-target-kind')
  if (targetKind === 'sidebarItem') {
    return {
      targetKind,
      sidebarItemId: element.getAttribute('data-sidebar-item-id') ?? undefined,
      ...parseExternalEmbedLayoutProps(element),
    }
  }
  if (targetKind === 'externalUrl') {
    return {
      targetKind,
      url: element.getAttribute('data-url') ?? undefined,
      name: element.getAttribute('data-name') ?? undefined,
      ...parseExternalEmbedLayoutProps(element),
    }
  }

  return {
    targetKind: 'empty',
    ...parseExternalEmbedLayoutProps(element),
  }
}

function parseExternalEmbedLayoutProps(element: HTMLElement) {
  return {
    previewWidth: parsePositiveNumber(element.getAttribute('data-preview-width')),
    previewHeight: parsePositiveNumber(element.getAttribute('data-preview-height')),
    previewAspectRatio: parsePositiveNumber(element.getAttribute('data-preview-aspect-ratio')),
  }
}

function parsePositiveNumber(value: string | null) {
  if (value === null) return undefined
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined
}
