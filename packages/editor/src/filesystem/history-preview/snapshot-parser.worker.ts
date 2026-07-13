import * as Y from 'yjs'
import { readCanvasDocumentContent } from '../../canvas/document-contract'
import { readNoteYDocContent } from '../../notes/imported-text'
import type {
  HistorySnapshotParserRequest,
  HistorySnapshotParserResult,
} from './snapshot-parser-contract'

self.onmessage = ({ data: request }: MessageEvent<HistorySnapshotParserRequest>) => {
  const doc = new Y.Doc()
  let result: HistorySnapshotParserResult
  try {
    Y.applyUpdate(doc, new Uint8Array(request.data))
    result =
      request.kind === 'note-yjs'
        ? { status: 'ready', kind: request.kind, value: readNoteYDocContent(doc) }
        : { status: 'ready', kind: request.kind, value: readCanvasDocumentContent(doc) }
  } catch {
    result = { status: 'corrupted' }
  } finally {
    doc.destroy()
  }
  self.postMessage(result)
}
