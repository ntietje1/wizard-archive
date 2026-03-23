import { useRef } from 'react'
import type { EditorContextMenuRef } from '~/features/context-menu/components/EditorContextMenu'
import { EditorContextMenu } from '~/features/context-menu/components/EditorContextMenu'
import { EmptyContextMenu } from '~/features/context-menu/components/EmptyContextMenu'
import { Button } from '~/features/shadcn/components/button'
import { TooltipButton } from '~/features/shared/components/tooltip-button'
import { useCurrentItem } from '~/features/sidebar/hooks/useCurrentItem'
import { useEditorNavigation } from '~/features/sidebar/hooks/useEditorNavigation'
import { MoreVertical, X } from '~/features/shared/utils/icons'

export function ContextMenuButton({ isTrashView }: { isTrashView?: boolean }) {
  const { item } = useCurrentItem()
  const topbarContextMenuRef = useRef<EditorContextMenuRef>(null)

  const hasMenu = !!item || isTrashView

  const baseButton = (
    <EmptyContextMenu>
      <TooltipButton tooltip="More options" side="bottom">
        <Button
          variant="ghost"
          size="icon"
          disabled={!hasMenu}
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
      </TooltipButton>
    </EmptyContextMenu>
  )

  if (!hasMenu) {
    return baseButton
  }
  return (
    <EditorContextMenu
      ref={topbarContextMenuRef}
      viewContext="topbar"
      item={item ?? undefined}
      isTrashView={isTrashView}
    >
      {baseButton}
    </EditorContextMenu>
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
