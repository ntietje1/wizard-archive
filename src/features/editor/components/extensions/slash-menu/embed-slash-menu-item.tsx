import { Paperclip } from 'lucide-react'
import type { DefaultReactSuggestionItem } from '@blocknote/react'
import type { CustomBlockNoteEditor } from '~/features/editor/editor-specs'
import { DEFAULT_NOTE_EMBED_PREVIEW_WIDTH } from '../embed-block/embed-block-targets'

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
      editor.replaceBlocks(
        [currentBlock],
        [
          {
            type: 'embed',
            props: { targetKind: 'empty', previewWidth: DEFAULT_NOTE_EMBED_PREVIEW_WIDTH },
          },
        ],
      )
    },
  }
}
