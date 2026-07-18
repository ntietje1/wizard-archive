import { describe, expect, it } from 'vite-plus/test'
import { keyboardResizeNoteEmbed } from '../note-embed-resize'

describe('note embed resize', () => {
  it('resizes each focused edge only in its owned direction', () => {
    expect(
      keyboardResizeNoteEmbed({
        handle: 'left',
        height: 288,
        key: 'ArrowLeft',
        width: 480,
      }),
    ).toEqual({ width: 496, height: 288 })
    expect(
      keyboardResizeNoteEmbed({
        handle: 'top',
        height: 288,
        key: 'ArrowUp',
        width: 480,
      }),
    ).toEqual({ width: 480, height: 304 })
  })

  it('clamps the preview to the editor width and minimum body size', () => {
    expect(
      keyboardResizeNoteEmbed({
        editorWidth: 500,
        handle: 'right',
        height: 144,
        key: 'ArrowRight',
        width: 496,
      }),
    ).toEqual({ width: 500, height: 144 })
    expect(
      keyboardResizeNoteEmbed({
        handle: 'top',
        height: 144,
        key: 'ArrowDown',
        width: 480,
      }),
    ).toEqual({ width: 480, height: 144 })
  })

  it('accepts only keyboard arrows owned by the focused handle', () => {
    expect(
      keyboardResizeNoteEmbed({
        handle: 'right',
        height: 288,
        key: 'ArrowRight',
        width: 480,
      }),
    ).toEqual({ width: 496, height: 288 })
    expect(
      keyboardResizeNoteEmbed({
        handle: 'right',
        height: 288,
        key: 'ArrowDown',
        width: 480,
      }),
    ).toBeNull()
  })

  it('preserves intrinsic media proportions from horizontal and vertical handles', () => {
    expect(
      keyboardResizeNoteEmbed({
        aspectRatio: 16 / 9,
        handle: 'right',
        height: 270,
        key: 'ArrowRight',
        width: 480,
      }),
    ).toEqual({ width: 496, height: 279 })
    expect(
      keyboardResizeNoteEmbed({
        aspectRatio: 16 / 9,
        handle: 'bottom',
        height: 270,
        key: 'ArrowDown',
        width: 480,
      }),
    ).toEqual({ width: 508, height: 286 })
  })
})
