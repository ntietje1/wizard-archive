import { describe, expect, it } from 'vitest'
import {
  convertBlocksToMarkdown,
  convertTextContentToBlocks,
  convertTextToHTML,
  extractMarkdownLinks,
  isMarkdownFile,
} from '~/features/editor/utils/text-to-blocks'
import type { CustomPartialBlock } from 'convex/notes/editorSpecs'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Extract plain text from a block's inline content array */
function getBlockText(block: CustomPartialBlock): string {
  if (!block.content || !Array.isArray(block.content)) return ''
  return (block.content as Array<{ type: string; text?: string }>)
    .filter((ic) => ic.type === 'text')
    .map((ic) => ic.text ?? '')
    .join('')
}

interface ExpectedBlock {
  type: string
  text?: string
  props?: Record<string, unknown>
  children?: Array<ExpectedBlock>
}

/** Recursively compare block structure ignoring generated ids */
function assertBlocksMatch(actual: Array<CustomPartialBlock>, expected: Array<ExpectedBlock>) {
  expect(actual.length).toBe(expected.length)
  for (let i = 0; i < expected.length; i++) {
    expect(actual[i].type).toBe(expected[i].type)
    if (expected[i].text !== undefined) {
      expect(getBlockText(actual[i])).toBe(expected[i].text)
    }
    if (expected[i].props) {
      expect(actual[i].props).toMatchObject(expected[i].props!)
    }
    if (expected[i].children) {
      expect(actual[i].children).toBeDefined()
      assertBlocksMatch(actual[i].children as Array<CustomPartialBlock>, expected[i].children!)
    }
  }
}

// ===========================================================================
// convertTextToHTML
// ===========================================================================

describe('convertTextToHTML', () => {
  it('wraps a single line in a <p> tag', () => {
    expect(convertTextToHTML('Hello')).toBe('<p>Hello</p>')
  })

  it('wraps multiple lines in separate <p> tags', () => {
    expect(convertTextToHTML('Line 1\nLine 2')).toBe('<p>Line 1</p><p>Line 2</p>')
  })

  it('creates empty <p> for blank lines between content', () => {
    expect(convertTextToHTML('A\n\nB')).toBe('<p>A</p><p></p><p>B</p>')
  })

  it('returns single empty <p> for empty string', () => {
    expect(convertTextToHTML('')).toBe('<p></p>')
  })

  it('returns single empty <p> for whitespace-only input', () => {
    expect(convertTextToHTML('   \n   ')).toBe('<p></p>')
  })

  it('does not produce trailing empty paragraph from trailing newline', () => {
    expect(convertTextToHTML('Hello\n')).toBe('<p>Hello</p>')
  })

  it('handles Windows \\r\\n line endings', () => {
    expect(convertTextToHTML('A\r\nB')).toBe('<p>A</p><p>B</p>')
  })

  it('handles old Mac \\r line endings', () => {
    expect(convertTextToHTML('A\rB')).toBe('<p>A</p><p>B</p>')
  })

  it('handles mixed line endings', () => {
    expect(convertTextToHTML('A\r\nB\nC\rD')).toBe('<p>A</p><p>B</p><p>C</p><p>D</p>')
  })

  it('escapes HTML special characters', () => {
    expect(convertTextToHTML('<script>alert("xss")</script>')).toBe(
      '<p>&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;</p>',
    )
  })

  it('escapes & < > " characters', () => {
    expect(convertTextToHTML('a & b < c > d "e"')).toBe(
      '<p>a &amp; b &lt; c &gt; d &quot;e&quot;</p>',
    )
  })

  it('preserves Unicode characters', () => {
    const input = 'Hello \u{1F600} world \u00E9\u00E8'
    const result = convertTextToHTML(input)
    expect(result).toBe(`<p>${input}</p>`)
  })

  it('handles multiple consecutive empty lines', () => {
    expect(convertTextToHTML('A\n\n\nB')).toBe('<p>A</p><p></p><p></p><p>B</p>')
  })
})

// ===========================================================================
// isMarkdownFile
// ===========================================================================

describe('isMarkdownFile', () => {
  it('detects .md extension', () => {
    expect(isMarkdownFile('notes.md', '')).toBe(true)
  })

  it('detects .markdown extension', () => {
    expect(isMarkdownFile('notes.markdown', '')).toBe(true)
  })

  it('is case insensitive for extension', () => {
    expect(isMarkdownFile('README.MD', '')).toBe(true)
    expect(isMarkdownFile('notes.Markdown', '')).toBe(true)
  })

  it('detects text/markdown MIME type', () => {
    expect(isMarkdownFile('file.txt', 'text/markdown')).toBe(true)
  })

  it('detects text/x-markdown MIME type', () => {
    expect(isMarkdownFile('file.txt', 'text/x-markdown')).toBe(true)
  })

  it('returns false for plain text files', () => {
    expect(isMarkdownFile('notes.txt', 'text/plain')).toBe(false)
  })

  it('returns false for no extension and no MIME', () => {
    expect(isMarkdownFile('notes', '')).toBe(false)
  })

  it('returns false for .md in middle of filename', () => {
    expect(isMarkdownFile('readme.md.txt', 'text/plain')).toBe(false)
  })

  it('detects hidden file named .md', () => {
    expect(isMarkdownFile('.md', '')).toBe(true)
  })

  it('detects hidden markdown file with leading dot', () => {
    expect(isMarkdownFile('.notes.md', '')).toBe(true)
  })

  it('returns false for hidden file with .md in middle', () => {
    expect(isMarkdownFile('.md.txt', 'text/plain')).toBe(false)
  })
})

// ===========================================================================
// extractMarkdownLinks
// ===========================================================================

describe('extractMarkdownLinks', () => {
  it('replaces a regular markdown link with a placeholder', () => {
    const { text, placeholders } = extractMarkdownLinks('[text](url)')
    expect(placeholders.size).toBe(1)
    expect(text).not.toContain('[text](url)')
    // Placeholder should map back to original
    const [, original] = [...placeholders.entries()][0]
    expect(original).toBe('[text](url)')
  })

  it('replaces an image link with a placeholder', () => {
    const { text, placeholders } = extractMarkdownLinks('![alt](url)')
    expect(placeholders.size).toBe(1)
    expect(text).not.toContain('![alt](url)')
    const [, original] = [...placeholders.entries()][0]
    expect(original).toBe('![alt](url)')
  })

  it('replaces multiple links on one line', () => {
    const { placeholders } = extractMarkdownLinks('[a](b) and [c](d)')
    expect(placeholders.size).toBe(2)
  })

  it('does not replace links inside code blocks', () => {
    const input = '```\n[text](url)\n```'
    const { text, placeholders } = extractMarkdownLinks(input)
    expect(placeholders.size).toBe(0)
    expect(text).toBe(input)
  })

  it('does not modify lines without links', () => {
    const { text, placeholders } = extractMarkdownLinks('plain text')
    expect(placeholders.size).toBe(0)
    expect(text).toBe('plain text')
  })

  it('preserves wiki links [[name]]', () => {
    const { text, placeholders } = extractMarkdownLinks('[[some note]]')
    expect(placeholders.size).toBe(0)
    expect(text).toBe('[[some note]]')
  })
})

// ===========================================================================
// convertBlocksToMarkdown (export path)
// ===========================================================================

describe('convertBlocksToMarkdown', () => {
  it('converts a paragraph to markdown', () => {
    const blocks = [
      { type: 'paragraph', content: [{ type: 'text', text: 'Hello world' }] },
    ] as unknown as Array<CustomPartialBlock>
    const md = convertBlocksToMarkdown(blocks)
    expect(md.trim()).toBe('Hello world')
  })

  it('exports literal link text exactly as-is', () => {
    const blocks = [
      {
        type: 'paragraph',
        content: [{ type: 'text', text: '[click here](https://example.com)' }],
      },
    ] as unknown as Array<CustomPartialBlock>
    const md = convertBlocksToMarkdown(blocks)
    // Verify exact output — brackets must not be escaped
    expect(md.trim()).toBe('[click here](https://example.com)')
  })

  it('converts headings at different levels', () => {
    const blocks = [
      {
        type: 'heading',
        props: { level: 1 },
        content: [{ type: 'text', text: 'Title' }],
      },
      {
        type: 'heading',
        props: { level: 2 },
        content: [{ type: 'text', text: 'Subtitle' }],
      },
      {
        type: 'heading',
        props: { level: 3 },
        content: [{ type: 'text', text: 'Section' }],
      },
    ] as unknown as Array<CustomPartialBlock>
    const md = convertBlocksToMarkdown(blocks)
    expect(md).toContain('# Title')
    expect(md).toContain('## Subtitle')
    expect(md).toContain('### Section')
  })

  it('converts bold text', () => {
    const blocks = [
      {
        type: 'paragraph',
        content: [{ type: 'text', text: 'bold', styles: { bold: true } }],
      },
    ] as unknown as Array<CustomPartialBlock>
    const md = convertBlocksToMarkdown(blocks)
    expect(md).toContain('**bold**')
  })

  it('converts italic text', () => {
    const blocks = [
      {
        type: 'paragraph',
        content: [{ type: 'text', text: 'italic', styles: { italic: true } }],
      },
    ] as unknown as Array<CustomPartialBlock>
    const md = convertBlocksToMarkdown(blocks)
    expect(md).toContain('*italic*')
  })

  it('converts strikethrough text', () => {
    const blocks = [
      {
        type: 'paragraph',
        content: [{ type: 'text', text: 'struck', styles: { strike: true } }],
      },
    ] as unknown as Array<CustomPartialBlock>
    const md = convertBlocksToMarkdown(blocks)
    expect(md).toContain('~~struck~~')
  })

  it('converts inline code', () => {
    const blocks = [
      {
        type: 'paragraph',
        content: [{ type: 'text', text: 'code', styles: { code: true } }],
      },
    ] as unknown as Array<CustomPartialBlock>
    const md = convertBlocksToMarkdown(blocks)
    expect(md).toContain('`code`')
  })

  it('converts bold + italic combined', () => {
    const blocks = [
      {
        type: 'paragraph',
        content: [{ type: 'text', text: 'emphasis', styles: { bold: true, italic: true } }],
      },
    ] as unknown as Array<CustomPartialBlock>
    const md = convertBlocksToMarkdown(blocks)
    // Could be ***emphasis*** or **_emphasis_** etc.
    expect(md).toContain('emphasis')
    expect(md.trim()).not.toBe('emphasis') // should have some markup
  })

  it('converts bullet list items', () => {
    const blocks = [
      { type: 'bulletListItem', content: [{ type: 'text', text: 'item 1' }] },
      { type: 'bulletListItem', content: [{ type: 'text', text: 'item 2' }] },
    ] as unknown as Array<CustomPartialBlock>
    const md = convertBlocksToMarkdown(blocks)
    expect(md).toContain('item 1')
    expect(md).toContain('item 2')
    // Should have list markers
    expect(md).toMatch(/[-*] item 1/)
  })

  it('converts numbered list items', () => {
    const blocks = [
      { type: 'numberedListItem', content: [{ type: 'text', text: 'first' }] },
      { type: 'numberedListItem', content: [{ type: 'text', text: 'second' }] },
    ] as unknown as Array<CustomPartialBlock>
    const md = convertBlocksToMarkdown(blocks)
    expect(md).toMatch(/1\.\s+first/)
    expect(md).toContain('second')
  })

  it('converts code blocks', () => {
    const blocks = [
      {
        type: 'codeBlock',
        props: { language: 'javascript' },
        content: [{ type: 'text', text: 'console.log("hi")' }],
      },
    ] as unknown as Array<CustomPartialBlock>
    const md = convertBlocksToMarkdown(blocks)
    expect(md).toContain('console.log("hi")')
    expect(md).toContain('```')
  })

  it('handles empty blocks array', () => {
    const md = convertBlocksToMarkdown([])
    expect(md.trim()).toBe('')
  })

  it('converts multiple paragraphs', () => {
    const blocks = [
      { type: 'paragraph', content: [{ type: 'text', text: 'Para 1' }] },
      { type: 'paragraph', content: [{ type: 'text', text: 'Para 2' }] },
    ] as unknown as Array<CustomPartialBlock>
    const md = convertBlocksToMarkdown(blocks)
    expect(md).toContain('Para 1')
    expect(md).toContain('Para 2')
  })
})

// ===========================================================================
// convertTextContentToBlocks — markdown import
// ===========================================================================

describe('convertTextContentToBlocks - markdown', () => {
  const md = (text: string) => convertTextContentToBlocks(text, 'test.md', 'text/markdown')

  it('parses a heading', () => {
    const blocks = md('# Hello')
    expect(blocks.length).toBeGreaterThanOrEqual(1)
    const heading = blocks.find((b) => b.type === 'heading')
    expect(heading).toBeDefined()
    expect(getBlockText(heading!)).toBe('Hello')
    expect(heading!.props).toMatchObject({ level: 1 })
  })

  it('parses multiple heading levels', () => {
    const blocks = md('# H1\n\n## H2\n\n### H3')
    const headings = blocks.filter((b) => b.type === 'heading')
    expect(headings.length).toBe(3)
  })

  it('parses paragraphs', () => {
    const blocks = md('Paragraph one.\n\nParagraph two.')
    const paras = blocks.filter((b) => b.type === 'paragraph' && getBlockText(b) !== '')
    expect(paras.length).toBe(2)
    expect(getBlockText(paras[0])).toBe('Paragraph one.')
    expect(getBlockText(paras[1])).toBe('Paragraph two.')
  })

  it('parses bold text', () => {
    const blocks = md('**bold text**')
    const para = blocks.find((b) => b.type === 'paragraph')
    expect(para).toBeDefined()
    const content = para!.content as unknown as Array<{
      type: string
      text?: string
      styles?: Record<string, boolean>
    }>
    const boldItem = content.find((ic) => ic.styles?.bold)
    expect(boldItem).toBeDefined()
    expect(boldItem!.text).toBe('bold text')
  })

  it('parses italic text', () => {
    const blocks = md('*italic text*')
    const para = blocks.find((b) => b.type === 'paragraph')
    expect(para).toBeDefined()
    const content = para!.content as unknown as Array<{
      type: string
      text?: string
      styles?: Record<string, boolean>
    }>
    const italicItem = content.find((ic) => ic.styles?.italic)
    expect(italicItem).toBeDefined()
    expect(italicItem!.text).toBe('italic text')
  })

  it('parses strikethrough', () => {
    const blocks = md('~~struck~~')
    const para = blocks.find((b) => b.type === 'paragraph')
    expect(para).toBeDefined()
    const content = para!.content as unknown as Array<{
      type: string
      text?: string
      styles?: Record<string, boolean>
    }>
    const struckItem = content.find((ic) => ic.styles?.strike)
    expect(struckItem).toBeDefined()
  })

  it('parses inline code', () => {
    const blocks = md('some `inline code` here')
    const para = blocks.find((b) => b.type === 'paragraph')
    expect(para).toBeDefined()
    const content = para!.content as unknown as Array<{
      type: string
      text?: string
      styles?: Record<string, boolean>
    }>
    const codeItem = content.find((ic) => ic.styles?.code)
    expect(codeItem).toBeDefined()
    expect(codeItem!.text).toBe('inline code')
  })

  it('parses bullet list', () => {
    const blocks = md('- item 1\n- item 2')
    const listItems = blocks.filter((b) => b.type === 'bulletListItem')
    expect(listItems.length).toBe(2)
    expect(getBlockText(listItems[0])).toBe('item 1')
    expect(getBlockText(listItems[1])).toBe('item 2')
  })

  it('parses numbered list', () => {
    const blocks = md('1. first\n2. second')
    const listItems = blocks.filter((b) => b.type === 'numberedListItem')
    expect(listItems.length).toBe(2)
    expect(getBlockText(listItems[0])).toBe('first')
    expect(getBlockText(listItems[1])).toBe('second')
  })

  it('parses code block', () => {
    const blocks = md('```js\nconsole.log("hi")\n```')
    const codeBlock = blocks.find((b) => b.type === 'codeBlock')
    expect(codeBlock).toBeDefined()
  })

  it('preserves markdown links as literal text (MdLinkExtension renders them)', () => {
    const blocks = md('[click here](https://example.com)')
    const para = blocks.find((b) => b.type === 'paragraph')
    expect(para).toBeDefined()
    // Links should be preserved as literal [text](url) for MdLinkExtension
    const text = getBlockText(para!)
    expect(text).toContain('[click here](https://example.com)')
  })

  it('handles empty markdown', () => {
    const blocks = md('')
    // Should return at least an empty array or a single empty paragraph
    expect(Array.isArray(blocks)).toBe(true)
  })
})

// ===========================================================================
// convertTextContentToBlocks — plain text import
// ===========================================================================

describe('convertTextContentToBlocks - plain text', () => {
  const txt = (text: string) => convertTextContentToBlocks(text, 'test.txt', 'text/plain')

  it('converts a single line to a paragraph', () => {
    const blocks = txt('Hello world')
    const paras = blocks.filter((b) => b.type === 'paragraph')
    expect(paras.length).toBeGreaterThanOrEqual(1)
    expect(getBlockText(paras[0])).toBe('Hello world')
  })

  it('converts multiple lines to multiple paragraphs', () => {
    const blocks = txt('Line 1\nLine 2')
    const paras = blocks.filter((b) => b.type === 'paragraph' && getBlockText(b) !== '')
    expect(paras.length).toBe(2)
    expect(getBlockText(paras[0])).toBe('Line 1')
    expect(getBlockText(paras[1])).toBe('Line 2')
  })

  it('preserves empty lines as empty paragraphs', () => {
    const blocks = txt('A\n\nB')
    // Should have at least 3 blocks: A, empty, B (or A, B with spacing)
    expect(blocks.length).toBeGreaterThanOrEqual(2)
    const textsWithContent = blocks.filter((b) => getBlockText(b) !== '')
    expect(textsWithContent.length).toBe(2)
  })

  it('escapes HTML special characters in plain text', () => {
    const blocks = txt('<script>alert("xss")</script>')
    const para = blocks.find((b) => b.type === 'paragraph')
    expect(para).toBeDefined()
    const text = getBlockText(para!)
    // The HTML entities should have been parsed back to literal chars
    expect(text).toContain('<script>')
  })

  it('handles empty string', () => {
    const blocks = txt('')
    expect(Array.isArray(blocks)).toBe(true)
  })

  it('does not interpret markdown syntax as formatting', () => {
    const blocks = txt('# Not a heading\n**not bold**')
    // Should be plain paragraphs, not heading/bold blocks
    const headings = blocks.filter((b) => b.type === 'heading')
    expect(headings.length).toBe(0)
  })
})

// ===========================================================================
// Roundtrip: markdown → blocks → markdown
// ===========================================================================

describe('roundtrip: markdown → blocks → markdown', () => {
  const roundtrip = (markdown: string) => {
    const blocks = convertTextContentToBlocks(markdown, 'test.md', 'text/markdown')
    return convertBlocksToMarkdown(blocks)
  }

  it('round-trips a heading', () => {
    const result = roundtrip('# Hello')
    expect(result.trim()).toContain('# Hello')
  })

  it('round-trips bold text', () => {
    const result = roundtrip('**bold**')
    expect(result).toContain('**bold**')
  })

  it('round-trips italic text', () => {
    const result = roundtrip('*italic*')
    expect(result).toContain('*italic*')
  })

  it('round-trips strikethrough', () => {
    const result = roundtrip('~~struck~~')
    expect(result).toContain('~~struck~~')
  })

  it('round-trips inline code', () => {
    const result = roundtrip('`code`')
    expect(result).toContain('`code`')
  })

  it('round-trips bullet list', () => {
    const result = roundtrip('- item 1\n- item 2')
    expect(result).toContain('item 1')
    expect(result).toContain('item 2')
    expect(result).toMatch(/[-*] item 1/)
  })

  it('round-trips numbered list', () => {
    const result = roundtrip('1. first\n2. second')
    expect(result).toMatch(/1\.\s+first/)
    expect(result).toContain('second')
  })

  it('round-trips code block', () => {
    const result = roundtrip('```js\nconsole.log("hi")\n```')
    expect(result).toContain('```')
    expect(result).toContain('console.log("hi")')
  })

  it('round-trips multiple paragraphs', () => {
    const result = roundtrip('First paragraph.\n\nSecond paragraph.')
    expect(result).toContain('First paragraph.')
    expect(result).toContain('Second paragraph.')
  })

  it('preserves markdown links through roundtrip as literal text', () => {
    const result = roundtrip('[click here](https://example.com)')
    // Full link syntax should survive since it's stored as literal text
    expect(result).toContain('[click here](https://example.com)')
  })

  it('round-trips a mixed document', () => {
    const input = [
      '# Title',
      '',
      'A paragraph with **bold** and *italic* text.',
      '',
      '- bullet one',
      '- bullet two',
      '',
      '```',
      'some code',
      '```',
    ].join('\n')

    const result = roundtrip(input)
    expect(result).toContain('# Title')
    expect(result).toContain('**bold**')
    expect(result).toContain('*italic*')
    expect(result).toContain('bullet one')
    expect(result).toContain('some code')
  })
})

// ===========================================================================
// Roundtrip: blocks → markdown → blocks
// ===========================================================================

describe('roundtrip: blocks → markdown → blocks', () => {
  const roundtrip = (blocks: Array<CustomPartialBlock>) => {
    const md = convertBlocksToMarkdown(blocks)
    return convertTextContentToBlocks(md, 'test.md', 'text/markdown')
  }

  it('round-trips a paragraph', () => {
    const original = [
      { type: 'paragraph', content: [{ type: 'text', text: 'Hello world' }] },
    ] as unknown as Array<CustomPartialBlock>
    const result = roundtrip(original)
    assertBlocksMatch(
      result.filter((b) => getBlockText(b) !== ''),
      [{ type: 'paragraph', text: 'Hello world' }],
    )
  })

  it('round-trips a heading', () => {
    const original = [
      { type: 'heading', props: { level: 2 }, content: [{ type: 'text', text: 'Title' }] },
    ] as unknown as Array<CustomPartialBlock>
    const result = roundtrip(original)
    const heading = result.find((b) => b.type === 'heading')
    expect(heading).toBeDefined()
    expect(getBlockText(heading!)).toBe('Title')
  })

  it('round-trips styled text', () => {
    const original = [
      {
        type: 'paragraph',
        content: [
          { type: 'text', text: 'normal ' },
          { type: 'text', text: 'bold', styles: { bold: true } },
          { type: 'text', text: ' ' },
          { type: 'text', text: 'italic', styles: { italic: true } },
        ],
      },
    ] as unknown as Array<CustomPartialBlock>
    const result = roundtrip(original)
    const para = result.find((b) => b.type === 'paragraph' && getBlockText(b) !== '')
    expect(para).toBeDefined()
    const content = para!.content as unknown as Array<{
      type: string
      text?: string
      styles?: Record<string, boolean>
    }>
    expect(content.some((ic) => ic.styles?.bold)).toBe(true)
    expect(content.some((ic) => ic.styles?.italic)).toBe(true)
  })

  it('round-trips bullet list items', () => {
    const original = [
      { type: 'bulletListItem', content: [{ type: 'text', text: 'A' }] },
      { type: 'bulletListItem', content: [{ type: 'text', text: 'B' }] },
    ] as unknown as Array<CustomPartialBlock>
    const result = roundtrip(original)
    const items = result.filter((b) => b.type === 'bulletListItem')
    expect(items.length).toBe(2)
    expect(getBlockText(items[0])).toBe('A')
    expect(getBlockText(items[1])).toBe('B')
  })

  it('round-trips numbered list items', () => {
    const original = [
      { type: 'numberedListItem', content: [{ type: 'text', text: 'One' }] },
      { type: 'numberedListItem', content: [{ type: 'text', text: 'Two' }] },
    ] as unknown as Array<CustomPartialBlock>
    const result = roundtrip(original)
    const items = result.filter((b) => b.type === 'numberedListItem')
    expect(items.length).toBe(2)
  })
})

// ===========================================================================
// Edge cases
// ===========================================================================

describe('edge cases', () => {
  it('handles Unicode in markdown', () => {
    const blocks = convertTextContentToBlocks(
      '# \u{1F600} Emoji heading',
      'test.md',
      'text/markdown',
    )
    const heading = blocks.find((b) => b.type === 'heading')
    expect(heading).toBeDefined()
    expect(getBlockText(heading!)).toContain('\u{1F600}')
  })

  it('handles very long content', () => {
    const lines = Array.from({ length: 500 }, (_, i) => `Line ${i + 1}`)
    const blocks = convertTextContentToBlocks(lines.join('\n\n'), 'test.md', 'text/markdown')
    expect(blocks.length).toBeGreaterThanOrEqual(500)
  })

  it('handles malformed markdown — unclosed bold', () => {
    const blocks = convertTextContentToBlocks('**incomplete bold', 'test.md', 'text/markdown')
    expect(Array.isArray(blocks)).toBe(true)
    expect(blocks.length).toBeGreaterThanOrEqual(1)
  })

  it('handles malformed markdown — unclosed code fence', () => {
    const blocks = convertTextContentToBlocks(
      '```\nsome code\nno closing fence',
      'test.md',
      'text/markdown',
    )
    expect(Array.isArray(blocks)).toBe(true)
    expect(blocks.length).toBeGreaterThanOrEqual(1)
  })

  it('handles mixed newline styles in plain text', () => {
    const blocks = convertTextContentToBlocks('A\r\nB\nC\rD', 'test.txt', 'text/plain')
    const texts = blocks.filter((b) => getBlockText(b) !== '').map((b) => getBlockText(b))
    expect(texts).toEqual(['A', 'B', 'C', 'D'])
  })

  it('documents that angle brackets in markdown are interpreted as HTML and lost', () => {
    const input = 'Text with <angle> & "quotes" and \'apostrophes\''
    const blocks = convertTextContentToBlocks(input, 'test.md', 'text/markdown')
    const md = convertBlocksToMarkdown(blocks)
    // Angle brackets are parsed as HTML tags by the markdown parser — this is expected markdown behavior
    expect(md).not.toContain('angle')
    // But quotes and ampersands survive
    expect(md).toContain('quotes')
    expect(md).toContain('apostrophes')
  })

  it('preserves escaped angle brackets through markdown roundtrip', () => {
    const input = 'Text with \\<angle\\> brackets'
    const blocks = convertTextContentToBlocks(input, 'test.md', 'text/markdown')
    const md = convertBlocksToMarkdown(blocks)
    expect(md).toContain('angle')
  })

  it('handles only whitespace markdown', () => {
    const blocks = convertTextContentToBlocks('   \n   \n   ', 'test.md', 'text/markdown')
    expect(Array.isArray(blocks)).toBe(true)
  })
})

// ===========================================================================
// Directory export/import roundtrip
// ===========================================================================

describe('directory export/import roundtrip', () => {
  /**
   * Simulates the full export→import cycle without Convex or ZIP:
   * blocks → convertBlocksToMarkdown → convertTextContentToBlocks
   */
  const exportImportRoundtrip = (blocks: Array<CustomPartialBlock>) => {
    const md = convertBlocksToMarkdown(blocks)
    return {
      markdown: md,
      blocks: convertTextContentToBlocks(md, 'note.md', 'text/markdown'),
    }
  }

  it('note with simple paragraph survives export→import', () => {
    const original = [
      { type: 'paragraph', content: [{ type: 'text', text: 'Campaign session notes' }] },
    ] as unknown as Array<CustomPartialBlock>
    const { blocks } = exportImportRoundtrip(original)
    const nonEmpty = blocks.filter((b) => getBlockText(b) !== '')
    expect(nonEmpty.length).toBeGreaterThanOrEqual(1)
    expect(getBlockText(nonEmpty[0])).toBe('Campaign session notes')
  })

  it('multiple notes with different content all roundtrip correctly', () => {
    const note1 = [
      { type: 'paragraph', content: [{ type: 'text', text: 'Note one content' }] },
    ] as unknown as Array<CustomPartialBlock>
    const note2 = [
      { type: 'heading', props: { level: 1 }, content: [{ type: 'text', text: 'Note Two' }] },
      { type: 'paragraph', content: [{ type: 'text', text: 'Body text' }] },
    ] as unknown as Array<CustomPartialBlock>

    const result1 = exportImportRoundtrip(note1)
    const result2 = exportImportRoundtrip(note2)

    expect(result1.blocks.filter((b) => getBlockText(b) !== '').length).toBeGreaterThanOrEqual(1)
    expect(getBlockText(result1.blocks.find((b) => getBlockText(b) !== '')!)).toBe(
      'Note one content',
    )

    expect(result2.blocks.find((b) => b.type === 'heading')).toBeDefined()
    expect(
      getBlockText(result2.blocks.find((b) => b.type === 'paragraph' && getBlockText(b) !== '')!),
    ).toBe('Body text')
  })

  it('note with markdown link text survives blocks→md→blocks cycle', () => {
    const original = [
      {
        type: 'paragraph',
        content: [{ type: 'text', text: 'See [docs](https://example.com/docs) for details' }],
      },
    ] as unknown as Array<CustomPartialBlock>
    const { blocks } = exportImportRoundtrip(original)
    const para = blocks.find((b) => b.type === 'paragraph' && getBlockText(b) !== '')
    expect(para).toBeDefined()
    expect(getBlockText(para!)).toContain('[docs](https://example.com/docs)')
  })

  it('note with mixed formatting — headings, bold, italic, lists, code blocks all preserved', () => {
    const original = [
      {
        type: 'heading',
        props: { level: 1 },
        content: [{ type: 'text', text: 'Chapter 1' }],
      },
      {
        type: 'paragraph',
        content: [
          { type: 'text', text: 'Normal and ' },
          { type: 'text', text: 'bold', styles: { bold: true } },
          { type: 'text', text: ' and ' },
          { type: 'text', text: 'italic', styles: { italic: true } },
        ],
      },
      { type: 'bulletListItem', content: [{ type: 'text', text: 'item A' }] },
      { type: 'bulletListItem', content: [{ type: 'text', text: 'item B' }] },
      {
        type: 'codeBlock',
        props: { language: '' },
        content: [{ type: 'text', text: 'x = 1' }],
      },
    ] as unknown as Array<CustomPartialBlock>

    const { blocks } = exportImportRoundtrip(original)

    expect(blocks.find((b) => b.type === 'heading')).toBeDefined()
    expect(getBlockText(blocks.find((b) => b.type === 'heading')!)).toBe('Chapter 1')

    const para = blocks.find((b) => b.type === 'paragraph' && getBlockText(b) !== '')
    expect(para).toBeDefined()
    const content = para!.content as unknown as Array<{
      type: string
      text?: string
      styles?: Record<string, boolean>
    }>
    expect(content.some((ic) => ic.styles?.bold)).toBe(true)
    expect(content.some((ic) => ic.styles?.italic)).toBe(true)

    const bullets = blocks.filter((b) => b.type === 'bulletListItem')
    expect(bullets.length).toBe(2)

    expect(blocks.find((b) => b.type === 'codeBlock')).toBeDefined()
  })

  it('plain text file import creates note with paragraphs, not markdown formatting', () => {
    const textContent = '# Not a heading\n**not bold**\nJust text'
    const blocks = convertTextContentToBlocks(textContent, 'readme.txt', 'text/plain')

    // Should all be paragraphs — no heading or bold interpretation
    const headings = blocks.filter((b) => b.type === 'heading')
    expect(headings.length).toBe(0)

    const nonEmpty = blocks.filter((b) => b.type === 'paragraph' && getBlockText(b) !== '')
    expect(nonEmpty.length).toBe(3)
    expect(getBlockText(nonEmpty[0])).toBe('# Not a heading')
    expect(getBlockText(nonEmpty[1])).toBe('**not bold**')
    expect(getBlockText(nonEmpty[2])).toBe('Just text')
  })

  it('empty note — empty blocks → empty markdown → empty blocks', () => {
    const { markdown, blocks } = exportImportRoundtrip([])
    expect(markdown.trim()).toBe('')
    expect(Array.isArray(blocks)).toBe(true)
  })

  it('note with numbered list survives roundtrip', () => {
    const original = [
      { type: 'numberedListItem', content: [{ type: 'text', text: 'Step 1' }] },
      { type: 'numberedListItem', content: [{ type: 'text', text: 'Step 2' }] },
      { type: 'numberedListItem', content: [{ type: 'text', text: 'Step 3' }] },
    ] as unknown as Array<CustomPartialBlock>
    const { blocks } = exportImportRoundtrip(original)
    const items = blocks.filter((b) => b.type === 'numberedListItem')
    expect(items.length).toBe(3)
    expect(getBlockText(items[0])).toBe('Step 1')
    expect(getBlockText(items[2])).toBe('Step 3')
  })
})
