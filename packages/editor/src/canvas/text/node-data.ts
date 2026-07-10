import { readCanvasTextContentState } from './editor'
import type { CanvasTextContentState } from './editor'
import { normalizeCanvasNodeSurfaceStyleData } from '../node-surface-style'
import type { CanvasTextNodeData } from '../document-contract'
import type {
  CanvasNodeSurfaceStyleData,
  CanvasNormalizedNodeSurfaceStyleData,
} from '../node-surface-style'

export interface CanvasTextNodeInputData extends CanvasNodeSurfaceStyleData {
  content?: unknown
}

export interface CanvasTextNodeRenderData extends CanvasNormalizedNodeSurfaceStyleData {
  text: CanvasTextContentState
}

function readCanvasTextState(
  data: CanvasTextNodeInputData | CanvasTextNodeRenderData | CanvasTextNodeData,
): CanvasTextContentState | null {
  if (!('text' in data)) {
    return null
  }

  const text = (data as { text?: unknown }).text
  if (!text || typeof text !== 'object') {
    return null
  }

  const { content, kind } = text as { content?: unknown; kind?: unknown }
  if (kind !== 'valid' && kind !== 'invalid') {
    return null
  }

  const contentState = readCanvasTextContentState(content)
  return kind === 'valid' && contentState.kind === 'invalid'
    ? contentState
    : { kind, content: contentState.content }
}

export function normalizeCanvasTextNodeRenderData(
  data: CanvasTextNodeInputData | CanvasTextNodeRenderData | CanvasTextNodeData,
): CanvasTextNodeRenderData {
  const surfaceStyle = normalizeCanvasNodeSurfaceStyleData(data)
  const content = 'content' in data ? data.content : undefined
  const text = readCanvasTextState(data) ?? readCanvasTextContentState(content)

  return {
    ...surfaceStyle,
    text,
  }
}
