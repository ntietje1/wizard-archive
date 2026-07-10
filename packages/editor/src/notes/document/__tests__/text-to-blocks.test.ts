import { describe, expect, it } from 'vite-plus/test'
import { convertBlocksToMarkdown, convertTextContentToBlocks } from '../text-to-blocks'

describe('convertTextContentToBlocks', () => {
  it('converts plain note text into the editor BlockNote schema', () => {
    const blocks = convertTextContentToBlocks(
      ['A waterfront bazaar.', '', '- Ask Mara about the blue-glass shipment.'].join('\n'),
      {
        fileName: 'session-notes.txt',
        mimeType: 'text/plain',
      },
    )

    expect(blocks).toHaveLength(2)
    expect(blocks).toEqual([
      expect.objectContaining({
        type: 'paragraph',
        content: [expect.objectContaining({ text: 'A waterfront bazaar.' })],
      }),
      expect.objectContaining({
        type: 'paragraph',
        content: [expect.objectContaining({ text: '- Ask Mara about the blue-glass shipment.' })],
      }),
    ])
  })

  it('imports HTML as structured note blocks instead of escaped plain text', () => {
    const blocks = convertTextContentToBlocks('<h2>Dock Ward</h2><p>Ask Mara.</p>', {
      fileName: 'session-notes.html',
      mimeType: 'text/html',
    })

    expect(blocks).toEqual([
      expect.objectContaining({
        type: 'heading',
        props: expect.objectContaining({ level: 2 }),
        content: [expect.objectContaining({ text: 'Dock Ward' })],
      }),
      expect.objectContaining({
        type: 'paragraph',
        content: [expect.objectContaining({ text: 'Ask Mara.' })],
      }),
    ])
  })

  it('keeps styled Markdown link labels in the fallback note text', () => {
    const blocks = convertTextContentToBlocks(
      'Meet [**Mara**](https://example.com/mara) at the dock.',
      {
        fileName: 'session-notes.md',
        mimeType: 'text/markdown',
      },
    )

    expect(blocks).toEqual([
      expect.objectContaining({
        type: 'paragraph',
        content: [
          expect.objectContaining({ text: 'Meet ' }),
          expect.objectContaining({ text: '[**Mara**](https://example.com/mara)' }),
          expect.objectContaining({ text: ' at the dock.' }),
        ],
      }),
    ])
  })

  it('imports HTML tables without treating table content as inline text', () => {
    const blocks = convertTextContentToBlocks(
      '<table><tbody><tr><td>Room</td><td>Clue</td></tr></tbody></table>',
      {
        fileName: 'session-notes.html',
        mimeType: 'text/html',
      },
    )

    expect(blocks).toEqual([
      expect.objectContaining({
        type: 'table',
        content: expect.objectContaining({ type: 'tableContent' }),
      }),
    ])
  })

  it('round-trips value inlines through Markdown export and import', () => {
    const markdown = convertBlocksToMarkdown([
      {
        type: 'paragraph',
        content: [
          { type: 'text', text: 'Bonus ', styles: {} },
          {
            type: 'value',
            props: {
              valueId: 'value-1',
              slug: 'prof_bonus',
              expressionSource: '3',
            },
          },
          { type: 'text', text: ' applies.', styles: {} },
        ],
      },
    ])

    expect(markdown).toContain('data-note-value-inline="true"')
    expect(markdown).toContain('data-note-value-id="value-1"')

    const blocks = convertTextContentToBlocks(markdown, {
      fileName: 'session-notes.md',
      mimeType: 'text/markdown',
    })

    expect(blocks).toEqual([
      expect.objectContaining({
        type: 'paragraph',
        content: [
          expect.objectContaining({ text: 'Bonus ' }),
          {
            type: 'value',
            props: {
              valueId: 'value-1',
              slug: 'prof_bonus',
              expressionSource: '3',
            },
          },
          expect.objectContaining({ text: ' applies.' }),
        ],
      }),
    ])
  })

  it('imports Markdown value inline HTML structurally when display content contains nested spans', () => {
    const blocks = convertTextContentToBlocks(
      'Bonus <span data-note-value-inline="true" data-note-value-id="value-1" data-note-value-slug="prof_bonus" data-note-value-expression-source="3"><span>prof_bonus</span></span> applies.',
      {
        fileName: 'session-notes.md',
        mimeType: 'text/markdown',
      },
    )

    expect(blocks).toEqual([
      expect.objectContaining({
        type: 'paragraph',
        content: [
          expect.objectContaining({ text: 'Bonus ' }),
          {
            type: 'value',
            props: {
              valueId: 'value-1',
              slug: 'prof_bonus',
              expressionSource: '3',
            },
          },
          expect.objectContaining({ text: ' applies.' }),
        ],
      }),
    ])
  })

  it('imports external value inline HTML as value content', () => {
    const blocks = convertTextContentToBlocks(
      '<p>Bonus <span data-note-value-inline="true" data-note-value-id="value-1" data-note-value-slug="prof_bonus" data-note-value-expression-source="3">prof_bonus</span> applies.</p>',
      {
        fileName: 'session-notes.html',
        mimeType: 'text/html',
      },
    )

    expect(blocks).toEqual([
      expect.objectContaining({
        type: 'paragraph',
        content: [
          expect.objectContaining({ text: 'Bonus ' }),
          {
            type: 'value',
            props: {
              valueId: 'value-1',
              slug: 'prof_bonus',
              expressionSource: '3',
            },
          },
          expect.objectContaining({ text: ' applies.' }),
        ],
      }),
    ])
  })
})
