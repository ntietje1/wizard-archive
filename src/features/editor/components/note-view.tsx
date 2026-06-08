import { BlockNoteView } from '@blocknote/shadcn'
import { SideMenuController } from '@blocknote/react'
import { useEffect, useRef } from 'react'
import { PreventExternalDrop } from './extensions/prevent-external-drop/prevent-external-drop'
import { SideMenuRenderer } from './extensions/side-menu/side-menu'
import { SlashMenu } from './extensions/slash-menu/slash-menu'
import { NoteValueRuntimeProvider } from '../value-block/value-block-runtime'
import { NoteEmbedSurfaceProvider } from './extensions/embed-block/note-embed-surface-context'
import type { CustomBlockNoteEditor } from '~/features/editor/editor-specs'
import type { Id } from 'convex/_generated/dataModel'
import type { NoteWithContent } from 'shared/notes/types'
import type { CSSProperties, ReactNode, RefObject } from 'react'
import './extensions/wiki-link/wiki-link.css'
import './extensions/md-link/md-link.css'
import './note-editor-file-drop-cursor.css'
import type { LinkResolver } from '~/features/editor/hooks/useLinkResolver'
import { useDisableAutolink } from '~/features/editor/hooks/useDisableAutolink'
import { useLinkDecorations } from '~/features/editor/hooks/useLinkDecorations'
import { useNoteEditorFileDropCursor } from '~/features/editor/hooks/useNoteEditorFileDropCursor'
import { useResolvedTheme } from '~/shared/theme/context'
import {
  patchYSyncAfterTypeChanged,
  patchYUndoPluginDestroy,
  runYjsHistoryCommand,
} from '~/features/editor/utils/patch-yundo-destroy'

export function NoteView({
  editor,
  note,
  noteId,
  editable,
  evaluateValuesFromEditor = editable,
  linkResolver,
  style,
  children,
}: {
  editor: CustomBlockNoteEditor
  note?: NoteWithContent
  noteId?: Id<'sidebarItems'>
  editable: boolean
  evaluateValuesFromEditor?: boolean
  linkResolver: LinkResolver
  style?: CSSProperties
  children?: ReactNode
}) {
  const resolvedTheme = useResolvedTheme()
  const noteSurfaceRef = useRef<HTMLDivElement | null>(null)
  const isViewerMode = !editable || linkResolver.isViewerMode
  const sourceNoteId = note?._id ?? noteId ?? null

  useLinkDecorations(editor, linkResolver, isViewerMode)
  useDisableAutolink(editor)
  useYjsUndoPatches(editor, editable)
  useNoteYjsUndoShortcutPatch(editor, noteSurfaceRef, !isViewerMode)
  useNoteEditorFileDropCursor(editor, !isViewerMode)

  return (
    <div ref={noteSurfaceRef} className="contents">
      <NoteValueRuntimeProvider
        editor={editor}
        noteId={sourceNoteId ?? undefined}
        editable={editable}
        evaluateValuesFromEditor={evaluateValuesFromEditor}
      >
        <NoteEmbedSurfaceProvider sourceNoteId={sourceNoteId} editable={editable}>
          <BlockNoteView
            editor={editor}
            style={style}
            theme={resolvedTheme}
            editable={editable}
            sideMenu={false}
            formattingToolbar={false}
            slashMenu={false}
            linkToolbar={false}
          >
            {editable ? (
              <>
                <PreventExternalDrop />
                {note ? (
                  <SideMenuController
                    sideMenu={(props) => <SideMenuRenderer {...props} note={note} />}
                  />
                ) : null}
                <SlashMenu editor={editor} />
              </>
            ) : null}
            {children}
          </BlockNoteView>
        </NoteEmbedSurfaceProvider>
      </NoteValueRuntimeProvider>
    </div>
  )
}

function useYjsUndoPatches(editor: CustomBlockNoteEditor, editable: boolean) {
  useEffect(() => {
    if (!editable) return
    const view = editor._tiptapEditor.view
    patchYUndoPluginDestroy(view)
    patchYSyncAfterTypeChanged(view)
  }, [editable, editor])
}

function useNoteYjsUndoShortcutPatch(
  editor: CustomBlockNoteEditor,
  noteSurfaceRef: RefObject<HTMLDivElement | null>,
  editable: boolean,
) {
  useEffect(() => {
    const surface = noteSurfaceRef.current
    if (!editable || !surface) return

    const handleKeyDown = (event: globalThis.KeyboardEvent) => {
      if (
        !isHistoryShortcut(event) ||
        !editor._tiptapEditor.view.hasFocus() ||
        !isEventInsideNoteSurface(event, surface)
      ) {
        return
      }
      event.preventDefault()
      event.stopPropagation()
      runYjsHistoryCommand(editor._tiptapEditor.view, getHistoryDirection(event))
    }

    surface.addEventListener('keydown', handleKeyDown)
    return () => surface.removeEventListener('keydown', handleKeyDown)
  }, [editable, editor, noteSurfaceRef])
}

function isHistoryShortcut(event: globalThis.KeyboardEvent) {
  if (event.altKey || (!event.ctrlKey && !event.metaKey)) return false

  const key = event.key.toLowerCase()
  return key === 'z' || (event.ctrlKey && !event.metaKey && key === 'y')
}

function getHistoryDirection(event: globalThis.KeyboardEvent): 'undo' | 'redo' {
  const key = event.key.toLowerCase()
  if (key === 'y' || (key === 'z' && event.shiftKey)) return 'redo'
  return 'undo'
}

function isEventInsideNoteSurface(event: globalThis.KeyboardEvent, surface: HTMLElement) {
  const target = event.target
  return target instanceof Node && surface.contains(target)
}
