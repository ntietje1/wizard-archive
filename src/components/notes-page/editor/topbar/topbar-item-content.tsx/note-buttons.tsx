import { BookOpen, Pencil } from 'lucide-react'
import { useCallback } from 'react'
import { ItemButtonWrapper } from './item-button-wrapper'
import { useEditorModeActions, useEditorModeState } from '~/hooks/useEditorMode'
import { Button } from '~/components/shadcn/ui/button'
import { useCampaign } from '~/hooks/useCampaign'

export const NoteButtons = () => {
  const { isDm } = useCampaign()
  if (!isDm) {
    return (
      <ItemButtonWrapper/>
    )
  } else {
    return (
      <ItemButtonWrapper>
        <EditorViewModeToggleButton />
      </ItemButtonWrapper>
    )
  }
}

export const EditorViewModeToggleButton = () => {
  const { editorMode } = useEditorModeState()
  const { setEditorMode } = useEditorModeActions()
  const handleEditorModeToggle = useCallback(() => {
    setEditorMode(editorMode === 'editor' ? 'viewer' : 'editor')
  }, [editorMode, setEditorMode])
  const label =
    editorMode === 'editor' ? 'Switch to viewer mode' : 'Switch to editor mode'
  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={handleEditorModeToggle}
      aria-label={label}
      title={label}
    >
      {editorMode === 'editor' ? (
        <Pencil className="h-4 w-4" />
      ) : (
        <BookOpen className="h-4 w-4" />
      )}
    </Button>
  )
}
