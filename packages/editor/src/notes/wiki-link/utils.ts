import type { CustomBlockNoteEditor } from '../editor-schema'

interface WikiLinkContextEditor {
  _tiptapEditor?: {
    state: {
      selection: {
        from: number
        $from: {
          start: () => number
          end: () => number
        }
      }
      doc: {
        textBetween: (from: number, to: number) => string
      }
    }
  }
}

/**
 * Check if the cursor is currently inside a wikilink [[...]]
 */
export function isInsideWikiLink(editor: CustomBlockNoteEditor): boolean {
  return getWikiLinkContext(editor) !== null
}

export function splitWikiLinkTargetAndDisplayName(query: string): {
  targetQuery: string
  displayName: string | null
} {
  const lastPipeIndex = query.lastIndexOf('|')
  if (lastPipeIndex === -1) {
    return {
      targetQuery: query.trim(),
      displayName: null,
    }
  }

  return {
    targetQuery: query.slice(0, lastPipeIndex).trim(),
    displayName: query.slice(lastPipeIndex + 1).trim(),
  }
}

function findActiveOpenWikiLink(textBeforeCursor: string): number {
  for (let index = textBeforeCursor.length - 1; index >= 1; index--) {
    if (textBeforeCursor[index] !== '[' || textBeforeCursor[index - 1] !== '[') {
      continue
    }

    const contentAfterOpen = textBeforeCursor.slice(index + 1)
    if (!contentAfterOpen.includes(']]')) {
      return index - 1
    }
  }

  return -1
}

function findActiveCloseWikiLink(textAfterCursor: string): number {
  for (let index = 0; index < textAfterCursor.length - 1; index++) {
    const pair = textAfterCursor.slice(index, index + 2)
    if (pair === '[[') {
      return -1
    }

    if (pair !== ']]') {
      continue
    }

    const contentBeforeClose = textAfterCursor.slice(0, index)
    return contentBeforeClose.includes('[[') ? -1 : index
  }

  return -1
}

/**
 * Get the wikilink context at the cursor position.
 * Returns the full query text (before AND after cursor) and start position.
 */
export function getWikiLinkContext(
  editor: WikiLinkContextEditor,
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

  const openBracketPos = findActiveOpenWikiLink(textBefore)

  if (openBracketPos === -1) return null

  const closeBracketPos = findActiveCloseWikiLink(textAfter)

  // Extract the full query (content between [[ and ]] or end of available text)
  const contentBefore = textBefore.slice(openBracketPos + 2)
  const contentAfter = closeBracketPos >= 0 ? textAfter.slice(0, closeBracketPos) : ''
  const query = contentBefore + contentAfter

  const startPos = blockStart + openBracketPos
  const endPos =
    closeBracketPos >= 0
      ? cursor + closeBracketPos + 2 // Include the ]]
      : cursor

  return { query, startPos, endPos }
}
