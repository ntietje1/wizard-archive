import * as Y from 'yjs'
import { describe, expect, it } from 'vite-plus/test'
import {
  createImportedTextNotePayload,
  createImportedTextNoteUpdate,
  readNoteYDocContent,
  readNoteYDocMarkdown,
} from '../imported-text'
import type { ResourceImportFile } from '../../files/import-contract'

describe('createImportedTextNoteUpdate', () => {
  it('encodes imported text as a BlockNote Yjs document update', async () => {
    const update = await createImportedTextNoteUpdate(
      createTextImportFile({
        content: '# Session Notes\n\nThe bell rings twice.',
        contentType: 'text/markdown',
        name: 'session-notes.md',
      }),
    )
    const doc = new Y.Doc()

    try {
      Y.applyUpdate(doc, new Uint8Array(update))

      expect(readNoteYDocContent(doc)).toEqual([
        expect.objectContaining({
          type: 'heading',
          content: [expect.objectContaining({ text: 'Session Notes' })],
        }),
        expect.objectContaining({
          type: 'paragraph',
          content: [expect.objectContaining({ text: 'The bell rings twice.' })],
        }),
      ])
    } finally {
      doc.destroy()
    }
  })

  it('returns the Yjs update with the same derived blocks for atomic live imports', async () => {
    const payload = await createImportedTextNotePayload(
      createTextImportFile({
        content: '# Session Notes\n\nThe bell rings twice.',
        contentType: 'text/markdown',
        name: 'session-notes.md',
      }),
    )
    const doc = new Y.Doc()

    try {
      Y.applyUpdate(doc, new Uint8Array(payload.update))

      expect(payload.content).toEqual(readNoteYDocContent(doc))
    } finally {
      doc.destroy()
    }
  })

  it('serializes a Yjs note document through the package note model', async () => {
    const payload = await createImportedTextNotePayload(
      createTextImportFile({
        content: '# Session Notes\n\nThe bell rings twice.',
        contentType: 'text/markdown',
        name: 'session-notes.md',
      }),
    )
    const doc = new Y.Doc()

    try {
      Y.applyUpdate(doc, new Uint8Array(payload.update))

      expect(readNoteYDocMarkdown(doc)).toContain('# Session Notes')
      expect(readNoteYDocMarkdown(doc)).toContain('The bell rings twice.')
    } finally {
      doc.destroy()
    }
  })
})

function createTextImportFile({
  content,
  contentType,
  name,
}: {
  content: string
  contentType: string
  name: string
}): ResourceImportFile {
  const encoded = new TextEncoder().encode(content)
  return {
    name,
    contentType,
    size: encoded.byteLength,
    arrayBuffer: () => encoded.buffer,
    text: () => content,
  }
}
