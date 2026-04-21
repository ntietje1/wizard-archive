import { BlockNoteView } from '@blocknote/shadcn'
import { PreventExternalDrop } from '~/features/editor/components/extensions/prevent-external-drop/prevent-external-drop'
import { useResolvedTheme } from '~/features/settings/hooks/useTheme'
import { CanvasRichTextSelectionToolbar } from './canvas-rich-text-selection-toolbar'
import type { CanvasRichTextEditor } from './canvas-rich-text-editor'

interface CanvasRichTextViewProps {
  editor: CanvasRichTextEditor
  editable: boolean
  className?: string
  onChange?: (editor: CanvasRichTextEditor) => void
}

export function CanvasRichTextView({
  editor,
  editable,
  className,
  onChange,
}: CanvasRichTextViewProps) {
  const resolvedTheme = useResolvedTheme()

  return (
    <BlockNoteView
      className={className}
      editor={editor}
      theme={resolvedTheme}
      editable={editable}
      onChange={onChange}
      sideMenu={false}
      formattingToolbar={false}
      slashMenu={false}
      linkToolbar={false}
    >
      {editable && (
        <>
          <PreventExternalDrop />
          <CanvasRichTextSelectionToolbar />
        </>
      )}
    </BlockNoteView>
  )
}
