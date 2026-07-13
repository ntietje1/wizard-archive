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
      const hasParagraphContent =
        currentBlock.type === 'paragraph' &&
        Array.isArray(currentBlock.content) &&
        currentBlock.content.length > 0
      if (hasParagraphContent) {
        editor.insertBlocks([embedBlock], currentBlock, 'after')
      } else {
        editor.replaceBlocks([currentBlock], [embedBlock])
      }
      editor.focus()
    },
  }
}
