import { describe, expect, it, vi } from 'vite-plus/test'
import type { DragEvent } from 'react'
import { serializeAuthoredDestination } from '../../resources/authored-destination'
import type { AuthoredDestinationDropResolver } from '../../resources/authored-destination-drop'
import { DOMAIN_ID_KIND, generateDomainId } from '../../resources/domain-id'
import type { NoteBlockNoteEditor } from '../note-editor-schema'
import { noteEditorResourceDropTarget } from '../note-editor-drop-target'

describe('note editor resource drops', () => {
  it('uses one plan for positive link feedback and insertion at the drop point', async () => {
    const sourceResourceId = generateDomainId(DOMAIN_ID_KIND.resource)
    const droppedResourceId = generateDomainId(DOMAIN_ID_KIND.resource)
    const destination = {
      kind: 'internal' as const,
      target: { kind: 'resource' as const, resourceId: droppedResourceId },
    }
    const resolve = vi.fn(() =>
      Promise.resolve({ kind: 'destinations' as const, destinations: [destination] }),
    )
    const drop = {
      canResolve: () => true,
      resolve,
      resolveFiles: vi.fn(),
    } satisfies AuthoredDestinationDropResolver
    const chain = {
      focus: vi.fn(() => chain),
      run: vi.fn(() => true),
      setTextSelection: vi.fn(() => chain),
    }
    const insertInlineContent = vi.fn()
    const editor = {
      _tiptapEditor: {
        chain: () => chain,
        view: { posAtCoords: () => ({ pos: 7 }) },
      },
      insertInlineContent,
    } as unknown as NoteBlockNoteEditor
    const target = document.createElement('div')
    document.body.append(target)
    const dataTransfer = workspaceDragTransfer(droppedResourceId)
    const handlers = noteEditorResourceDropTarget({
      drop,
      editable: true,
      editor,
      sourceResourceId,
    })
    const dragOver = dropEvent(target, dataTransfer)

    handlers.onDragOver(dragOver)

    expect(target).toHaveAttribute('data-drop-feedback', 'Add link here')
    expect(target).toHaveAttribute('data-drop-blocked', 'false')
    expect(handlers.onDrop(dropEvent(target, dataTransfer))).toBe(true)
    await vi.waitFor(() => expect(insertInlineContent).toHaveBeenCalledOnce())
    expect(chain.setTextSelection).toHaveBeenCalledWith({ from: 7, to: 7 })
    expect(insertInlineContent).toHaveBeenCalledWith(
      [
        {
          type: 'resourceLink',
          props: { destination: serializeAuthoredDestination(destination), label: '' },
        },
      ],
      { updateSelection: true },
    )
    target.remove()
  })

  it('shows a rejected self-drop without resolving or mutating the note', () => {
    const sourceResourceId = generateDomainId(DOMAIN_ID_KIND.resource)
    const resolve = vi.fn()
    const target = document.createElement('div')
    document.body.append(target)
    const handlers = noteEditorResourceDropTarget({
      drop: { canResolve: () => true, resolve, resolveFiles: vi.fn() },
      editable: true,
      editor: {} as NoteBlockNoteEditor,
      sourceResourceId,
    })
    const event = dropEvent(target, workspaceDragTransfer(sourceResourceId))

    handlers.onDragOver(event)

    expect(target).toHaveAttribute('data-drop-feedback', 'Cannot add a note to itself')
    expect(target).toHaveAttribute('data-drop-blocked', 'true')
    expect(handlers.onDrop(event)).toBe(true)
    expect(resolve).not.toHaveBeenCalled()
    target.remove()
  })
})

function workspaceDragTransfer(resourceId: string) {
  return {
    dropEffect: 'none',
    getData: () => JSON.stringify({ schema: 'resource-drag-v2', resourceIds: [resourceId] }),
    types: ['application/x-wizard-archive-resource-ids'],
  } as unknown as DataTransfer
}

function dropEvent(target: HTMLElement, dataTransfer: DataTransfer) {
  return {
    clientX: 20,
    clientY: 30,
    currentTarget: target,
    dataTransfer,
    preventDefault: vi.fn(),
    shiftKey: false,
    stopPropagation: vi.fn(),
  } as unknown as DragEvent<HTMLElement>
}
