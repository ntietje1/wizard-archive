import { describe, expect, it } from 'vite-plus/test'
import {
  NOTE_EMBED_EXTERNAL_HTML_ATTRIBUTE,
  parseExternalEmbedBlockHtml,
} from '../embed-block-html'

describe('parseExternalEmbedBlockHtml', () => {
  it('parses sidebar item embed target and layout props from external HTML', () => {
    const element = document.createElement('section')
    element.setAttribute(NOTE_EMBED_EXTERNAL_HTML_ATTRIBUTE, 'true')
    element.setAttribute('data-target-kind', 'sidebarItem')
    element.setAttribute('data-sidebar-item-id', 'note_1')
    element.setAttribute('data-preview-width', '480')
    element.setAttribute('data-preview-height', '320')
    element.setAttribute('data-preview-aspect-ratio', '1.5')

    expect(parseExternalEmbedBlockHtml(element)).toEqual({
      targetKind: 'resource',
      resourceId: 'note_1',
      previewWidth: 480,
      previewHeight: 320,
      previewAspectRatio: 1.5,
    })
  })

  it('ignores non-positive layout props', () => {
    const element = document.createElement('section')
    element.setAttribute(NOTE_EMBED_EXTERNAL_HTML_ATTRIBUTE, 'true')
    element.setAttribute('data-target-kind', 'externalUrl')
    element.setAttribute('data-url', 'https://example.com/file.pdf')
    element.setAttribute('data-preview-width', '0')
    element.setAttribute('data-preview-height', '-1')

    expect(parseExternalEmbedBlockHtml(element)).toEqual({
      targetKind: 'externalUrl',
      url: 'https://example.com/file.pdf',
      name: undefined,
      previewWidth: undefined,
      previewHeight: undefined,
      previewAspectRatio: undefined,
    })
  })
})
