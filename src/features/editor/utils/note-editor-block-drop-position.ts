import type { CustomBlockNoteEditor } from '~/features/editor/editor-specs'

type NoteDropInput = {
  clientX: number
  clientY: number
}

type NoteEditorReferenceBlock = NonNullable<ReturnType<CustomBlockNoteEditor['getBlock']>>

type NoteEditorBlockDropPlacement = {
  blockElement: HTMLElement | null
  placement: 'before' | 'after'
  referenceBlock: NoteEditorReferenceBlock
}

export function getNearestNoteEditorBlockDropPlacement(
  editor: CustomBlockNoteEditor,
  input: NoteDropInput,
): NoteEditorBlockDropPlacement | null {
  const blockElements = getEditorBlockElements(editor)
  let nearestPlacement: NoteEditorBlockDropPlacement | null = null
  let nearestDistance = Number.POSITIVE_INFINITY

  for (const blockElement of blockElements) {
    const blockId = blockElement.getAttribute('data-id')
    const referenceBlock = blockId ? editor.getBlock(blockId) : undefined
    if (!referenceBlock) continue

    const rect = blockElement.getBoundingClientRect()
    const candidates = [
      { placement: 'before' as const, distance: Math.abs(input.clientY - rect.top) },
      { placement: 'after' as const, distance: Math.abs(input.clientY - rect.bottom) },
    ]

    for (const candidate of candidates) {
      if (candidate.distance >= nearestDistance) continue
      nearestDistance = candidate.distance
      nearestPlacement = {
        blockElement,
        placement: candidate.placement,
        referenceBlock,
      }
    }
  }

  if (nearestPlacement) return nearestPlacement

  const fallbackBlock = editor.getTextCursorPosition().block ?? getLastResolvedEditorBlock(editor)
  return fallbackBlock
    ? {
        blockElement: null,
        placement: 'after',
        referenceBlock: fallbackBlock,
      }
    : null
}

function getLastResolvedEditorBlock(editor: CustomBlockNoteEditor) {
  const lastBlock = editor.document[editor.document.length - 1]
  return lastBlock ? editor.getBlock(lastBlock.id) : undefined
}

function getEditorBlockElements(editor: CustomBlockNoteEditor) {
  const editorDom = editor._tiptapEditor.view?.dom
  if (!editorDom) return []
  return Array.from(editorDom.querySelectorAll<HTMLElement>('[data-node-type="blockContainer"]'))
}
