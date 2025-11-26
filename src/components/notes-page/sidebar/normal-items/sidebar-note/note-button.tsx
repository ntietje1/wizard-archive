import type { Note } from 'convex/notes/types'
import { UNTITLED_NOTE_TITLE } from 'convex/notes/types'
import { useFileSidebar } from '~/contexts/FileSidebarContext'
import { useCurrentNote } from '~/hooks/useCurrentNote'
import { useNoteActions } from '~/hooks/useNoteActions'
import { NoteContextMenu } from '~/components/context-menu/sidebar/generic/note-context-menu'
import { DraggableNote } from './draggable-note'
import { SidebarItemButtonBase } from '../../sidebar-item/sidebar-item-button-base'
import { FileText } from '~/lib/icons'
import { useContextMenu } from '~/hooks/useContextMenu'
import type { Id } from 'convex/_generated/dataModel'
import { DroppableNote } from './droppable-note'
import { useFolderState } from '~/hooks/useFolderState'
import { useSidebarItemsByParent } from '~/hooks/useSidebarItems'
import { SidebarItem } from '../../sidebar-item/sidebar-item'
import {
  Collapsible,
  CollapsibleContent,
} from '~/components/shadcn/ui/collapsible'

interface NoteButtonProps {
  note: Note
  ancestorIds?: Array<Id<'notes'>>
}

export function NoteButton({ note, ancestorIds = [] }: NoteButtonProps) {
  const { renamingId, setRenamingId } = useFileSidebar()
  const { note: currentNote, selectNote } = useCurrentNote()
  const { updateNote } = useNoteActions()
  const { contextMenuRef, handleMoreOptions } = useContextMenu()
  const isSelected = currentNote?.data?._id === note._id

  const { isExpanded, toggleExpanded } = useFolderState(note._id)
  const children = useSidebarItemsByParent(note.categoryId, note._id)
  const hasChildren = (children.data && children.data.length > 0) || false

  const currentAncestors: Id<'notes'>[] = [...ancestorIds, note._id]

  const handleFinishRename = async (name: string) => {
    await updateNote.mutateAsync({ noteId: note._id, name })
    setRenamingId(null)
  }

  return (
    <DroppableNote note={note} ancestorIds={ancestorIds}>
      <DraggableNote note={note} ancestorIds={ancestorIds}>
        <Collapsible
          open={isExpanded}
          onOpenChange={toggleExpanded}
          className="w-full"
        >
          <NoteContextMenu ref={contextMenuRef} note={note}>
            <SidebarItemButtonBase
              icon={FileText}
              name={note.name || ''}
              defaultName={UNTITLED_NOTE_TITLE}
              isSelected={isSelected}
              isExpanded={isExpanded}
              isRenaming={renamingId === note._id}
              showChevron={hasChildren}
              onSelect={() => selectNote(note.slug)}
              onMoreOptions={handleMoreOptions}
              onToggleExpanded={toggleExpanded}
              onFinishRename={handleFinishRename}
            />
          </NoteContextMenu>

          <CollapsibleContent>
            <div className="relative pl-4">
              {/* Vertical line */}
              {hasChildren && (
                <div className="absolute left-[11px] top-0 bottom-0 w-px bg-muted-foreground/10" />
              )}
              {children.data?.map((item) => (
                <SidebarItem
                  key={item._id}
                  item={item}
                  ancestorIds={currentAncestors}
                />
              ))}
            </div>
          </CollapsibleContent>
        </Collapsible>
      </DraggableNote>
    </DroppableNote>
  )
}
