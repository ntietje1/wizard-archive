import { BookOpen, Pencil } from 'lucide-react'
import { useCallback } from 'react'
import { useEditorModeActions, useEditorModeState } from '~/hooks/useEditorMode'
import { Button } from '~/components/shadcn/ui/button'
import { useCampaign } from '~/hooks/useCampaign'
import { TooltipButton } from '~/components/tooltips/tooltip-button'
import { EmptyContextMenu } from '~/components/context-menu/components/EmptyContextMenu'

export const EditorViewModeToggleButton = ({
  disabled,
}: {
  disabled?: boolean
}) => {
  const { editorMode } = useEditorModeState()
  const { setEditorMode } = useEditorModeActions()
  const { isDm } = useCampaign()
  const handleEditorModeToggle = useCallback(() => {
    setEditorMode(editorMode === 'editor' ? 'viewer' : 'editor')
  }, [editorMode, setEditorMode])
  const label =
    editorMode === 'editor' ? 'Switch to viewer mode' : 'Switch to editor mode'
  if (!isDm) {
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
          {editorMode === 'editor' ? (
            <Pencil className="h-4 w-4" />
          ) : (
            <BookOpen className="h-4 w-4" />
          )}
        </Button>
      </TooltipButton>
    </EmptyContextMenu>
  )
}
