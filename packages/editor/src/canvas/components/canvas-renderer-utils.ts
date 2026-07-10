import type { CanvasInternalNode } from '../system/canvas-engine-types'

type PrimitiveArrayValue = string | number | boolean | bigint | symbol | null | undefined

type CanvasNodeRenderSize = {
  width: number | undefined
  height: number | undefined
}

export function areArraysEqual<T extends PrimitiveArrayValue>(
  left: ReadonlyArray<T>,
  right: ReadonlyArray<T>,
): boolean {
  if (left === right) {
    return true
  }
  if (left.length !== right.length) {
    return false
  }
  return left.every((value, index) => value === right[index])
}

export function resolveCanvasNodeRenderSize(
  internalNode: CanvasInternalNode,
): CanvasNodeRenderSize {
  return {
    width: internalNode.node.width ?? internalNode.measured.width,
    height: internalNode.node.height ?? internalNode.measured.height,
  }
}

export function areNullableCanvasSnapshotsEqual<T>(
  left: T | null,
  right: T | null,
  areEqual: (left: T, right: T) => boolean,
): boolean {
  if (left === right) {
    return true
  }
  if (!left || !right) {
    return false
  }
  return areEqual(left, right)
}
