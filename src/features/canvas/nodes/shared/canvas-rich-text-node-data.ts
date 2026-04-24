import { readCanvasRichTextContentState } from './canvas-rich-text-editor'
import type { ParsedCanvasTextNodeData } from 'convex/canvases/validation'
import type { CanvasRichTextContentState } from './canvas-rich-text-editor'
import { normalizeCanvasNodeSurfaceStyleData } from './canvas-node-surface-style'
import type {
  CanvasNodeSurfaceStyleData,
  CanvasNormalizedNodeSurfaceStyleData,
} from './canvas-node-surface-style'

export interface CanvasRichTextNodeInputData
  extends Record<string, unknown>, CanvasNodeSurfaceStyleData {
  content?: unknown
}

export interface CanvasRichTextNodeData
  extends Record<string, unknown>, CanvasNormalizedNodeSurfaceStyleData {
  richText: CanvasRichTextContentState
}

function isCanvasRichTextNodeData(
  data: CanvasRichTextNodeInputData | CanvasRichTextNodeData | ParsedCanvasTextNodeData,
): data is CanvasRichTextNodeData {
  if (!('richText' in data)) {
    return false
  }

  const richText = (data as { richText?: { kind?: unknown } }).richText
  return richText?.kind === 'valid' || richText?.kind === 'invalid'
}

export function normalizeCanvasRichTextNodeData(
  data: CanvasRichTextNodeInputData | CanvasRichTextNodeData | ParsedCanvasTextNodeData,
): CanvasRichTextNodeData {
  const surfaceStyle = normalizeCanvasNodeSurfaceStyleData(data)
  const richText = isCanvasRichTextNodeData(data)
    ? data.richText
    : readCanvasRichTextContentState(data.content)

  return {
    ...surfaceStyle,
    richText,
  }
}
