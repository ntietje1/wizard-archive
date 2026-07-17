import { DOMAIN_ID_KIND, generateDomainId } from '../../../resources/domain-id'
import { copyNoteValueProps, createCopiedNoteValueIdMap } from '../../values/value-copy'
import type { NoteBlockNoteEditor } from '../../note-editor-schema'

type NoteEditorBlock = NoteBlockNoteEditor['document'][number]
type PartialNoteEditorBlock = Parameters<NoteBlockNoteEditor['insertBlocks']>[0][number]

export function duplicateNoteBlock(editor: NoteBlockNoteEditor, block: NoteEditorBlock) {
  const [duplicatedBlock] = editor.insertBlocks([copyNoteBlock(block)], block, 'after')
  if (duplicatedBlock) editor.setTextCursorPosition(duplicatedBlock, 'end')
}

function copyNoteBlock(block: NoteEditorBlock): PartialNoteEditorBlock {
  const copiedIdByOriginalId = createCopiedNoteValueIdMap(collectNoteValueIds(block))
  return copyBlock(block, copiedIdByOriginalId)
}

function copyBlock(
  block: NoteEditorBlock,
  copiedIdByOriginalId: ReadonlyMap<string, string>,
): PartialNoteEditorBlock {
  return {
    ...block,
    id: generateDomainId(DOMAIN_ID_KIND.noteBlock),
    content: copyBlockContent(block.content, copiedIdByOriginalId),
    children: block.children?.map((child) => copyBlock(child, copiedIdByOriginalId)),
  } as PartialNoteEditorBlock
}

function copyBlockContent(
  content: NoteEditorBlock['content'],
  copiedIdByOriginalId: ReadonlyMap<string, string>,
): PartialNoteEditorBlock['content'] {
  const copiedContent = structuredClone(content) as unknown
  rewriteCopiedNoteValues(copiedContent, copiedIdByOriginalId)
  return copiedContent as PartialNoteEditorBlock['content']
}

function collectNoteValueIds(block: NoteEditorBlock) {
  const valueIds: Array<string> = []
  collectValueIds(block.content, valueIds)
  for (const child of block.children ?? []) collectBlockValueIds(child, valueIds)
  return valueIds
}

function collectBlockValueIds(block: NoteEditorBlock, valueIds: Array<string>) {
  collectValueIds(block.content, valueIds)
  for (const child of block.children ?? []) collectBlockValueIds(child, valueIds)
}

function collectValueIds(value: unknown, valueIds: Array<string>) {
  if (Array.isArray(value)) {
    for (const item of value) collectValueIds(item, valueIds)
    return
  }
  if (!isRecord(value)) return
  if (value.type === 'value' && isRecord(value.props) && typeof value.props.valueId === 'string') {
    valueIds.push(value.props.valueId)
    return
  }
  for (const child of Object.values(value)) collectValueIds(child, valueIds)
}

function rewriteCopiedNoteValues(
  value: unknown,
  copiedIdByOriginalId: ReadonlyMap<string, string>,
) {
  if (Array.isArray(value)) {
    for (const item of value) rewriteCopiedNoteValues(item, copiedIdByOriginalId)
    return
  }
  if (!isRecord(value)) return
  if (
    value.type === 'value' &&
    isRecord(value.props) &&
    typeof value.props.valueId === 'string' &&
    typeof value.props.label === 'string' &&
    typeof value.props.expressionSource === 'string'
  ) {
    value.props = copyNoteValueProps(
      {
        valueId: value.props.valueId,
        label: value.props.label,
        expressionSource: value.props.expressionSource,
      },
      copiedIdByOriginalId,
    )
    return
  }
  for (const child of Object.values(value)) rewriteCopiedNoteValues(child, copiedIdByOriginalId)
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}
