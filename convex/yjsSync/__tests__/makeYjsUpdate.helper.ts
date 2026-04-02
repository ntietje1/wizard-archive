import * as Y from 'yjs'

export function makeYjsUpdate(): ArrayBuffer {
  const doc = new Y.Doc()
  // Side-effect: ensures the 'document' fragment exists in the Y.Doc state before encoding
  doc.getXmlFragment('document')
  const update = Y.encodeStateAsUpdate(doc)
  const ab = update.buffer.slice(
    update.byteOffset,
    update.byteOffset + update.byteLength,
  )
  doc.destroy()
  return ab as ArrayBuffer
}
