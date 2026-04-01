import * as Y from 'yjs'

export function makeYjsUpdate(): ArrayBuffer {
  const doc = new Y.Doc()
  doc.getXmlFragment('document')
  const update = Y.encodeStateAsUpdate(doc)
  const ab = update.buffer.slice(
    update.byteOffset,
    update.byteOffset + update.byteLength,
  ) as ArrayBuffer
  doc.destroy()
  return ab
}
