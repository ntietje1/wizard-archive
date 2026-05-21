import { useRef } from 'react'
import { ClientOnly } from '@tanstack/react-router'
import { EDITOR_MODE } from 'convex/editors/types'
import { NoteContent } from '../../note-content'
import type { EditorViewerProps } from '../sidebar-item-editor'
import type { NoteWithContent } from 'convex/notes/types'
import { openBlockNoteContextMenu } from '~/features/editor/hooks/useBlockNoteContextMenu'
import { BlockNoteContextMenuProvider } from '~/features/editor/contexts/blocknote-context-menu-context'
import { isNote } from '~/features/sidebar/utils/sidebar-item-utils'
import { useEditorMode } from '~/features/sidebar/hooks/useEditorMode'
import { useNoteEditorState } from '~/features/editor/hooks/useNoteEditorState'
import { useScrollPersistence } from '~/features/editor/hooks/useScrollPersistence'
import { useScrollToHeading } from '~/features/editor/hooks/useScrollToHeading'
import { ScrollArea } from '~/features/shadcn/components/scroll-area'
import type { BlockNoteId } from 'shared/editor-blocks/types'

function getContextMenuTarget(target: EventTarget | null): Element | null {
  if (target instanceof Element) {
    return target
  }
  if (target instanceof Node) {
    return target.parentElement
  }
  return null
}

function getBlockNoteContextFromTarget(
  target: Element,
  editable: boolean,
): {
  blockNoteId: BlockNoteId | undefined
  valueInlineId: string | undefined
  valueInlineInstanceId: string | undefined
  valueInlineEditable: boolean
} {
  const blockElement = target.closest('[data-node-type="blockContainer"]')
  const valueInlineElement = target.closest('[data-note-value-id]')
  return {
    blockNoteId: blockElement?.getAttribute('data-id') as BlockNoteId | undefined,
    valueInlineId: valueInlineElement?.getAttribute('data-note-value-id') ?? undefined,
    valueInlineInstanceId:
      valueInlineElement?.getAttribute('data-note-value-instance-id') ?? undefined,
    valueInlineEditable: editable && valueInlineElement !== null,
  }
}

export function NoteEditor({ item: note }: EditorViewerProps<NoteWithContent>) {
  const { editorMode, canEdit } = useEditorMode()

  const editable = editorMode === EDITOR_MODE.EDITOR && canEdit

  const { onEditorChange, wrapperRef } = useNoteEditorState(note._id)
  const viewportRef = useRef<HTMLDivElement>(null)
  const contextMenuHandledRef = useRef(false)
  const { hasHeadingParam } = useScrollToHeading(note.content)
  useScrollPersistence(note._id, viewportRef, hasHeadingParam)

  if (!isNote(note)) {
    return (
      <div className="h-full flex items-center justify-center text-muted-foreground">
        Invalid item type for note editor.
      </div>
    )
  }

  const openNoteContextMenu = (e: React.MouseEvent, target: Element) => {
    e.preventDefault()
    e.stopPropagation()

    const isBlockNoteContext = target.closest('.bn-editor') !== null
    const blockNoteContext = isBlockNoteContext
      ? getBlockNoteContextFromTarget(target, editable)
      : {
          blockNoteId: undefined,
          valueInlineId: undefined,
          valueInlineInstanceId: undefined,
          valueInlineEditable: false,
        }

    openBlockNoteContextMenu({
      position: { x: e.clientX, y: e.clientY },
      viewContext: 'note-view',
      item: undefined,
      ...blockNoteContext,
    })
  }

  const handleWrapperMouseDownCapture = (e: React.MouseEvent) => {
    if (e.button !== 2) return
    if (!e.isTrusted) return

    const target = getContextMenuTarget(e.target)
    if (!target || target.closest('.bn-editor') === null) return
    contextMenuHandledRef.current = true
    window.setTimeout(() => {
      contextMenuHandledRef.current = false
    }, 0)
    openNoteContextMenu(e, target)
  }

  const handleWrapperContextMenu = (e: React.MouseEvent) => {
    if (!e.isTrusted) return
    if (contextMenuHandledRef.current) {
      e.preventDefault()
      e.stopPropagation()
      contextMenuHandledRef.current = false
      return
    }
    const target = getContextMenuTarget(e.target)
    if (!target) return
    openNoteContextMenu(e, target)
  }

  return (
    <ClientOnly fallback={null}>
      <BlockNoteContextMenuProvider>
        <div
          ref={wrapperRef}
          className="flex flex-col flex-1 min-h-0"
          data-testid="note-editor-wrapper"
          onMouseDownCapture={handleWrapperMouseDownCapture}
          onContextMenu={handleWrapperContextMenu}
        >
          <ScrollArea
            viewportRef={viewportRef}
            className="flex-1 min-h-0"
            contentClassName={editable ? 'note-editor-scroll-content' : undefined}
          >
            <NoteContent
              key={note._id}
              note={note}
              editable={editable}
              onEditorChange={onEditorChange}
              className="note-editor-surface"
            />
          </ScrollArea>
        </div>
      </BlockNoteContextMenuProvider>
    </ClientOnly>
  )
}
