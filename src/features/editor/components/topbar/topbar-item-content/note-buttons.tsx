import { BookOpen, Pencil } from 'lucide-react'
import { useCallback } from 'react'
import { EDITOR_MODE } from 'convex/editors/types'
import { useEditorMode } from '~/features/sidebar/hooks/useEditorMode'
import { Button } from '~/features/shadcn/components/button'
import { TooltipButton } from '~/shared/components/tooltip-button'
import { EmptyContextMenu } from '~/features/context-menu/components/empty-context-menu'

export const EditorViewModeToggleButton = ({
  disabled,
}: {
  disabled?: boolean
}) => {
  const { editorMode, canEdit, setEditorMode } = useEditorMode()
  const handleEditorModeToggle = useCallback(() => {
    setEditorMode(
      editorMode === EDITOR_MODE.EDITOR
        ? EDITOR_MODE.VIEWER
        : EDITOR_MODE.EDITOR,
    )
  }, [editorMode, setEditorMode])
  const label =
    editorMode === EDITOR_MODE.EDITOR
      ? 'Switch to viewer mode'
      : 'Switch to editor mode'
  if (!canEdit) {
    return null
  }
  return (
    <EmptyContextMenu>
      <TooltipButton tooltip={label} side="bottom">
        <Button
          variant="ghost"
          size="icon"
          onClick={handleEditorModeToggle}
          aria-label={label}
          title={label}
          disabled={disabled}
        >
          {editorMode === EDITOR_MODE.EDITOR ? (
            <Pencil className="h-4 w-4" />
          ) : (
            <BookOpen className="h-4 w-4" />
          )}
        </Button>
      </TooltipButton>
    </EmptyContextMenu>
  )
}
