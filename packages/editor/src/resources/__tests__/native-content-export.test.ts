import * as Y from 'yjs'
import { describe, expect, it } from 'vite-plus/test'
import {
  decodeWizardCanvasDocument,
  encodeWizardCanvasDocument,
  WIZARD_CANVAS_DOCUMENT_VERSION,
} from '../../canvas/native-document'
import { noteDocumentToMarkdown } from '../../notes/document/markdown'
import { NOTE_YJS_FRAGMENT, noteBlocksToYDoc } from '../../notes/document/headless-yjs'
import { DOMAIN_ID_KIND, generateDomainId, generateUuidV7 } from '../domain-id'
import { encodeWizardMapDocument, WIZARD_MAP_DOCUMENT_VERSION } from '../map-native-document'

describe('native content exports', () => {
  it('exports the canonical note document as Markdown', () => {
    const document = noteBlocksToYDoc(
      [
        {
          id: generateDomainId(DOMAIN_ID_KIND.noteBlock),
          type: 'heading',
          props: { level: 2 },
          content: [{ type: 'text', text: 'Tide ledger', styles: {} }],
          children: [],
        },
        {
          id: generateDomainId(DOMAIN_ID_KIND.noteBlock),
          type: 'bulletListItem',
          content: [{ type: 'text', text: 'Blue glass', styles: { bold: true } }],
          children: [
            {
              id: generateDomainId(DOMAIN_ID_KIND.noteBlock),
              type: 'checkListItem',
              props: { checked: true },
              content: [
                {
                  type: 'value',
                  props: {
                    valueId: generateUuidV7(),
                    label: 'Armor',
                    expressionSource: '12',
                  },
                },
              ],
            },
          ],
        },
        {
          id: generateDomainId(DOMAIN_ID_KIND.noteBlock),
          type: 'codeBlock',
          props: { language: 'typescript' },
          content: [{ type: 'text', text: 'const armor = `12`', styles: {} }],
        },
        {
          id: generateDomainId(DOMAIN_ID_KIND.noteBlock),
          type: 'table',
          content: {
            type: 'tableContent',
            columnWidths: [120, 120],
            rows: [
              {
                cells: [
                  { type: 'tableCell', content: [{ type: 'text', text: 'Name' }] },
                  { type: 'tableCell', content: [{ type: 'text', text: 'Value' }] },
                ],
              },
              {
                cells: [
                  { type: 'tableCell', content: [{ type: 'text', text: 'Armor' }] },
                  { type: 'tableCell', content: [{ type: 'text', text: '12' }] },
                ],
              },
            ],
          },
        },
      ],
      NOTE_YJS_FRAGMENT,
    )

    const markdown = noteDocumentToMarkdown(document)
    expect(markdown).toContain('## Tide ledger')
    expect(markdown).toContain('* **Blue glass**\n  - [x] Armor')
    expect(markdown).toContain('```typescript\nconst armor = `12`\n```')
    expect(markdown).toContain('| Name | Value |\n| --- | --- |\n| Armor | 12 |')
    document.destroy()
  })

  it('encodes one versioned wizardmap document', () => {
    const bytes = encodeWizardMapDocument({ imageAssetId: null, layers: [], pins: [] })

    expect(JSON.parse(new TextDecoder().decode(bytes))).toEqual({
      version: WIZARD_MAP_DOCUMENT_VERSION,
      content: { imageAssetId: null, layers: [], pins: [] },
    })
  })

  it('round trips one versioned wizardcanvas Yjs document', () => {
    const document = new Y.Doc()
    document.getMap('nodes').set('node', { title: 'Ledger' })

    const bytes = encodeWizardCanvasDocument(document)
    expect(new TextDecoder().decode(bytes.subarray(0, WIZARD_CANVAS_DOCUMENT_VERSION.length))).toBe(
      WIZARD_CANVAS_DOCUMENT_VERSION,
    )
    const decoded = decodeWizardCanvasDocument(bytes)
    expect(decoded?.getMap('nodes').get('node')).toEqual({ title: 'Ledger' })

    decoded?.destroy()
    document.destroy()
  })
})
