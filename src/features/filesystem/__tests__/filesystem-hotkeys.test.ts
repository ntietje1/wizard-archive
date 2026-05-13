import { describe, expect, it } from 'vitest'
import { isFileSystemRedoShortcut, isFileSystemUndoShortcut } from '../filesystem-hotkeys'

describe('filesystem undo/redo hotkeys', () => {
  it('recognizes Ctrl/Cmd+Z as undo', () => {
    expect(
      isFileSystemUndoShortcut(new KeyboardEvent('keydown', { key: 'z', ctrlKey: true })),
    ).toBe(true)
    expect(
      isFileSystemUndoShortcut(new KeyboardEvent('keydown', { key: 'Z', metaKey: true })),
    ).toBe(true)
  })

  it('does not treat shifted or alternate modifier shortcuts as undo', () => {
    expect(isFileSystemUndoShortcut(new KeyboardEvent('keydown', { key: 'z' }))).toBe(false)
    expect(isFileSystemUndoShortcut(new KeyboardEvent('keydown', { key: 'Z' }))).toBe(false)
    expect(
      isFileSystemUndoShortcut(
        new KeyboardEvent('keydown', { key: 'z', ctrlKey: true, shiftKey: true }),
      ),
    ).toBe(false)
    expect(
      isFileSystemUndoShortcut(
        new KeyboardEvent('keydown', { key: 'z', ctrlKey: true, altKey: true }),
      ),
    ).toBe(false)
  })

  it('recognizes platform redo shortcuts', () => {
    expect(
      isFileSystemRedoShortcut(
        new KeyboardEvent('keydown', { key: 'z', ctrlKey: true, shiftKey: true }),
      ),
    ).toBe(true)
    expect(
      isFileSystemRedoShortcut(
        new KeyboardEvent('keydown', { key: 'Z', metaKey: true, shiftKey: true }),
      ),
    ).toBe(true)
    expect(
      isFileSystemRedoShortcut(new KeyboardEvent('keydown', { key: 'y', ctrlKey: true })),
    ).toBe(true)
    expect(
      isFileSystemRedoShortcut(new KeyboardEvent('keydown', { key: 'Y', ctrlKey: true })),
    ).toBe(true)
  })

  it('does not treat Cmd+Y or Alt-modified shortcuts as redo', () => {
    expect(
      isFileSystemRedoShortcut(new KeyboardEvent('keydown', { key: 'y', metaKey: true })),
    ).toBe(false)
    expect(
      isFileSystemRedoShortcut(
        new KeyboardEvent('keydown', { key: 'z', ctrlKey: true, shiftKey: true, altKey: true }),
      ),
    ).toBe(false)
  })
})
