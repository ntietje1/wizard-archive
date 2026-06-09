import { SideMenuController } from '@blocknote/react'
import { SideMenuRenderer } from './extensions/side-menu/side-menu'
import { NoteEditorCore } from './note-editor-core'
import { NoteValueRuntimeProvider } from '../value-block/value-block-runtime'
import type { CustomBlockNoteEditor } from '~/features/editor/editor-specs'
import type { Id } from 'convex/_generated/dataModel'
import type { NoteWithContent } from 'shared/notes/types'
import type { CSSProperties, ReactNode } from 'react'
import type { LinkResolver } from '~/features/editor/links/link-resolver'
import type { NoteValueRuntimeSource } from '~/features/editor/value-block/note-value-runtime-source'

export function NoteView({
  editor,
  note,
  noteId,
  editable,
  evaluateValuesFromEditor = editable,
  linkResolver,
  valueRuntimeSource,
  style,
  children,
}: {
  editor: CustomBlockNoteEditor
  note?: NoteWithContent
  noteId?: Id<'sidebarItems'>
  editable: boolean
  evaluateValuesFromEditor?: boolean
  linkResolver: LinkResolver
  valueRuntimeSource: NoteValueRuntimeSource
  style?: CSSProperties
  children?: ReactNode
}) {
  const isViewerMode = !editable || linkResolver.isViewerMode
  const sourceNoteId = note?._id ?? noteId ?? null

  return (
    <NoteValueRuntimeProvider
      editor={editor}
      source={valueRuntimeSource}
      editable={editable}
      evaluateValuesFromEditor={evaluateValuesFromEditor}
    >
      <NoteEditorCore
        editor={editor}
        editable={editable}
        editableChrome={
          note ? (
            <SideMenuController sideMenu={(props) => <SideMenuRenderer {...props} note={note} />} />
          ) : null
        }
        enableYjsHistory={!isViewerMode}
        linkResolver={linkResolver}
        sourceNoteId={sourceNoteId}
        style={style}
      >
        {children}
      </NoteEditorCore>
    </NoteValueRuntimeProvider>
  )
}
