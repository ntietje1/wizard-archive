import { SideMenuExtension } from '@blocknote/core/extensions'
import { useComponentsContext, useExtension, useExtensionState } from '@blocknote/react'
import { GripVertical } from 'lucide-react'
import type { BlockNoteId } from 'shared/editor-blocks/types'
import type { NoteWithContent } from 'shared/notes/types'
import { openBlockNoteContextMenu } from '~/features/editor/hooks/useBlockNoteContextMenu'

export function BlockDragHandleButton({ note }: { note: NoteWithContent }) {
  const Components = useComponentsContext()!
  const sideMenu = useExtension(SideMenuExtension)
  const block = useExtensionState(SideMenuExtension, {
    selector: (state) => state?.block,
  })

  if (!block) return null

  function handleContextMenu(e: React.MouseEvent<HTMLElement>) {
    e.preventDefault()
    e.stopPropagation()
    e.nativeEvent.stopImmediatePropagation?.()

    openBlockNoteContextMenu({
      position: { x: e.clientX, y: e.clientY },
      viewContext: 'note-view',
      note,
      blockNoteId: block?.id as BlockNoteId | undefined,
    })
  }

  return (
    <span className="inline-flex size-6 pr-3" role="presentation" onContextMenu={handleContextMenu}>
      <Components.SideMenu.Button
        label="Drag block"
        draggable={true}
        onDragStart={(event) => sideMenu.blockDragStart(event, block)}
        onDragEnd={sideMenu.blockDragEnd}
        className="!p-0 !px-0 !h-6 !w-4 !min-w-4 !text-muted-foreground cursor-grab active:cursor-grabbing"
        icon={<GripVertical size={18} />}
        data-testid="block-drag-handle-button"
      />
    </span>
  )
}
