import * as Y from 'yjs'

export const WIZARD_CANVAS_DOCUMENT_VERSION = 'wizardcanvas-v1' as const

const WIZARD_CANVAS_HEADER = new TextEncoder().encode(`${WIZARD_CANVAS_DOCUMENT_VERSION}\n`)

export function encodeWizardCanvasDocument(document: Y.Doc): Uint8Array {
  const update = Y.encodeStateAsUpdate(document)
  const bytes = new Uint8Array(WIZARD_CANVAS_HEADER.byteLength + update.byteLength)
  bytes.set(WIZARD_CANVAS_HEADER)
  bytes.set(update, WIZARD_CANVAS_HEADER.byteLength)
  return bytes
}

export function decodeWizardCanvasDocument(bytes: Uint8Array): Y.Doc | null {
  if (
    bytes.byteLength < WIZARD_CANVAS_HEADER.byteLength ||
    WIZARD_CANVAS_HEADER.some((value, index) => bytes[index] !== value)
  ) {
    return null
  }
  const document = new Y.Doc()
  try {
    Y.applyUpdate(document, bytes.subarray(WIZARD_CANVAS_HEADER.byteLength))
    return document
  } catch {
    document.destroy()
    return null
  }
}
