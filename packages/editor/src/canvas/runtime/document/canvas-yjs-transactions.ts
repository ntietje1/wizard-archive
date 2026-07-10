import type * as Y from 'yjs'
import type { CanvasDocumentEdge, CanvasDocumentNode } from '../../document-contract'

export function assertCanvasMapsShareDocument(
  nodesMap: Y.Map<CanvasDocumentNode>,
  edgesMap: Y.Map<CanvasDocumentEdge>,
  operation: string,
) {
  if (nodesMap.doc !== edgesMap.doc) {
    throw new Error(`${operation} requires nodesMap.doc and edgesMap.doc to match`)
  }
}

export function transactCanvasMap<TValue>(map: Y.Map<TValue>, fn: () => void) {
  transactCanvasDoc(map.doc, fn)
}

export function transactCanvasMaps(
  nodesMap: Y.Map<CanvasDocumentNode>,
  edgesMap: Y.Map<CanvasDocumentEdge>,
  fn: () => void,
) {
  assertCanvasMapsShareDocument(nodesMap, edgesMap, 'transactCanvasMaps')

  transactCanvasDoc(nodesMap.doc, fn)
}

function transactCanvasDoc(doc: Y.Doc | null, fn: () => void) {
  if (doc) doc.transact(fn)
  else fn()
}
