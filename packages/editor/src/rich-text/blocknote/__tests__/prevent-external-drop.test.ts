import { describe, expect, it } from 'vite-plus/test'
import { removeProseMirrorDropCursors } from '../prevent-external-drop-cursors'
import { shouldPreventExternalFileDrop } from '../prevent-external-drop-policy'

describe('shouldPreventExternalFileDrop', () => {
  it('prevents file drops in the editor by default', () => {
    const target = document.createElement('div')
    const event = {
      target,
      dataTransfer: { types: ['Files'] },
    } as unknown as DragEvent

    expect(shouldPreventExternalFileDrop(event)).toBe(true)
  })

  it('allows file drops targeted inside explicit external drop targets', () => {
    const embed = document.createElement('div')
    embed.dataset.blocknoteExternalDropTarget = 'true'
    const child = document.createElement('button')
    embed.appendChild(child)
    const event = {
      target: child,
      dataTransfer: { types: ['Files'] },
    } as unknown as DragEvent

    expect(shouldPreventExternalFileDrop(event)).toBe(false)
  })

  it('allows text-node drops inside explicit external drop targets', () => {
    const embed = document.createElement('div')
    embed.dataset.blocknoteExternalDropTarget = 'true'
    const text = document.createTextNode('drop here')
    embed.appendChild(text)
    const event = {
      target: text,
      dataTransfer: { types: ['Files'] },
      composedPath: () => [text, embed, document.body, document],
    } as unknown as DragEvent

    expect(shouldPreventExternalFileDrop(event)).toBe(false)
  })

  it('allows mixed browser file and URL drops inside explicit note-body drop targets', () => {
    const noteBody = document.createElement('div')
    noteBody.dataset.blocknoteExternalUrlDropTarget = 'true'
    const paragraph = document.createElement('p')
    noteBody.appendChild(paragraph)
    const event = {
      target: paragraph,
      dataTransfer: { types: ['text/uri-list', 'text/html', 'Files'] },
    } as unknown as DragEvent

    expect(shouldPreventExternalFileDrop(event)).toBe(false)
  })

  it('prevents pure file drops inside URL-only drop targets', () => {
    const noteBody = document.createElement('div')
    noteBody.dataset.blocknoteExternalUrlDropTarget = 'true'
    const paragraph = document.createElement('p')
    noteBody.appendChild(paragraph)
    const event = {
      target: paragraph,
      dataTransfer: { types: ['Files'] },
    } as unknown as DragEvent

    expect(shouldPreventExternalFileDrop(event)).toBe(true)
  })

  it('prevents file drops inside explicitly blocked descendants before allowed ancestors', () => {
    const noteBody = document.createElement('div')
    noteBody.dataset.blocknoteExternalDropTarget = 'true'
    const embed = document.createElement('section')
    embed.dataset.blocknoteExternalDropBlocked = 'true'
    const child = document.createElement('div')
    noteBody.appendChild(embed)
    embed.appendChild(child)
    const event = {
      target: child,
      dataTransfer: { types: ['text/uri-list', 'Files'] },
    } as unknown as DragEvent

    expect(shouldPreventExternalFileDrop(event)).toBe(true)
  })
})

describe('removeProseMirrorDropCursors', () => {
  it('removes drop cursors only inside the active editor root', () => {
    const activeEditor = document.createElement('div')
    const siblingEditor = document.createElement('div')
    const activeCursor = document.createElement('div')
    const siblingCursor = document.createElement('div')
    activeCursor.className = 'prosemirror-dropcursor-block'
    siblingCursor.className = 'prosemirror-dropcursor-inline'
    activeEditor.append(activeCursor)
    siblingEditor.append(siblingCursor)
    document.body.append(activeEditor, siblingEditor)

    removeProseMirrorDropCursors(activeEditor)

    expect(activeEditor.querySelector('.prosemirror-dropcursor-block')).toBeNull()
    expect(siblingEditor.querySelector('.prosemirror-dropcursor-inline')).toBe(siblingCursor)

    activeEditor.remove()
    siblingEditor.remove()
  })
})
