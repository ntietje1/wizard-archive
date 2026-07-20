import { Paperclip } from 'lucide-react'
import type { DefaultReactSuggestionItem } from '@blocknote/react'
import { EMPTY_AUTHORED_DESTINATION_SERIALIZED } from '../../resources/authored-destination'
import type { NoteBlockNoteEditor } from '../note-editor-schema'

const DEFAULT_NOTE_EMBED_WIDTH = 480

export function createEmbedItem(editor: NoteBlockNoteEditor): DefaultReactSuggestionItem {
  return {
    title: 'Embed',
    subtext: 'Embed a file, note, map, canvas, folder, or external URL',
    aliases: ['file', 'image', 'pdf', 'audio', 'video', 'note', 'map', 'canvas', 'folder', 'url'],
    icon: <Paperclip />,
    onItemClick: () => {
      const currentBlock = editor.getTextCursorPosition().block
      const embed = {
        type: 'embed' as const,
        props: {
          destination: EMPTY_AUTHORED_DESTINATION_SERIALIZED,
          previewWidth: DEFAULT_NOTE_EMBED_WIDTH,
        },
      }
      const populatedParagraph =
        currentBlock.type === 'paragraph' &&
        Array.isArray(currentBlock.content) &&
        currentBlock.content.length > 0
      if (populatedParagraph) {
        editor.insertBlocks([embed], currentBlock, 'after')
      } else {
        editor.replaceBlocks([currentBlock], [embed])
      }
    },
  }
}
