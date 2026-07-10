import { describe, expect, it } from 'vite-plus/test'
import { getValidMediaFileSource } from '../media-file-source'

describe('getValidMediaFileSource', () => {
  it('returns a valid source with provided captions when both URLs are allowed', () => {
    const captions = {
      label: 'English',
      src: 'https://example.com/captions.vtt',
      srcLang: 'en',
    }

    expect(
      getValidMediaFileSource({
        captions,
        sourceUrl: 'https://example.com/audio.mp3',
      }),
    ).toEqual({
      status: 'valid',
      captionsTrack: {
        status: 'provided',
        source: captions,
      },
    })
  })

  it('rejects unsafe media URLs before resolving captions', () => {
    expect(
      getValidMediaFileSource({
        captions: {
          label: 'English',
          src: 'https://example.com/captions.vtt',
          srcLang: 'en',
        },
        sourceUrl: 'http://example.com/audio.mp3',
      }),
    ).toBeNull()
  })

  it('keeps the source valid while marking missing or unsafe captions unavailable', () => {
    expect(
      getValidMediaFileSource({
        captions: {
          label: 'English',
          src: 'http://example.com/captions.vtt',
          srcLang: 'en',
        },
        sourceUrl: 'https://example.com/audio.mp3',
      }),
    ).toEqual(
      expect.objectContaining({
        status: 'valid',
        captionsTrack: expect.objectContaining({ status: 'unavailable' }),
      }),
    )
  })

  it('allows object URLs only when the caller opts in', () => {
    expect(
      getValidMediaFileSource({
        sourceUrl: 'blob:https://example.com/audio',
      }),
    ).toBeNull()
    expect(
      getValidMediaFileSource({
        allowObjectUrl: true,
        sourceUrl: 'blob:https://example.com/audio',
      }),
    ).toEqual(
      expect.objectContaining({
        status: 'valid',
        captionsTrack: expect.objectContaining({ status: 'unavailable' }),
      }),
    )
  })

  it('allows data URLs only when the caller opts in', () => {
    expect(
      getValidMediaFileSource({
        sourceUrl: 'data:audio/mpeg;base64,AAAA',
      }),
    ).toBeNull()
    expect(
      getValidMediaFileSource({
        allowDataUrl: true,
        sourceUrl: 'data:audio/mpeg;base64,AAAA',
      }),
    ).toEqual(
      expect.objectContaining({
        status: 'valid',
        captionsTrack: expect.objectContaining({ status: 'unavailable' }),
      }),
    )
  })
})
