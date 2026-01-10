import { useCallback, useRef } from 'react'
import type { TopbarContextMenuRef } from '~/components/context-menu/topbar/TopbarContextMenu'
import { TopbarContextMenu } from '~/components/context-menu/topbar/TopbarContextMenu'
import { Button } from '~/components/shadcn/ui/button'
import { useCurrentItem } from '~/hooks/useCurrentItem'
import { useEditorMode } from '~/hooks/useEditorMode'
import { useEditorNavigation } from '~/hooks/useEditorNavigation'
import { Eye, MoreVertical, Pencil, X } from '~/lib/icons'

export function EditorViewModeToggleButton() {
  const { editorMode, setEditorMode } = useEditorMode()
  const handleEditorModeToggle = useCallback(() => {
    setEditorMode(editorMode === 'editor' ? 'viewer' : 'editor')
  }, [editorMode, setEditorMode])
  return (
    <Button variant="ghost" size="icon" onClick={handleEditorModeToggle}>
      {editorMode === 'editor' ? (
        <Eye className="h-4 w-4" />
      ) : (
        <Pencil className="h-4 w-4" />
      )}
    </Button>
  )
}

export function ContextMenuButton() {
  const { item } = useCurrentItem()
  const topbarContextMenuRef = useRef<TopbarContextMenuRef>(null)

  const baseButton = (
    <Button
      variant="ghost"
      size="icon"
      onClick={(e) => {
        e.preventDefault()
        e.stopPropagation()
        topbarContextMenuRef.current?.open({
          x: e.clientX,
          y: e.clientY,
        })
      }}
    >
      <MoreVertical className="h-4 w-4" />
    </Button>
  )

  if (!item) {
    return baseButton
  }
  return (
    <TopbarContextMenu ref={topbarContextMenuRef} item={item}>
      {baseButton}
    </TopbarContextMenu>
  )
}

export function CloseButton() {
  const { clearEditorContent } = useEditorNavigation()
  return (
    <Button variant="ghost" size="icon" onClick={clearEditorContent}>
      <X className="h-4 w-4" />
    </Button>
  )
}
