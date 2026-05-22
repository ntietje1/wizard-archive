import { EditorFormattingToolbar } from './formatting-toolbar'
import type { FormattingEditor } from './formatting-toolbar-model'

export function NoteFormattingToolbar({
  editor,
  visible,
}: {
  editor: FormattingEditor | null
  visible: boolean
}) {
  return <EditorFormattingToolbar editor={editor} mode="full" visible={visible} />
}
