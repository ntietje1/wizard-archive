import { drawToolModule } from './draw-tool-module'
import { eraseToolModule } from './erase-tool-module'
import { handToolModule } from './hand-tool-module'
import { lassoToolModule } from './lasso-tool-module'
import { rectangleToolModule } from './rectangle-tool-module'
import { selectToolModule } from './select-tool-module'
import { stickyToolModule } from './sticky-tool-module'
import { textToolModule } from './text-tool-module'
import { canEditCanvasNodeStyle } from '../components/nodes/canvas-node-registry'
import type { AnyCanvasToolModule, CanvasToolId } from './canvas-tool-types'
import type { Node } from '@xyflow/react'

export const canvasToolModules = [
  selectToolModule,
  handToolModule,
  lassoToolModule,
  drawToolModule,
  eraseToolModule,
  textToolModule,
  stickyToolModule,
  rectangleToolModule,
] as const satisfies ReadonlyArray<AnyCanvasToolModule>

const canvasToolModuleMap: Partial<Record<CanvasToolId, AnyCanvasToolModule>> = Object.fromEntries(
  canvasToolModules.map((module) => [module.id, module] as const),
)

export function getCanvasToolModule(toolId: CanvasToolId): AnyCanvasToolModule | undefined {
  return canvasToolModuleMap[toolId]
}

type CanvasConditionalToolbarState =
  | { kind: 'hidden' }
  | { kind: 'tool'; tool: AnyCanvasToolModule }
  | { kind: 'selection'; node: Node }

export function getCanvasConditionalToolbarState(
  toolId: CanvasToolId,
  selectedNodes: Array<Node>,
): CanvasConditionalToolbarState {
  if (selectedNodes.length === 1) {
    const [node] = selectedNodes
    if (canEditCanvasNodeStyle(node.type)) {
      return { kind: 'selection', node }
    }

    return { kind: 'hidden' }
  }

  if (selectedNodes.length > 1) {
    return { kind: 'hidden' }
  }

  const tool = getCanvasToolModule(toolId)
  if (tool?.showsStyleControls) {
    return { kind: 'tool', tool }
  }

  return { kind: 'hidden' }
}
