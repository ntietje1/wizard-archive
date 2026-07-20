import { describe, expect, it } from 'vite-plus/test'
import { markdownToNoteBlocks } from '../markdown-import'

describe('Markdown note import', () => {
  it('preserves the standard blocks and inline formatting supported by notes', () => {
    expect(
      markdownToNoteBlocks(
        [
          '# Session',
          '',
          '**Bold** and _italic_ with `code` and ~~strike~~.',
          '',
          '- [x] Ready',
          '- [ ] Pending',
          '',
          '3. Third',
          '4. Fourth',
          '',
          '> Quoted',
          '',
          '```ts',
          'const ready = true',
          '```',
        ].join('\n'),
      ),
    ).toMatchObject([
      {
        type: 'heading',
        props: { level: 1 },
        content: [{ type: 'text', text: 'Session' }],
      },
      {
        type: 'paragraph',
        content: [
          { type: 'text', text: 'Bold', styles: { bold: true } },
          { type: 'text', text: ' and ' },
          { type: 'text', text: 'italic', styles: { italic: true } },
          { type: 'text', text: ' with ' },
          { type: 'text', text: 'code', styles: { code: true } },
          { type: 'text', text: ' and ' },
          { type: 'text', text: 'strike', styles: { strike: true } },
          { type: 'text', text: '.' },
        ],
      },
      { type: 'checkListItem', props: { checked: true } },
      { type: 'checkListItem', props: { checked: false } },
      { type: 'numberedListItem', props: { start: 3 } },
      { type: 'numberedListItem', props: { start: 4 } },
      { type: 'quote', content: [{ type: 'text', text: 'Quoted' }] },
      {
        type: 'codeBlock',
        props: { language: 'ts' },
        content: [{ type: 'text', text: 'const ready = true' }],
      },
    ])
  })

  it('imports GFM tables with header and alignment metadata', () => {
    expect(
      markdownToNoteBlocks(['| Name | Count |', '| :--- | ---: |', '| Notes | 2 |'].join('\n')),
    ).toMatchObject([
      {
        type: 'table',
        content: {
          type: 'tableContent',
          headerRows: 1,
          columnWidths: [null, null],
          rows: [
            {
              cells: [
                {
                  type: 'tableCell',
                  content: [{ type: 'text', text: 'Name' }],
                  props: { textAlignment: 'left' },
                },
                {
                  type: 'tableCell',
                  content: [{ type: 'text', text: 'Count' }],
                  props: { textAlignment: 'right' },
                },
              ],
            },
            {
              cells: [
                { type: 'tableCell', content: [{ type: 'text', text: 'Notes' }] },
                { type: 'tableCell', content: [{ type: 'text', text: '2' }] },
              ],
            },
          ],
        },
      },
    ])
  })
})
