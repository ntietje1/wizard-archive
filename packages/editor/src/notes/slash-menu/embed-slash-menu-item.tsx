import { Paperclip } from 'lucide-react'
import type { DefaultReactSuggestionItem } from '@blocknote/react'
import type { CustomBlockNoteEditor } from '../editor-schema'
import { DEFAULT_NOTE_EMBED_PREVIEW_WIDTH } from '../embeds/block-targets'

export function createEmbedSlashMenuItem(
  editor: CustomBlockNoteEditor,
): DefaultReactSuggestionItem {
  return {
    title: 'Embed',
    subtext: 'Embed a file, note, map, canvas, folder, or external URL',
    icon: <Paperclip />,
    aliases: ['file', 'image', 'pdf', 'audio', 'video', 'note', 'map', 'canvas', 'folder', 'url'],
    onItemClick: () => {
      const currentBlock = editor.getTextCursorPosition().block
      const embedBlock = {
        type: 'embed' as const,
        props: { targetKind: 'empty' as const, previewWidth: DEFAULT_NOTE_EMBED_PREVIEW_WIDTH },
      }
      if (blockHasContent(currentBlock)) {
        editor.insertBlocks([embedBlock], currentBlock, 'after')
      } else {
        editor.replaceBlocks([currentBlock], [embedBlock])
      }
      editor.focus()
    },
  }
}

function blockHasContent(block: { content?: unknown }): boolean {
  if (typeof block.content === 'string') return block.content.trim().length > 0
  if (!Array.isArray(block.content)) return false
  return block.content.some((entry) => {
    if (typeof entry === 'string') return entry.trim().length > 0
    if (!entry || typeof entry !== 'object') return false
    return 'text' in entry ? String(entry.text).trim().length > 0 : true
  })
}
