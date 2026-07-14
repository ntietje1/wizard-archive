import { isUuidV7 } from '../../resources/domain-id'
import type { ResourceId } from '../../resources/domain-id'
import * as Y from 'yjs'
import React from 'react'
import { describe, expect, it } from 'vite-plus/test'
import { render } from '@testing-library/react'
import { BlockNoteView } from '@blocknote/shadcn'
import { YjsProvider } from '../../collaboration/yjs-provider-runtime'
import { NoteValueRuntimeContext } from '../value-block/value-block-runtime-context'
import type { NoteValueRuntimeContextValue } from '../value-block/value-block-runtime-context'
import { NOTE_YJS_FRAGMENT, noteYDocToBlocks } from '../document/headless-yjs'
import { createNoteYDocFromContent, readNoteYDocContent } from '../imported-text'
import type { PartialNoteBlock } from '../document/model'
import type { CustomBlockNoteEditor } from '../editor-schema'
import { createCollaborativeNoteEditor } from '../document/collaborative-editor'

import { testNoteBlockId } from '../../test/blocknote-id'

const TestBlockNoteView = BlockNoteView as React.ComponentType<{
  editor: CustomBlockNoteEditor
  editable: boolean
}>

function createProvider(doc: Y.Doc) {
  const provider = new YjsProvider(doc, 'test-note' as ResourceId, {
    pushUpdate: () => Promise.resolve({ status: 'accepted', seq: 0 }),
    pushAwareness: () => Promise.resolve({ status: 'active', expiresAt: Date.now() + 30_000 }),
    removeAwareness: () => Promise.resolve({ status: 'released' }),
    reportError: () => {},
    requestReset: () => {},
  })
  provider.setWritable(true)
  return provider
}

function createInitialDoc(blocks: Array<PartialNoteBlock>) {
  const sourceDoc = createNoteYDocFromContent(blocks)
  const doc = new Y.Doc()
  Y.applyUpdate(doc, Y.encodeStateAsUpdate(sourceDoc))
  sourceDoc.destroy()
  return doc
}

const runtimeContextValue: NoteValueRuntimeContextValue = {
  noteId: 'test-note' as ResourceId,
  editable: true,
  authoredDefinitions: [],
  authoredValueStates: [],
  externalDependencyStates: [],
  externalDependencyStatesStatus: 'success',
  referenceableStates: [],
  referenceableStatesStatus: 'success',
  stateByValueId: new Map(),
  references: {
    getNoteCandidates: () => [],
    resolveNoteIdByPath: () => null,
  },
}

describe('inline value collaboration round-trip', () => {
  it('projects a fresh collaborative editor document with canonical block identity', () => {
    const doc = new Y.Doc()
    const provider = createProvider(doc)
    const editor = createCollaborativeNoteEditor({
      doc,
      provider,
      user: { name: 'Tester', color: '#000000' },
    })
    const view = render(
      React.createElement(
        NoteValueRuntimeContext.Provider,
        { value: runtimeContextValue },
        React.createElement(TestBlockNoteView, { editor, editable: true }),
      ),
    )

    try {
      editor.insertInlineContent('Hello')
      const blocks = noteYDocToBlocks(doc, NOTE_YJS_FRAGMENT)
      expect(blocks).not.toHaveLength(0)
      expect(blocks.every((block) => isUuidV7(block.id))).toBe(true)
    } finally {
      view.unmount()
      provider.destroy()
      editor._tiptapEditor.destroy()
      doc.destroy()
    }
  })

  it('converts valid blocks to a Yjs document', () => {
    const doc = createNoteYDocFromContent([
      {
        id: testNoteBlockId('paragraph-block-1'),
        type: 'paragraph',
        content: [{ type: 'text', text: 'Hello', styles: {} }],
      },
    ])

    try {
      expect(doc).toBeInstanceOf(Y.Doc)
    } finally {
      doc.destroy()
    }
  })

  it('mounts an editor containing an inline value with a stable ProseMirror plugin set', () => {
    const doc = createInitialDoc([
      {
        id: testNoteBlockId('paragraph-block-1'),
        type: 'paragraph',
        content: [
          { type: 'text', text: 'Bonus ', styles: {} },
          {
            type: 'value',
            props: {
              valueId: 'value-1',
              slug: 'prof_bonus',
              expressionSource: '3',
            },
          },
        ] as never,
      },
    ])
    const provider = createProvider(doc)
    const editor = createCollaborativeNoteEditor({
      doc,
      provider,
      user: { name: 'Tester', color: '#000000' },
    })
    let view: ReturnType<typeof render> | null = null

    try {
      view = render(
        React.createElement(
          NoteValueRuntimeContext.Provider,
          { value: runtimeContextValue },
          React.createElement(TestBlockNoteView, { editor, editable: true }),
        ),
      )

      expect(readNoteYDocContent(doc)[0]).toMatchObject({
        type: 'paragraph',
        content: expect.arrayContaining([
          expect.objectContaining({
            type: 'value',
            props: expect.objectContaining({ slug: 'prof_bonus' }),
          }),
        ]),
      })
    } finally {
      view?.unmount()
      provider.destroy()
      editor._tiptapEditor.destroy()
      doc.destroy()
    }
  })
})
