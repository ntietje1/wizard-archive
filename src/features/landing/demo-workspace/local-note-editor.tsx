import { BlockNoteEditor } from '@blocknote/core'
import { useEffect, useRef, useState } from 'react'
import { blocksToYDoc } from 'shared/editor-blocks/blocknote-yjs'
import { NoteView } from '~/features/editor/components/note-view'
import { createEditorSchema } from '~/features/editor/editor-specs'
import { useOwnedBlockNoteEditor } from '~/features/editor/hooks/useOwnedBlockNoteEditor'
import { createLinkResolver } from '~/features/editor/links/link-resolver'
import { destroyBlockNoteEditor } from '~/features/editor/utils/destroy-blocknote-editor'
import { createEmptyNoteValueRuntimeSource } from '~/features/editor/value-block/note-value-runtime-source'
import { noteBodyToBlocks } from './demo-workspace-model'
import { LocalYjsProvider } from './local-yjs-provider'
import type { CustomBlockNoteEditor } from '~/features/editor/editor-specs'
import type { Id } from 'convex/_generated/dataModel'

export function LocalNoteEditor({
  body,
  className,
  editable,
  fillHeight = false,
  noteId,
  onEditorChange,
}: {
  body: string
  className?: string
  editable: boolean
  fillHeight?: boolean
  noteId: Id<'sidebarItems'>
  onEditorChange?: (editor: CustomBlockNoteEditor | null) => void
}) {
  const [session] = useState(() => {
    const initialContent = noteBodyToBlocks(body)
    const doc = blocksToYDoc(initialContent, 'document')
    const provider = new LocalYjsProvider(doc)
    return { doc, provider }
  })
  const editorCreatedRef = useRef(false)
  const sessionDestroyedRef = useRef(false)
  const destroySession = () => {
    if (sessionDestroyedRef.current) return

    sessionDestroyedRef.current = true
    session.provider.destroy()
    session.doc.destroy()
  }
  const editor = useOwnedBlockNoteEditor({
    identity: session.provider,
    createEditor: () => {
      const nextEditor = BlockNoteEditor.create({
        schema: createEditorSchema(),
        collaboration: {
          provider: session.provider,
          fragment: session.doc.getXmlFragment('document'),
          user: { name: 'Demo', color: '#61afef' },
          showCursorLabels: 'activity',
        },
      }) as unknown as CustomBlockNoteEditor
      editorCreatedRef.current = true
      return nextEditor
    },
    destroyEditor: (blockNoteEditor) => {
      destroyBlockNoteEditor(blockNoteEditor)
      destroySession()
    },
    onEditorChange,
  })
  const linkResolver = createLinkResolver({
    allItems: [],
    isViewerMode: !editable,
    itemsMap: new Map(),
  })
  const valueRuntimeSource = createEmptyNoteValueRuntimeSource(noteId)

  useEffect(
    () => () => {
      if (editorCreatedRef.current || sessionDestroyedRef.current) return

      sessionDestroyedRef.current = true
      session.provider.destroy()
      session.doc.destroy()
    },
    [session],
  )

  if (!editor) {
    return null
  }

  return (
    <div className={editable || fillHeight ? 'note-editor-fill-height' : undefined}>
      <div className={className}>
        <NoteView
          editor={editor}
          noteId={noteId}
          editable={editable}
          linkResolver={linkResolver}
          valueRuntimeSource={valueRuntimeSource}
        />
      </div>
    </div>
  )
}
