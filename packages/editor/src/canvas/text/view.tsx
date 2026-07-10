import { BlockNoteView } from '@blocknote/shadcn'
import '@blocknote/shadcn/style.css'
import { useResolvedTheme } from '@wizard-archive/ui/theme/context'
import type { CSSProperties } from 'react'
import { PreventExternalDrop } from '../../rich-text/blocknote/prevent-external-drop'
import type { CanvasTextEditor } from './schema'

interface CanvasTextViewProps {
  editor: CanvasTextEditor
  editable: boolean
  className?: string
  style?: CSSProperties
  onChange?: (editor: CanvasTextEditor) => void
}

export function CanvasTextView({
  editor,
  editable,
  className,
  style,
  onChange,
}: CanvasTextViewProps) {
  const resolvedTheme = useResolvedTheme()

  return (
    <BlockNoteView
      className={className}
      editor={editor}
      style={style}
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
        </>
      )}
    </BlockNoteView>
  )
}
