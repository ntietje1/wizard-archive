import { useRef } from 'react'
import { MoreVertical, X } from 'lucide-react'
import type { EditorContextMenuRef } from '~/features/context-menu/components/editor-context-menu'
import { EditorContextMenu } from '~/features/context-menu/components/editor-context-menu'
import { EmptyContextMenu } from '~/features/context-menu/components/empty-context-menu'
import { Button } from '~/features/shadcn/components/button'
import { TooltipButton } from '~/shared/components/tooltip-button'
import { useCurrentItem } from '~/features/sidebar/hooks/useCurrentItem'
import { useEditorNavigation } from '~/features/sidebar/hooks/useEditorNavigation'

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
