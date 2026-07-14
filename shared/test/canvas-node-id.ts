import type { CanvasNodeId } from '@wizard-archive/editor/resources/domain-id'
import { deterministicUuidV7 } from './deterministic-uuid-v7'

export function testCanvasNodeId(label: string): CanvasNodeId {
  return deterministicUuidV7(label) as CanvasNodeId
}
