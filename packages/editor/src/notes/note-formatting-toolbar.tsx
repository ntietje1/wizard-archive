import { RichTextFormattingToolbar } from '../rich-text/formatting-toolbar/formatting-toolbar'
import type { RichTextFormattingEditor } from '../rich-text/formatting-toolbar/formatting-toolbar-model'

export function NoteFormattingToolbar({
  editor,
  visible,
}: {
  editor: RichTextFormattingEditor | null
  visible: boolean
}) {
  return (
    <RichTextFormattingToolbar
      ariaLabel="Note formatting toolbar"
      editor={editor}
      mode="full"
      visible={visible}
    />
  )
}
