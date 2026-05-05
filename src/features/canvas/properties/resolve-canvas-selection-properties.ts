import {
  getCanvasEdgeInspectableProperties,
  normalizeCanvasEdge,
  resolveCanvasEdgeType,
} from '../edges/canvas-edge-registry'
import {
  getCanvasNodeInspectableProperties,
  normalizeCanvasNode,
} from '../nodes/canvas-node-modules'
import { canvasToolSpecs } from '../tools/canvas-tool-modules'
import { withActiveRichTextColorBinding } from './canvas-rich-text-property-binding'
import { resolveCanvasProperties } from './resolve-canvas-properties'
import { EMPTY_CANVAS_INSPECTABLE_PROPERTIES } from './canvas-property-types'
import type { CanvasEdgePatch } from '../edges/canvas-edge-types'
import type { CanvasNodeDataPatch } from '../nodes/canvas-node-modules'
import type { CanvasRichTextFormattingSnapshot } from '../nodes/shared/canvas-rich-text-formatting-session'
import type { CanvasInspectableProperties, CanvasResolvedProperty } from './canvas-property-types'
import type { CanvasToolId, CanvasToolPropertyContext } from '../tools/canvas-tool-types'
import type { CanvasDocumentEdge, CanvasDocumentNode } from '../types/canvas-domain-types'

export function resolveCanvasSelectionProperties({
  activeFormattingSnapshot,
  activeTool,
  isNoteEmbed,
  patchEdge,
  patchNodeData,
  selectedEdges,
  selectedNodes,
  toolPropertyContext,
}: {
  activeFormattingSnapshot: CanvasRichTextFormattingSnapshot | null
  activeTool: CanvasToolId
  isNoteEmbed: (node: CanvasDocumentNode) => boolean
  patchEdge: (edgeId: string, patch: CanvasEdgePatch) => void
  patchNodeData: (nodeId: string, data: CanvasNodeDataPatch) => void
  selectedEdges: ReadonlyArray<CanvasDocumentEdge>
  selectedNodes: ReadonlyArray<CanvasDocumentNode>
  toolPropertyContext: CanvasToolPropertyContext
}): Array<CanvasResolvedProperty> {
  if (selectedNodes.length > 0 || selectedEdges.length > 0) {
    const selectedProperties = [
      ...selectedNodes.map<CanvasInspectableProperties>((node) =>
        getSelectedNodeInspectableProperties(
          node,
          patchNodeData,
          isNoteEmbed(node),
          activeFormattingSnapshot,
        ),
      ),
      ...selectedEdges.map<CanvasInspectableProperties>((edge) =>
        getCanvasEdgeInspectableProperties(normalizeCanvasEdge(edge), patchEdge),
      ),
    ]

    return resolveCanvasProperties(selectedProperties)
  }

  return resolveCanvasProperties([
    canvasToolSpecs[activeTool]?.properties?.(toolPropertyContext) ??
      EMPTY_CANVAS_INSPECTABLE_PROPERTIES,
  ])
}

export function getSharedSelectedEdgeType(edges: ReadonlyArray<CanvasDocumentEdge>) {
  const edgeTypes = edges.map((edge) => resolveCanvasEdgeType(edge.type))
  const firstEdgeType = edgeTypes[0] ?? null
  return firstEdgeType && edgeTypes.every((edgeType) => edgeType === firstEdgeType)
    ? firstEdgeType
    : null
}

function getSelectedNodeInspectableProperties(
  node: CanvasDocumentNode,
  patchNodeData: (nodeId: string, data: CanvasNodeDataPatch) => void,
  includeTextColor: boolean,
  activeFormattingSnapshot: CanvasRichTextFormattingSnapshot | null,
): CanvasInspectableProperties {
  const properties = getCanvasNodeInspectableProperties(normalizeCanvasNode(node), patchNodeData, {
    includeTextColor,
  })
  if (!activeFormattingSnapshot || activeFormattingSnapshot.nodeId !== node.id) {
    return properties
  }

  return withActiveRichTextColorBinding(properties, activeFormattingSnapshot)
}
