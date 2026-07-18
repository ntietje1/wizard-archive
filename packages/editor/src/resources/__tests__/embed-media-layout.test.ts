import { describe, expect, it } from 'vite-plus/test'
import {
  intrinsicMediaAspectRatio,
  mediaLayoutAspectRatio,
  mediaLayoutsEqual,
} from '../embed-media-layout'

describe('embed media layout', () => {
  it('normalizes valid intrinsic dimensions and rejects unusable dimensions', () => {
    expect(intrinsicMediaAspectRatio(1920, 1080)).toBe(1.777778)
    expect(intrinsicMediaAspectRatio(0, 1080)).toBeNull()
    expect(intrinsicMediaAspectRatio(Number.NaN, 1080)).toBeNull()
  })

  it('exposes only a valid intrinsic aspect ratio', () => {
    expect(mediaLayoutAspectRatio({ kind: 'intrinsicAspectRatio', aspectRatio: 1.5 })).toBe(1.5)
    expect(mediaLayoutAspectRatio({ kind: 'intrinsicAspectRatio', aspectRatio: null })).toBeNull()
    expect(mediaLayoutAspectRatio({ kind: 'fixedHeight', height: 40 })).toBeNull()
  })

  it('compares layouts by their discriminated value', () => {
    expect(
      mediaLayoutsEqual(
        { kind: 'intrinsicAspectRatio', aspectRatio: 1.5 },
        { kind: 'intrinsicAspectRatio', aspectRatio: 1.5 },
      ),
    ).toBe(true)
    expect(
      mediaLayoutsEqual(
        { kind: 'fixedHeight', height: 40 },
        { kind: 'intrinsicAspectRatio', aspectRatio: 1 },
      ),
    ).toBe(false)
  })
})
