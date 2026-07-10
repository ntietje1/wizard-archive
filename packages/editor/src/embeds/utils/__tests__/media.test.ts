import { describe, expect, it } from 'vite-plus/test'
import {
  areEmbedMediaLayoutsEqual,
  getEmbedMediaAspectRatio,
  getIntrinsicAspectRatio,
  inferEmbedMediaKindFromContentType,
} from '../media'

describe('embed media detection', () => {
  it('infers internal file kind by content type', () => {
    expect(inferEmbedMediaKindFromContentType('image/png')).toBe('image')
    expect(inferEmbedMediaKindFromContentType('video/mp4')).toBe('video')
    expect(inferEmbedMediaKindFromContentType('audio/mpeg')).toBe('audio')
    expect(inferEmbedMediaKindFromContentType('application/pdf')).toBe('pdf')
    expect(inferEmbedMediaKindFromContentType('application/pdf; charset=binary')).toBe('pdf')
    expect(inferEmbedMediaKindFromContentType(null)).toBe('unknown')
  })

  it('reports finite positive intrinsic aspect ratios', () => {
    expect(getIntrinsicAspectRatio(1920, 1080)).toBe(1.777778)
    expect(getIntrinsicAspectRatio(0, 1080)).toBeNull()
    expect(getIntrinsicAspectRatio(1920, Number.NaN)).toBeNull()
  })

  it('extracts usable aspect ratios from intrinsic media layouts', () => {
    expect(getEmbedMediaAspectRatio({ kind: 'intrinsicAspectRatio', aspectRatio: 1.25 })).toBe(1.25)
    expect(getEmbedMediaAspectRatio({ kind: 'intrinsicAspectRatio', aspectRatio: null })).toBeNull()
    expect(getEmbedMediaAspectRatio({ kind: 'fixedHeight', height: 240 })).toBeNull()
  })

  it('matches equal fixed-height media layouts', () => {
    expect(
      areEmbedMediaLayoutsEqual(
        { kind: 'fixedHeight', height: 240 },
        { kind: 'fixedHeight', height: 240 },
      ),
    ).toBe(true)
    expect(
      areEmbedMediaLayoutsEqual(
        { kind: 'fixedHeight', height: 240 },
        { kind: 'fixedHeight', height: 320 },
      ),
    ).toBe(false)
  })

  it('matches equal intrinsic-aspect-ratio media layouts', () => {
    expect(
      areEmbedMediaLayoutsEqual(
        { kind: 'intrinsicAspectRatio', aspectRatio: 1.5 },
        { kind: 'intrinsicAspectRatio', aspectRatio: 1.5 },
      ),
    ).toBe(true)
    expect(
      areEmbedMediaLayoutsEqual(
        { kind: 'intrinsicAspectRatio', aspectRatio: 1.5 },
        { kind: 'intrinsicAspectRatio', aspectRatio: null },
      ),
    ).toBe(false)
  })
})
