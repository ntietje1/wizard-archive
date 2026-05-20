import * as Y from 'yjs'
import React from 'react'
import { describe, expect, it } from 'vitest'
import { BlockNoteEditor } from '@blocknote/core'
import { render } from '@testing-library/react'
import { BlockNoteView } from '@blocknote/shadcn'
import { createEditorSchema } from '../../editorSchema'
import { ConvexYjsProvider } from '../../providers/convex-yjs-provider'
import { NoteValueRuntimeContext } from '../value-block-runtime-context'
import { blocksToYDoc as backendBlocksToYDoc, yDocToBlocks } from 'convex/notes/blocknote'
import type { CustomBlockNoteEditor, CustomPartialBlock } from 'convex/notes/editorSpecs'
import type { Id } from 'convex/_generated/dataModel'

const TestBlockNoteView = BlockNoteView as React.ComponentType<{
  editor: CustomBlockNoteEditor
  editable: boolean
}>

function createProvider(doc: Y.Doc) {
  const provider = new ConvexYjsProvider(doc, 'test-note' as Id<'sidebarItems'>, {
    pushUpdate: () => Promise.resolve({ seq: 0 }),
    pushAwareness: () => Promise.resolve(null),
    removeAwareness: () => Promise.resolve(null),
  })
  provider.writable = true
  return provider
}

function createInitialDoc(blocks: Array<CustomPartialBlock>) {
  const sourceDoc = backendBlocksToYDoc(blocks, 'document')
  const doc = new Y.Doc()
  Y.applyUpdate(doc, Y.encodeStateAsUpdate(sourceDoc))
  sourceDoc.destroy()
  return doc
}

const runtimeContextValue = {
  noteId: 'test-note' as Id<'sidebarItems'>,
  editable: true,
  authoredDefinitions: [],
  stateByValueId: new Map(),
  sidebarItems: [],
  itemsMap: new Map(),
}

describe('inline value collaboration round-trip', () => {
  it('mounts an editor containing an inline value without duplicating ProseMirror plugins', () => {
    const doc = createInitialDoc([
      {
        id: 'paragraph-block-1',
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
    const editor = BlockNoteEditor.create({
      schema: createEditorSchema(),
      collaboration: {
        provider,
        fragment: doc.getXmlFragment('document'),
        user: { name: 'Tester', color: '#000000' },
        showCursorLabels: 'activity',
      },
    }) as unknown as CustomBlockNoteEditor

    try {
      const view = render(
        React.createElement(
          NoteValueRuntimeContext.Provider,
          { value: runtimeContextValue },
          React.createElement(TestBlockNoteView, { editor, editable: true }),
        ),
      )

      expect(yDocToBlocks(doc, 'document')[0]).toMatchObject({
        type: 'paragraph',
        content: expect.arrayContaining([
          expect.objectContaining({
            type: 'value',
            props: expect.objectContaining({ slug: 'prof_bonus' }),
          }),
        ]),
      })
      view.unmount()
    } finally {
      provider.destroy()
      editor._tiptapEditor.destroy()
      doc.destroy()
    }
  })
})
