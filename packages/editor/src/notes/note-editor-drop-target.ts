import type { DragEvent } from 'react'
import { serializeAuthoredDestination } from '../resources/authored-destination'
import type { AuthoredDestination } from '../resources/authored-destination-contract'
import type { AuthoredDestinationDropResolver } from '../resources/authored-destination-drop'
import type { ResourceId } from '../resources/domain-id'
import {
  clearWorkspaceResourceDropTarget,
  markWorkspaceResourceSurfaceDrop,
  readWorkspaceResourceDrag,
  workspaceResourceSurfaceDropLabel,
} from '../resources/workspace-resource-drag'
import type { NoteBlockNoteEditor } from './note-editor-schema'

const DEFAULT_NOTE_EMBED_WIDTH = 480

export function noteEditorResourceDropTarget({
  drop,
  editable,
  editor,
  sourceResourceId,
}: {
  drop: AuthoredDestinationDropResolver | null
  editable: boolean
  editor: NoteBlockNoteEditor
  sourceResourceId: ResourceId | null
}) {
  const plan = (event: DragEvent<HTMLElement>) => {
    if (!editable || !drop || !sourceResourceId || !drop.canResolve(event.dataTransfer)) return null
    const drag = readWorkspaceResourceDrag(event.dataTransfer)
    if (!drag) return null
    const resourceIds = drag.resourceIds.filter((resourceId) => resourceId !== sourceResourceId)
    if (resourceIds.length === 0) {
      return {
        feedback: { status: 'rejected' as const, label: 'Cannot add a note to itself' },
        maximumDestinations: drag.resourceIds.length,
        resourceIds,
      }
    }
    const action = event.shiftKey ? ('noteEmbed' as const) : ('noteLink' as const)
    return {
      feedback: workspaceResourceSurfaceDropLabel(action, resourceIds.length),
      maximumDestinations: drag.resourceIds.length,
      resourceIds,
    }
  }

  return {
    onDragOver: (event: DragEvent<HTMLElement>) => {
      const current = plan(event)
      if (current) markWorkspaceResourceSurfaceDrop(event, current.feedback)
    },
    onDrop: (event: DragEvent<HTMLElement>) => {
      const current = plan(event)
      if (!current || !drop || !sourceResourceId) return false
      event.preventDefault()
      event.stopPropagation()
      clearWorkspaceResourceDropTarget(event.currentTarget)
      if (current.feedback.status === 'rejected') return true
      const embed = event.shiftKey
      const point = { x: event.clientX, y: event.clientY }
      const dataTransfer = event.dataTransfer
      const controller = new AbortController()
      void drop
        .resolve(dataTransfer, current.maximumDestinations, controller.signal)
        .then((result) => {
          if (result.kind !== 'destinations') return
          const destinations = result.destinations.filter(
            (destination) => !isResourceDestination(destination, sourceResourceId),
          )
          focusEditorAtDropPoint(editor, point)
          if (embed) insertDroppedEmbeds(editor, destinations)
          else insertDroppedLinks(editor, destinations)
        })
      return true
    },
  }
}

function focusEditorAtDropPoint(
  editor: NoteBlockNoteEditor,
  point: Readonly<{ x: number; y: number }>,
) {
  const tiptap = editor._tiptapEditor
  const position = tiptap.view.posAtCoords({ left: point.x, top: point.y })?.pos
  const chain = tiptap.chain().focus()
  if (typeof position === 'number') chain.setTextSelection({ from: position, to: position })
  chain.run()
}

function insertDroppedLinks(
  editor: NoteBlockNoteEditor,
  destinations: ReadonlyArray<AuthoredDestination>,
) {
  const content = destinations.flatMap((destination, index) => [
    ...(index > 0 ? [{ type: 'text' as const, text: ' ', styles: {} }] : []),
    {
      type: 'resourceLink' as const,
      props: { destination: serializeAuthoredDestination(destination), label: '' },
    },
  ])
  if (content.length > 0) editor.insertInlineContent(content, { updateSelection: true })
}

function insertDroppedEmbeds(
  editor: NoteBlockNoteEditor,
  destinations: ReadonlyArray<AuthoredDestination>,
) {
  if (destinations.length === 0) return
  const currentBlock = editor.getTextCursorPosition().block
  editor.insertBlocks(
    destinations.map((destination) => ({
      type: 'embed' as const,
      props: {
        destination: serializeAuthoredDestination(destination),
        previewWidth: DEFAULT_NOTE_EMBED_WIDTH,
      },
    })),
    currentBlock,
    'after',
  )
}

function isResourceDestination(destination: AuthoredDestination, resourceId: ResourceId) {
  return destination.kind === 'internal' && destination.target.resourceId === resourceId
}
