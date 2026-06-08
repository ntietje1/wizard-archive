import { describe, expect, it } from 'vitest'
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

  it('allows file drops targeted inside note embed blocks', () => {
    const embed = document.createElement('div')
    embed.dataset.noteEmbedDropTarget = 'true'
    const child = document.createElement('button')
    embed.appendChild(child)
    const event = {
      target: child,
      dataTransfer: { types: ['Files'] },
    } as unknown as DragEvent

    expect(shouldPreventExternalFileDrop(event)).toBe(false)
  })
})
