import type {
  CanvasEdge as Edge,
  CanvasNode as Node,
} from '~/features/canvas/types/canvas-domain-types'
import type * as Y from 'yjs'

export function transactCanvasMap<TValue>(map: Y.Map<TValue>, fn: () => void) {
  if (map.doc) {
    map.doc.transact(fn)
    return
  }

  fn()
}

export function transactCanvasMaps(nodesMap: Y.Map<Node>, edgesMap: Y.Map<Edge>, fn: () => void) {
  if (nodesMap.doc && edgesMap.doc && nodesMap.doc !== edgesMap.doc) {
    throw new Error('transactCanvasMaps requires nodesMap.doc and edgesMap.doc to match')
  }

  const doc = nodesMap.doc ?? edgesMap.doc
  if (doc) {
    doc.transact(fn)
    return
  }

  fn()
}
