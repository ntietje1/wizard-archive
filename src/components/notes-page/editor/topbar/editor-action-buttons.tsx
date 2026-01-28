import { useRef } from 'react'
import type { EditorContextMenuRef } from '~/components/context-menu/components/EditorContextMenu'
import { EditorContextMenu } from '~/components/context-menu/components/EditorContextMenu'
import { EmptyContextMenu } from '~/components/context-menu/components/EmptyContextMenu'
import { Button } from '~/components/shadcn/ui/button'
import { TooltipButton } from '~/components/tooltips/tooltip-button'
import { useCurrentItem } from '~/hooks/useCurrentItem'
import { useEditorNavigation } from '~/hooks/useEditorNavigation'
import { MoreVertical, X } from '~/lib/icons'

export function ContextMenuButton() {
  const { item } = useCurrentItem()
  const topbarContextMenuRef = useRef<EditorContextMenuRef>(null)

  const baseButton = (
    <EmptyContextMenu>
      <TooltipButton tooltip="More options" side="bottom">
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
      </TooltipButton>
    </EmptyContextMenu>
  )

  if (!item) {
    return baseButton
  }
  return (
    <EditorContextMenu
      ref={topbarContextMenuRef}
      viewContext="topbar"
      item={item}
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
