import { filterSuggestionItems } from '@blocknote/core'
import {
  SuggestionMenuController,
  getDefaultReactSlashMenuItems,
} from '@blocknote/react'
import type { CustomBlockNoteEditor } from '~/lib/editor-schema'

export const SlashMenu = ({ editor }: { editor: CustomBlockNoteEditor }) => {
  return (
    <SuggestionMenuController
      triggerCharacter={'/'}
      getItems={(query) =>
        Promise.resolve(
          filterSuggestionItems(getDefaultReactSlashMenuItems(editor), query),
        )
      }
    />
  )
}
