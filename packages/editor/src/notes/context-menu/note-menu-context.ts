import { use } from 'react'
import type { NoteBlock } from '../document/model'
import type { NoteBlockId } from '../../resources/domain-id'
import type { NoteItemWithContent } from '../../notes/item-contract'
import type { WorkspaceMenuContext } from '../../workspace/menu-context'
import type { CustomBlockNoteEditor } from '../editor-schema'
import { getBlockShareTargetBlocks } from '../sharing/block-share-targets'
import { BlockNoteContextMenuContext } from './blocknote-context-menu'

interface NoteWorkspaceMenuContextFields {
  note?: NoteItemWithContent
  editor?: unknown
  position?: { x: number; y: number }
  noteBlockId?: NoteBlockId
  isEditorTextContext?: boolean
  valueInlineId?: string
  valueInlineInstanceId?: string
  valueInlineEditable?: boolean
  openValueInline?: (valueId: string, instanceId: string | undefined) => void
}

export interface NoteBlockShareTargets {
  blocks: Array<NoteBlock>
  note: NoteItemWithContent | undefined
}

export function useNoteWorkspaceMenuContextFields(): NoteWorkspaceMenuContextFields {
  const blockNoteContext = use(BlockNoteContextMenuContext)
  if (!blockNoteContext) return {}

  return {
    note: blockNoteContext.note,
    editor: blockNoteContext.editor ?? undefined,
    position: blockNoteContext.position,
    noteBlockId: blockNoteContext.noteBlockId,
    isEditorTextContext: blockNoteContext.isEditorTextContext,
    valueInlineId: blockNoteContext.valueInlineId,
    valueInlineInstanceId: blockNoteContext.valueInlineInstanceId,
    valueInlineEditable: blockNoteContext.valueInlineEditable,
    openValueInline: blockNoteContext.openValueInline,
  }
}

export function getNoteBlockShareTargetsFromFields(
  context: NoteWorkspaceMenuContextFields,
): NoteBlockShareTargets {
  if (!isCustomBlockNoteEditor(context.editor)) return { blocks: [], note: context.note }
  return {
    blocks: getBlockShareTargetBlocks(context.editor, context.noteBlockId),
    note: context.note,
  }
}

export function getNoteBlockShareTargetsFromMenuContext(
  context: WorkspaceMenuContext,
): NoteBlockShareTargets {
  const noteContext = getNoteWorkspaceMenuContext(context)
  if (!noteContext) return { blocks: [], note: undefined }
  return getNoteBlockShareTargetsFromFields(noteContext)
}

export function getNoteWorkspaceMenuContext(
  context: WorkspaceMenuContext,
): NoteWorkspaceMenuContextFields | null {
  const noteContext = context.domainContext
  if (!isRecord(noteContext)) return null
  const editor = noteContext.editor

  return {
    note: isNoteWithContent(noteContext.note) ? noteContext.note : undefined,
    editor,
    position: readPosition(noteContext.position),
    noteBlockId:
      typeof noteContext.noteBlockId === 'string'
        ? (noteContext.noteBlockId as NoteBlockId)
        : undefined,
    isEditorTextContext: noteContext.isEditorTextContext === true,
    valueInlineId:
      typeof noteContext.valueInlineId === 'string' ? noteContext.valueInlineId : undefined,
    valueInlineInstanceId:
      typeof noteContext.valueInlineInstanceId === 'string'
        ? noteContext.valueInlineInstanceId
        : undefined,
    valueInlineEditable: noteContext.valueInlineEditable === true,
    openValueInline:
      typeof noteContext.openValueInline === 'function'
        ? (noteContext.openValueInline as NoteWorkspaceMenuContextFields['openValueInline'])
        : undefined,
  }
}

function isCustomBlockNoteEditor(value: unknown): value is CustomBlockNoteEditor {
  return (
    isRecord(value) &&
    typeof value.getBlock === 'function' &&
    typeof value.getSelection === 'function'
  )
}

function isNoteWithContent(value: unknown): value is NoteItemWithContent {
  return isRecord(value) && typeof value.id === 'string'
}

function readPosition(value: unknown): { x: number; y: number } | undefined {
  if (!isRecord(value)) return undefined
  return typeof value.x === 'number' && typeof value.y === 'number'
    ? { x: value.x, y: value.y }
    : undefined
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}
