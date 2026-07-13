import { getNearestBlockPos } from '@blocknote/core'
import type { NoteBlockId } from '../../resources/domain-id'
import type { CustomBlockNoteEditor } from '../editor-schema'

type ContextMenuPosition = {
  x: number
  y: number
}

export function getBlockNoteContextFromTarget({
  editable,
  editor,
  position,
  target,
}: {
  editable: boolean
  editor: CustomBlockNoteEditor | null
  position: ContextMenuPosition
  target: Element
}): {
  noteBlockId: NoteBlockId | undefined
  valueInlineId: string | undefined
  valueInlineInstanceId: string | undefined
  valueInlineEditable: boolean
} {
  const valueInlineElement = target.closest('[data-note-value-id]')
  return {
    noteBlockId:
      getNoteBlockIdFromEditor({ editor, position, target }) ??
      getValidDomNoteBlockId(editor, getDomNoteBlockId(target)),
    valueInlineId: valueInlineElement?.getAttribute('data-note-value-id') ?? undefined,
    valueInlineInstanceId:
      valueInlineElement?.getAttribute('data-note-value-instance-id') ?? undefined,
    valueInlineEditable: editable && valueInlineElement !== null,
  }
}

function getNoteBlockIdFromEditor({
  editor,
  position,
  target,
}: {
  editor: CustomBlockNoteEditor | null
  position: ContextMenuPosition
  target: Element
}): NoteBlockId | undefined {
  const view = getProseMirrorView(editor)
  if (!view || !target.closest('.bn-editor')) return undefined

  return (
    getNoteBlockIdAtPosition(view, view.posAtCoords({ left: position.x, top: position.y })?.pos) ??
    getNoteBlockIdAtPosition(view, getDomPosition(view, target))
  )
}

function getProseMirrorView(editor: CustomBlockNoteEditor | null) {
  try {
    return editor?.prosemirrorView
  } catch {
    return undefined
  }
}

function getNoteBlockIdAtPosition(
  view: CustomBlockNoteEditor['prosemirrorView'],
  position: number | undefined,
): NoteBlockId | undefined {
  if (position === undefined) return undefined

  try {
    const noteBlockId = getNearestBlockPos(view.state.doc, position).node.attrs.id
    return typeof noteBlockId === 'string' ? (noteBlockId as NoteBlockId) : undefined
  } catch {
    return undefined
  }
}

function getDomPosition(
  view: CustomBlockNoteEditor['prosemirrorView'],
  target: Element,
): number | undefined {
  const blockElement = target.closest('[data-node-type="blockContainer"]')
  if (!blockElement) return undefined

  try {
    return view.posAtDOM(blockElement, 0)
  } catch {
    return undefined
  }
}

function getDomNoteBlockId(target: Element): NoteBlockId | undefined {
  return target.closest('[data-node-type="blockContainer"]')?.getAttribute('data-id') as
    | NoteBlockId
    | undefined
}

function getValidDomNoteBlockId(
  editor: CustomBlockNoteEditor | null,
  noteBlockId: NoteBlockId | undefined,
): NoteBlockId | undefined {
  if (!noteBlockId) return undefined
  if (!editor) return noteBlockId

  try {
    return editor.getBlock(noteBlockId) ? noteBlockId : undefined
  } catch {
    return undefined
  }
}
