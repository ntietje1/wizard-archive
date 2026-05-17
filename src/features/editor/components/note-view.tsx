import { BlockNoteView } from '@blocknote/shadcn'
import { SideMenuController } from '@blocknote/react'
import { useEffect, useRef } from 'react'
import { PreventExternalDrop } from './extensions/prevent-external-drop/prevent-external-drop'
import { SideMenuRenderer } from './extensions/side-menu/side-menu'
import { SlashMenu } from './extensions/slash-menu/slash-menu'
import type { CustomBlockNoteEditor } from 'convex/notes/editorSpecs'
import type { NoteWithContent } from 'convex/notes/types'
import type { CSSProperties, ReactNode } from 'react'
import './extensions/wiki-link/wiki-link.css'
import './extensions/md-link/md-link.css'
import { useWikiLinkExtension } from '~/features/editor/hooks/useWikiLinkExtension'
import { useMdLinkExtension } from '~/features/editor/hooks/useMdLinkExtension'
import { useDisableAutolink } from '~/features/editor/hooks/useDisableAutolink'
import { useResolvedTheme } from '~/features/settings/hooks/useTheme'
import {
  patchYSyncAfterTypeChanged,
  patchYUndoPluginDestroy,
  runYjsHistoryCommand,
} from '~/features/editor/utils/patch-yundo-destroy'
import type { LinkResolver } from '~/features/editor/hooks/useLinkResolver'

interface NoteViewProps {
  editor: CustomBlockNoteEditor
  note?: NoteWithContent | undefined
  editable: boolean
  linkResolver: LinkResolver
  className?: string
  style?: CSSProperties
  children?: ReactNode
}

export function NoteView({
  editor,
  note,
  editable,
  linkResolver,
  className,
  style,
  children,
}: NoteViewProps) {
  const resolvedTheme = useResolvedTheme()
  const isViewerMode = !editable || linkResolver.isViewerMode
  useWikiLinkExtension(editor, linkResolver, isViewerMode)
  useMdLinkExtension(editor, linkResolver, isViewerMode)
  useDisableAutolink(editor)
  useYjsUndoPatches(editor)
  const noteSurfaceRef = useNoteYjsUndoShortcutPatch(editor, !isViewerMode)

  return (
    <div ref={noteSurfaceRef} className="contents">
      <BlockNoteView
        className={className}
        editor={editor}
        style={style}
        theme={resolvedTheme}
        editable={editable}
        sideMenu={false}
        formattingToolbar={false}
        slashMenu={false}
        linkToolbar={false}
      >
        {editable && (
          <>
            <PreventExternalDrop />
            {note && (
              <SideMenuController
                sideMenu={(props) => <SideMenuRenderer {...props} note={note} />}
              />
            )}
            <SlashMenu editor={editor} />
          </>
        )}
        {children}
      </BlockNoteView>
    </div>
  )
}

function useYjsUndoPatches(editor: CustomBlockNoteEditor) {
  useEffect(() => {
    patchEditorYjsUndo(editor)
  }, [editor])
}

function useNoteYjsUndoShortcutPatch(editor: CustomBlockNoteEditor, editable: boolean) {
  const noteSurfaceRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const surface = noteSurfaceRef.current
    if (!editable || !surface) return

    const handleKeyDown = (event: globalThis.KeyboardEvent) => {
      if (!isHistoryShortcut(event) || !isEventInsideNoteSurface(event, editor, surface)) return
      event.preventDefault()
      event.stopPropagation()
      runYjsHistoryCommand(editor._tiptapEditor.view, getHistoryDirection(event))
    }

    window.addEventListener('keydown', handleKeyDown, { capture: true })
    return () => window.removeEventListener('keydown', handleKeyDown, { capture: true })
  }, [editable, editor])

  return noteSurfaceRef
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

function isEventInsideNoteSurface(
  event: globalThis.KeyboardEvent,
  editor: CustomBlockNoteEditor,
  surface: HTMLElement,
) {
  if (editor._tiptapEditor.view.hasFocus()) return true

  const activeElement = surface.ownerDocument.activeElement
  if (
    activeElement instanceof Node &&
    (surface.contains(activeElement) || editor._tiptapEditor.view.dom.contains(activeElement))
  ) {
    return true
  }

  const target = event.target
  return (
    target instanceof Node &&
    (surface.contains(target) || editor._tiptapEditor.view.dom.contains(target))
  )
}

function patchEditorYjsUndo(editor: CustomBlockNoteEditor) {
  const view = editor._tiptapEditor.view
  patchYUndoPluginDestroy(view)
  patchYSyncAfterTypeChanged(view)
}
