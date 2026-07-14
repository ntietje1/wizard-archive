import { BlockNoteEditor } from '@blocknote/core'
import type { Doc } from 'yjs'
import type { YjsCollaborationProvider, YjsProviderUser } from '../../collaboration/yjs-provider'
import { generateDomainId } from '../../resources/domain-id'
import { createEditorSchema } from '../editor-specs'
import type { CustomBlockNoteEditor } from '../editor-schema'
import { NOTE_YJS_FRAGMENT } from './headless-yjs'

const BLOCKNOTE_INITIAL_BLOCK_ID = 'initialBlockId'

export function createCollaborativeNoteEditor({
  doc,
  provider,
  user,
}: {
  doc: Doc
  provider: YjsCollaborationProvider
  user: YjsProviderUser
}): CustomBlockNoteEditor {
  const isEmptyDocument = doc.getXmlFragment(NOTE_YJS_FRAGMENT).length === 0
  const editor = BlockNoteEditor.create({
    schema: createEditorSchema(),
    disableExtensions: ['link', 'dropFile'],
    collaboration: {
      provider,
      fragment: doc.getXmlFragment(NOTE_YJS_FRAGMENT),
      user,
      showCursorLabels: 'activity',
    },
  }) as unknown as CustomBlockNoteEditor

  if (isEmptyDocument) initializeCollaborativeDocument(editor)
  return editor
}

function initializeCollaborativeDocument(editor: CustomBlockNoteEditor) {
  const { state, view } = editor._tiptapEditor
  const transaction = state.tr
  let initialized = false

  state.doc.descendants((node, position) => {
    if (node.attrs.id !== BLOCKNOTE_INITIAL_BLOCK_ID) return
    transaction.setNodeMarkup(position, undefined, {
      ...node.attrs,
      id: generateDomainId('noteBlock'),
    })
    initialized = true
  })

  if (!initialized) throw new Error('Empty collaborative note did not contain an initial block')
  view.dispatch(transaction)
}
