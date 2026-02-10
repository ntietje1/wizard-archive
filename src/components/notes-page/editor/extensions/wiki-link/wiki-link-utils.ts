import type { CustomBlockNoteEditor } from 'convex/notes/editorSpecs'

/**
 * Check if the cursor is currently inside a wikilink [[...]]
 */
export function isInsideWikiLink(editor: CustomBlockNoteEditor): boolean {
  return getWikiLinkContext(editor) !== null
}

/**
 * Get the wikilink context at the cursor position.
 * Returns the full query text (before AND after cursor) and start position.
 */
export function getWikiLinkContext(
  editor: CustomBlockNoteEditor,
): { query: string; startPos: number; endPos: number } | null {
  const tiptap = editor._tiptapEditor
  if (!tiptap) return null

  const { state } = tiptap
  const cursor = state.selection.from
  const $pos = state.selection.$from
  const blockStart = $pos.start()
  const blockEnd = $pos.end()

  // Get text before and after cursor within the block
  const textBefore = state.doc.textBetween(blockStart, cursor)
  const textAfter = state.doc.textBetween(cursor, blockEnd)

  // Find the opening [[ before cursor
  // We need to find the last [[ that isn't closed before the cursor
  let openBracketPos = -1
  let i = textBefore.length - 1
  while (i >= 1) {
    if (textBefore[i] === '[' && textBefore[i - 1] === '[') {
      // Found [[, check if there's a ]] between this and cursor
      const afterOpen = textBefore.slice(i + 1)
      if (!afterOpen.includes(']]')) {
        openBracketPos = i - 1
        break
      }
    }
    i--
  }

  if (openBracketPos === -1) return null

  // Find the closing ]] after cursor (if it exists)
  let closeBracketPos = -1
  for (let j = 0; j < textAfter.length - 1; j++) {
    if (textAfter[j] === ']' && textAfter[j + 1] === ']') {
      // Make sure this ]] isn't preceded by another [[ (which would start a new link)
      const beforeClose = textAfter.slice(0, j)
      if (!beforeClose.includes('[[')) {
        closeBracketPos = j
        break
      }
      break // Stop at first ]] regardless
    }
    // If we hit a new [[, stop looking
    if (textAfter[j] === '[' && textAfter[j + 1] === '[') {
      break
    }
  }

  // Extract the full query (content between [[ and ]] or end of available text)
  const contentBefore = textBefore.slice(openBracketPos + 2)
  const contentAfter =
    closeBracketPos >= 0 ? textAfter.slice(0, closeBracketPos) : ''
  const query = contentBefore + contentAfter

  const startPos = blockStart + openBracketPos
  const endPos =
    closeBracketPos >= 0
      ? cursor + closeBracketPos + 2 // Include the ]]
      : cursor

  return { query, startPos, endPos }
}
