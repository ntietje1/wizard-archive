import { getNearestBlockPos } from '@blocknote/core'
import type { RichTextBlockMenuBlock, RichTextBlockMenuEditor } from './block-menu'

export function resolveRichTextContextBlock(
  editor: RichTextBlockMenuEditor,
  {
    position,
    target,
  }: {
    position: Readonly<{ x: number; y: number }>
    target: Element
  },
): RichTextBlockMenuBlock | null {
  const blockElement = target.closest('[data-node-type="blockContainer"]')
  const blockId =
    getBlockIdAtPoint(editor, position) ??
    getBlockIdAtElement(editor, blockElement) ??
    blockElement?.getAttribute('data-id')
  if (!blockId) return null

  try {
    return (editor.getBlock(blockId) as RichTextBlockMenuBlock | undefined) ?? null
  } catch {
    return null
  }
}

function getBlockIdAtElement(
  editor: RichTextBlockMenuEditor,
  blockElement: Element | null,
): string | null {
  if (!blockElement) return null
  try {
    const view = editor.prosemirrorView
    return getBlockIdAtDocumentPosition(editor, view.posAtDOM(blockElement, 0))
  } catch {
    return null
  }
}

function getBlockIdAtPoint(
  editor: RichTextBlockMenuEditor,
  position: Readonly<{ x: number; y: number }>,
): string | null {
  try {
    const view = editor.prosemirrorView
    const documentPosition = view.posAtCoords({ left: position.x, top: position.y })?.pos
    if (documentPosition === undefined) return null
    return getBlockIdAtDocumentPosition(editor, documentPosition)
  } catch {
    return null
  }
}

function getBlockIdAtDocumentPosition(
  editor: RichTextBlockMenuEditor,
  documentPosition: number,
): string | null {
  const blockId = getNearestBlockPos(editor.prosemirrorView.state.doc, documentPosition).node.attrs
    .id
  return typeof blockId === 'string' ? blockId : null
}
