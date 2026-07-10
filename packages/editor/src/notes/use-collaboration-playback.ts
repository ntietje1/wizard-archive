import type { Node as ProseMirrorNode } from '@tiptap/pm/model'
import {
  Awareness,
  applyAwarenessUpdate,
  encodeAwarenessUpdate,
  removeAwarenessStates,
} from 'y-protocols/awareness'
import { useEffect } from 'react'
import * as Y from 'yjs'
import { absolutePositionToRelativePosition, ySyncPluginKey } from 'y-prosemirror'
import type { SidebarItemId } from '../../../../shared/common/ids'
import type { CustomBlockNoteEditor } from './editor-schema'
import type { YjsCollaborationProvider } from '../collaboration/yjs-provider'
import type { NoteCollaborationPlayback } from './playback-contract'

type YProsemirrorMapping = Map<Y.AbstractType<unknown>, ProseMirrorNode | Array<ProseMirrorNode>>
type PlaybackEditor = CustomBlockNoteEditor

export function useNoteCollaborationPlayback({
  editor,
  noteId,
  playback,
  provider,
}: {
  editor: CustomBlockNoteEditor | null
  noteId: SidebarItemId | undefined
  playback: NoteCollaborationPlayback | undefined
  provider: YjsCollaborationProvider | undefined
}) {
  useEffect(() => {
    if (!editor || !noteId || !playback || playback.noteId !== noteId || !provider) {
      return
    }

    const remoteClients = playback.collaborators.map((collaborator) => ({
      ...collaborator,
      doc: new Y.Doc(),
    }))
    const remoteAwareness = remoteClients.map((client) => ({
      ...client,
      awareness: new Awareness(client.doc),
    }))

    let typingStep = playback.initialTypingStep
    const updatePlayback = () => {
      typingStep =
        typingStep >= playback.typingText.length
          ? playback.initialTypingStep
          : Math.min(typingStep + 3, playback.typingText.length)
      updatePlaybackTypingBlock(editor, playback, typingStep)
      publishPlaybackRemoteCursors(editor, provider, remoteAwareness, typingStep)
    }

    updatePlayback()
    const intervalId = window.setInterval(updatePlayback, playback.intervalMs ?? 520)

    return () => {
      window.clearInterval(intervalId)
      removeAwarenessStates(
        provider.awareness,
        remoteClients.map((client) => client.doc.clientID),
        'note-collaboration-playback-disconnect',
      )
      remoteAwareness.forEach((client) => client.awareness.destroy())
      remoteClients.forEach((client) => client.doc.destroy())
    }
  }, [editor, noteId, playback, provider])
}

function updatePlaybackTypingBlock(
  editor: PlaybackEditor,
  playback: NoteCollaborationPlayback,
  typingStep: number,
) {
  const typedText = playback.typingText.slice(0, typingStep)
  const block = editor.document[playback.typingBlockIndex]
  if (!block) return

  editor.updateBlock(block.id, {
    type: 'paragraph',
    content: [{ type: 'text', text: typedText, styles: {} }],
  })
}

function publishPlaybackRemoteCursors(
  editor: PlaybackEditor,
  provider: YjsCollaborationProvider,
  remoteAwareness: Array<{
    awareness: Awareness
    color: string
    doc: Y.Doc
    name: string
  }>,
  typingStep: number,
) {
  const cursorStates = createPlaybackRemoteCursorStates(editor, typingStep)
  if (!cursorStates) return

  remoteAwareness.forEach((client, index) => {
    client.awareness.setLocalState({
      user: { name: client.name, color: client.color },
      cursor: cursorStates[index],
    })
    applyAwarenessUpdate(
      provider.awareness,
      encodeAwarenessUpdate(client.awareness, [client.doc.clientID]),
      'note-collaboration-playback',
    )
  })
}

function createPlaybackRemoteCursorStates(editor: PlaybackEditor, typingStep: number) {
  const view = editor.prosemirrorView
  const syncState = ySyncPluginKey.getState(view.state) as
    | {
        type: Y.XmlFragment
        binding: { mapping: YProsemirrorMapping }
      }
    | undefined

  if (!syncState || syncState.binding.mapping.size === 0) return null

  const docEnd = Math.max(view.state.doc.content.size - 2, 1)
  const typingPosition = Math.min(docEnd, Math.max(8, docEnd - 2 + typingStep))
  const positions = [
    { anchor: 12, head: 12 },
    { anchor: 37, head: 58 },
    { anchor: typingPosition, head: typingPosition },
  ]

  return positions.map(({ anchor, head }) => ({
    anchor: absolutePositionToRelativePosition(
      clampPlaybackDocPosition(anchor, docEnd),
      syncState.type,
      syncState.binding.mapping,
    ),
    head: absolutePositionToRelativePosition(
      clampPlaybackDocPosition(head, docEnd),
      syncState.type,
      syncState.binding.mapping,
    ),
  }))
}

function clampPlaybackDocPosition(position: number, docEnd: number) {
  return Math.max(1, Math.min(position, docEnd))
}
