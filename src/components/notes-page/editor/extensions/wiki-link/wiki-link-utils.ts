import type { CustomBlockNoteEditor } from '~/lib/editor-schema'

// Match unclosed wiki-link at cursor: [[ followed by content (no [[ or ]])
const UNCLOSED_WIKI_LINK_REGEX = /\[\[((?:(?!\[\[)(?!\]\]).)*)?$/

/**
 * Check if the cursor is currently inside an unclosed wikilink [[...
 */
export function isInsideWikiLink(editor: CustomBlockNoteEditor): boolean {
  const tiptap = editor._tiptapEditor
  if (!tiptap) return false
  const { state } = tiptap
  const $pos = state.selection.$from
  const text = state.doc.textBetween($pos.start(), state.selection.from)
  return UNCLOSED_WIKI_LINK_REGEX.test(text)
}

/**
 * Get the wikilink context at the cursor position.
 * Returns the query text and start position if inside an unclosed wikilink.
 */
export function getWikiLinkContext(
  editor: CustomBlockNoteEditor,
): { query: string; startPos: number } | null {
  const tiptap = editor._tiptapEditor
  if (!tiptap) return null
  const { state } = tiptap
  const $pos = state.selection.$from
  const text = state.doc.textBetween($pos.start(), state.selection.from)
  const match = UNCLOSED_WIKI_LINK_REGEX.exec(text)
  if (!match) return null
  return { query: match[1] || '', startPos: $pos.start() + match.index }
}
