import { Paperclip } from 'lucide-react'
import type { DefaultReactSuggestionItem } from '@blocknote/react'
import type { CustomBlockNoteEditor } from '~/features/editor/editor-specs'

export function createEmbedSlashMenuItem(
  editor: CustomBlockNoteEditor,
): DefaultReactSuggestionItem {
  return {
    title: 'Embed',
    subtext: 'Embed a file, note, map, canvas, folder, or external URL',
    icon: <Paperclip />,
    aliases: ['file', 'image', 'pdf', 'audio', 'video'],
    onItemClick: () => {
      const currentBlock = editor.getTextCursorPosition().block
      editor.insertBlocks(
        [{ type: 'embed', props: { targetKind: 'empty' } }],
        currentBlock,
        'after',
      )
    },
  }
}
