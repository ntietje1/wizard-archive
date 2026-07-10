import { describe, expect, it } from 'vite-plus/test'
import { resolveMediaCaptionsTrack } from '../media-captions-track'

describe('resolveMediaCaptionsTrack', () => {
  it('returns caller-provided captions when the source URL is safe', () => {
    const captions = {
      label: 'English',
      src: 'https://example.com/captions.vtt',
      srcLang: 'en',
    }

    expect(resolveMediaCaptionsTrack({ captions })).toEqual({
      source: captions,
      status: 'provided',
    })
  })

  it('returns an explicit unavailable track when captions are missing or unsafe', () => {
    expect(resolveMediaCaptionsTrack({})).toEqual(
      expect.objectContaining({
        status: 'unavailable',
        source: expect.objectContaining({ label: 'Captions unavailable' }),
      }),
    )
    expect(
      resolveMediaCaptionsTrack({
        captions: { label: 'English', src: 'http://example.com/captions.vtt', srcLang: 'en' },
      }),
    ).toEqual(
      expect.objectContaining({
        status: 'unavailable',
        source: expect.objectContaining({ label: 'Captions unavailable' }),
      }),
    )
  })

  it('allows object URL captions only when the caller opts in', () => {
    const captions = {
      label: 'Generated',
      src: 'blob:https://example.com/captions',
      srcLang: 'en',
    }

    expect(resolveMediaCaptionsTrack({ captions })).toEqual(
      expect.objectContaining({ status: 'unavailable' }),
    )
    expect(resolveMediaCaptionsTrack({ captions, allowObjectUrl: true })).toEqual({
      source: captions,
      status: 'provided',
    })
  })
})
