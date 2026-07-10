import type { BlockNoteEditor } from '@blocknote/core'
import { useEffect, useState, useSyncExternalStore } from 'react'
import { captureCanvasTextSelection } from './blocknote-adapter'
import { resolveRichTextSelectionTextColor } from '../../rich-text/blocknote/rich-text-selection-colors'

type CanvasTextFormattingEditor = Pick<
  BlockNoteEditor<any, any, any>,
  | 'document'
  | 'replaceBlocks'
  | 'addStyles'
  | 'focus'
  | 'getActiveStyles'
  | 'getSelection'
  | 'getSelectionCutBlocks'
  | 'getTextCursorPosition'
  | 'isEditable'
  | 'onChange'
  | 'onSelectionChange'
  | 'schema'
>

interface CanvasTextFormattingSession {
  defaultTextColor: string
  editor: CanvasTextFormattingEditor
  nodeId: string
  setDefaultTextColor: (color: string) => void
}

let activeSession: CanvasTextFormattingSession | null = null
const sessionListeners = new Set<() => void>()

export function registerCanvasTextFormattingSession(session: CanvasTextFormattingSession) {
  activeSession = session
  emitSessionChange()

  return () => {
    if (activeSession !== session) {
      return
    }

    activeSession = null
    emitSessionChange()
  }
}

export function useCanvasTextFormattingSnapshot() {
  const session = useSyncExternalStore(subscribeToSession, getActiveSession, getActiveSession)
  const [revision, setRevision] = useState(0)

  useEffect(() => {
    setRevision(0)
    if (!session) {
      return
    }

    const bumpRevision = () => setRevision((value) => value + 1)
    const unsubscribeSelection = session.editor.onSelectionChange(bumpRevision)
    const unsubscribeChange = session.editor.onChange(bumpRevision)

    return () => {
      unsubscribeSelection()
      unsubscribeChange()
    }
  }, [session])

  return session ? createFormattingSnapshot(session, revision) : null
}

function subscribeToSession(listener: () => void) {
  sessionListeners.add(listener)
  return () => {
    sessionListeners.delete(listener)
  }
}

function getActiveSession() {
  return activeSession
}

function emitSessionChange() {
  sessionListeners.forEach((listener) => listener())
}

function createFormattingSnapshot(session: CanvasTextFormattingSession, revision: number) {
  const selection = session.editor.getSelection()
  const hasTextSelection = selection !== undefined
  const selectedTextBlocks = hasTextSelection
    ? session.editor.getSelectionCutBlocks().blocks
    : [session.editor.getTextCursorPosition().block]
  const activeTextColor = session.editor.getActiveStyles().textColor

  return {
    ...session,
    hasTextSelection,
    revision,
    selectionSnapshot: captureCanvasTextSelection(session.editor),
    textColorValue: resolveRichTextSelectionTextColor({
      activeTextColor: typeof activeTextColor === 'string' ? activeTextColor : null,
      defaultTextColor: session.defaultTextColor,
      hasTextSelection,
      selectedBlocks: selectedTextBlocks,
    }),
  }
}

export type CanvasTextFormattingSnapshot = ReturnType<typeof createFormattingSnapshot>
